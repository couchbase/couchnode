// Observing unhandled promise rejections, for the suites that assert on them.
//
// `PromiseHelper.wrap` and the streamable promises hand back a promise the
// caller may never await, and whether that produces an unhandled rejection is
// the behavior under test. Vitest's own listener would fail the run on it, so
// it is displaced for the duration of one watch and put back exactly; a
// rejection outside the window still fails the run.

/** The rejections seen since the watch opened, in the order Node emitted them. */
export interface RejectionWatch {
  readonly reasons: readonly unknown[]
  /**
   * Yields until Node has emitted whatever is already pending, then reports how
   * many rejections the watch has seen.
   *
   * Turns of the event loop, not a sleep. Node decides a rejection is unhandled
   * while draining the microtask queue, so two macrotask turns is strictly more
   * than one drain, where a sleep is a guess a loaded machine outruns.
   */
  settle(): Promise<number>
}

let open = false

/**
 * Silences `PromiseRejectionHandledWarning`, which Node prints only when
 * nothing listens for `rejectionHandled`. Inside a watch that late handling is
 * the expected sequence.
 */
function ignoreLateHandling(): void {
  /* deliberately empty */
}

/** One turn of the macrotask queue, which drains the microtask queue with it. */
function turn(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

/**
 * Runs `body` with the process's unhandled-rejection listeners replaced by one
 * that counts. Nesting is refused: the inner watch's exit would reinstate the
 * outer one's listener, which nobody would then remove.
 */
export async function watchRejections<T>(
  body: (watch: RejectionWatch) => Promise<T>
): Promise<T> {
  if (open) {
    throw new Error(
      'watchRejections is already open. Nested watches would each restore a ' +
        'different listener list, so the outer one would be reinstated by the ' +
        'inner one leaving.'
    )
  }

  const displaced = process.listeners('unhandledRejection')
  const displacedHandled = process.listeners('rejectionHandled')
  const reasons: unknown[] = []
  const listener = (reason: unknown): void => {
    reasons.push(reason)
  }

  open = true
  process.removeAllListeners('unhandledRejection')
  process.removeAllListeners('rejectionHandled')
  process.on('unhandledRejection', listener)
  process.on('rejectionHandled', ignoreLateHandling)

  try {
    return await body({
      reasons,
      settle: async () => {
        await turn()
        await turn()
        return reasons.length
      },
    })
  } finally {
    process.removeListener('unhandledRejection', listener)
    process.removeListener('rejectionHandled', ignoreLateHandling)
    for (const previous of displaced) {
      process.on('unhandledRejection', previous)
    }
    for (const previous of displacedHandled) {
      process.on('rejectionHandled', previous)
    }
    open = false
  }
}
