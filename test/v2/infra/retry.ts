// Bounded, cancellable waiting.
//
// The runner's per-test timeout does not cancel async work, so an unbounded
// poll keeps hitting the server while the next test runs. Every wait here has
// a deadline that produces a legible error and an `AbortSignal` so an
// abandoned poll stops.

/** Sleep that settles early when aborted, so a cancelled poll stops promptly. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(timer)
      resolve()
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** Raised when a poll runs out of time. Carries the last observation. */
export class PollTimeoutError extends Error {
  constructor(
    readonly what: string,
    readonly elapsedMs: number,
    readonly attempts: number,
    readonly lastSeen: string | undefined,
    readonly lastError: unknown
  ) {
    const seen =
      lastSeen !== undefined
        ? `; last saw: ${lastSeen}`
        : lastError !== undefined
          ? `; last error: ${describeError(lastError)}`
          : '; never observed anything'
    super(
      `Timed out after ${elapsedMs}ms waiting for ${what} ` +
        `(${attempts} attempt${attempts === 1 ? '' : 's'})${seen}`
    )
    this.name = 'PollTimeoutError'
  }
}

/** Raised when a poll is cancelled because the test that started it is over. */
export class PollAbortedError extends Error {
  constructor(what: string) {
    super(`Cancelled while waiting for ${what}`)
    this.name = 'PollAbortedError'
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`
  }
  return String(err)
}

/**
 * The context a polled function is given. `note()` records what it last saw,
 * which the timeout error then reports.
 */
export interface PollContext {
  readonly signal: AbortSignal
  note(observation: string): void
}

export interface PollOptions {
  readonly deadlineMs: number
  readonly intervalMs?: number
  /** Wired to the test's lifetime by the fixture. */
  readonly signal?: AbortSignal
  /**
   * Treat a thrown error as "not yet" and keep polling. Off by default, so a
   * failure is reported rather than swallowed.
   */
  readonly retryErrors?: boolean
}

/**
 * Polls `fn` until it returns a value other than undefined.
 *
 * @throws PollTimeoutError on deadline, naming what was awaited and last seen.
 * @throws PollAbortedError if the signal fires first.
 */
export async function pollUntil<T>(
  what: string,
  fn: (ctx: PollContext) => Promise<T | undefined>,
  opts: PollOptions
): Promise<T> {
  const intervalMs = opts.intervalMs ?? 100
  const started = Date.now()
  const deadline = started + opts.deadlineMs
  const signal = opts.signal ?? new AbortController().signal

  let attempts = 0
  let lastSeen: string | undefined
  let lastError: unknown

  const ctx: PollContext = {
    signal,
    note: (observation: string) => {
      lastSeen = observation
    },
  }

  for (;;) {
    if (signal.aborted) {
      throw new PollAbortedError(what)
    }

    attempts += 1
    try {
      const result = await fn(ctx)
      if (result !== undefined) {
        return result
      }
    } catch (err) {
      if (!opts.retryErrors) {
        throw err
      }
      lastError = err
    }

    if (signal.aborted) {
      throw new PollAbortedError(what)
    }
    if (Date.now() >= deadline) {
      throw new PollTimeoutError(
        what,
        Date.now() - started,
        attempts,
        lastSeen,
        lastError
      )
    }

    await sleep(
      Math.min(intervalMs, Math.max(0, deadline - Date.now())),
      signal
    )
  }
}

export interface PollWhileOptions {
  readonly deadlineMs: number
  readonly intervalMs?: number
  readonly signal?: AbortSignal
}

/**
 * Calls `fn` again while `pending` says its answer is not final, and returns
 * the first answer that is. For changes the server makes in its own time,
 * such as expiry. On the deadline the last answer is returned, so the caller's
 * own assertion fails; a rejection from `fn` propagates and is never retried.
 */
export async function pollWhile<T>(
  fn: () => Promise<T>,
  pending: (answer: T) => boolean,
  opts: PollWhileOptions
): Promise<T> {
  const intervalMs = opts.intervalMs ?? 250
  const deadline = Date.now() + opts.deadlineMs

  for (;;) {
    const answer = await fn()
    if (!pending(answer) || Date.now() >= deadline || opts.signal?.aborted) {
      return answer
    }
    await sleep(
      Math.min(intervalMs, Math.max(0, deadline - Date.now())),
      opts.signal
    )
  }
}

export async function tryNTimes<T>(
  attempts: number,
  delayMs: number,
  fn: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; ++i) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < attempts - 1) {
        await sleep(delayMs, signal)
      }
    }
  }
  throw lastError
}
