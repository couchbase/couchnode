// Asserting that a process exits, from outside it.
//
// The leak gate in `setup.ts` reads `process.getActiveResourcesInfo()`, which
// does not list a native callback the core never makes, and under
// `pool: 'forks'` Vitest ends a file's process whether its loop has drained or
// not. So a "process does not exit" defect needs a process of its own to watch:
// a `*.exitfixture.ts` beside the owning suite, run under `ts-node` against
// `lib/`. `exitchild.ts` is the fixture side.
//
// Each use costs a spawn and usually a connection, so reserve it for scenarios
// where not exiting is the plausible failure.

import { spawn } from 'child_process'
import { basename, isAbsolute, join } from 'path'

import type { TestEnv } from './env'
import { EXIT_CHILD_ENV } from './exitchild'
import { killChild } from './mock/child'

/** The repo. Fixtures run with it as their cwd, so `ts-node` resolves from it. */
const REPO_ROOT = join(import.meta.dirname, '..', '..')

/**
 * How long a fixture has to exit, unless its test says otherwise. This plus
 * `killChild`'s 5 s SIGTERM grace must stay under the 30 s `testTimeout`, or
 * the runner's bare timeout fires first with no fixture name or output. A test
 * passing a larger `withinMs` raises its own timeout to match.
 */
export const DEFAULT_EXIT_BUDGET_MS = 15_000

const OUTPUT_TAIL_LINES = 40

export interface ExitFixtureOptions {
  readonly withinMs?: number
  /**
   * Gives the child the run's connection, the mock included. Without it the
   * child gets no connection settings at all, even the parent shell's, so a
   * cluster free fixture cannot reach a cluster by accident.
   */
  readonly env?: TestEnv
}

export interface ExitFixtureResult<T = Record<string, unknown>> {
  /** The JSON line the fixture printed last, which is its reported outcome. */
  readonly outcome: T
  readonly elapsedMs: number
  /** Everything it printed, stdout and stderr interleaved. */
  readonly output: string
}

/** The fixture was still running at its budget, and has been killed. */
export class FixtureDidNotExitError extends Error {
  constructor(
    readonly fixture: string,
    readonly withinMs: number,
    readonly pid: number | undefined,
    readonly output: string
  ) {
    super(
      `exit fixture ${basename(fixture)} was still running after ` +
        `${withinMs} ms and was killed. Something it started keeps the ` +
        'process alive; a pending native callback does this without showing ' +
        `up in any handle list.\n${tail(output)}`
    )
    this.name = 'FixtureDidNotExitError'
  }
}

/** The fixture exited, but not cleanly, or without reporting an outcome. */
export class FixtureFailedError extends Error {
  constructor(
    readonly fixture: string,
    readonly exitCode: number | null,
    readonly signal: NodeJS.Signals | null,
    readonly output: string,
    reason: string
  ) {
    super(`exit fixture ${basename(fixture)} ${reason}.\n${tail(output)}`)
    this.name = 'FixtureFailedError'
  }
}

/**
 * A pass is exit code 0 inside the budget, with an outcome printed. A child
 * still alive at the budget is killed, and `FixtureDidNotExitError` is thrown
 * only once it is gone, so a failing test never leaves a process behind.
 *
 * `fixture` is absolute; callers build it from `import.meta.dirname`.
 */
export async function expectProcessExits<T = Record<string, unknown>>(
  fixture: string,
  opts: ExitFixtureOptions = {}
): Promise<ExitFixtureResult<T>> {
  if (!isAbsolute(fixture)) {
    throw new Error(`expectProcessExits needs an absolute path, got ${fixture}`)
  }
  if (!fixture.endsWith('.exitfixture.ts')) {
    throw new Error(
      `${basename(fixture)} is not an exit fixture: they are named ` +
        '*.exitfixture.ts, which is what keeps every project from collecting ' +
        'them as test files'
    )
  }
  const withinMs = opts.withinMs ?? DEFAULT_EXIT_BUDGET_MS

  const started = performance.now()
  const child = spawn(
    process.execPath,
    ['--require', 'ts-node/register/transpile-only', fixture],
    {
      cwd: REPO_ROOT,
      env: childEnvironment(opts.env),
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )

  let stdout = ''
  let output = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk
    output += chunk
  })
  child.stderr.on('data', (chunk: string) => {
    output += chunk
  })

  // `close` rather than `exit`: it fires once the stdio pipes have closed too,
  // so nothing of the child is still open when this returns, and the file's
  // own leak gate has nothing of ours to find.
  const closed = new Promise<{
    code: number | null
    signal: NodeJS.Signals | null
  }>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => resolve({ code, signal }))
  })

  let timer: NodeJS.Timeout | undefined
  const budget = new Promise<'budget'>((resolve) => {
    timer = setTimeout(() => resolve('budget'), withinMs)
  })

  let ended: Awaited<typeof closed> | 'budget'
  try {
    ended = await Promise.race([closed, budget])
  } finally {
    clearTimeout(timer)
  }

  if (ended === 'budget') {
    await killChild(child)
    await closed
    throw new FixtureDidNotExitError(fixture, withinMs, child.pid, output)
  }
  const elapsedMs = performance.now() - started

  if (ended.code !== 0) {
    throw new FixtureFailedError(
      fixture,
      ended.code,
      ended.signal,
      output,
      ended.signal !== null
        ? `was ended by ${ended.signal}`
        : `exited with code ${ended.code}`
    )
  }

  const outcome = lastJsonLine(stdout)
  if (outcome === undefined) {
    throw new FixtureFailedError(
      fixture,
      ended.code,
      ended.signal,
      output,
      'exited cleanly without reporting an outcome, so there is nothing to ' +
        'say it did what it was written to do'
    )
  }
  return { outcome: outcome as T, elapsedMs, output }
}

/**
 * The parent's environment (for `PATH` and whatever the native addon reads),
 * with the connection variables set from `env` or removed, never left as the
 * shell had them: under the mock only globalSetup knows the connection string.
 */
function childEnvironment(env: TestEnv | undefined): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {
    ...process.env,
    // Named rather than discovered, so a `tsconfig.json` added under
    // `test/` cannot silently change how every fixture compiles.
    TS_NODE_PROJECT: join(REPO_ROOT, 'tsconfig.json'),
    TS_NODE_TRANSPILE_ONLY: 'true',
  }
  for (const name of Object.values(EXIT_CHILD_ENV)) {
    delete out[name]
  }
  if (env) {
    const { connectionString, username, password } = env.connection
    out[EXIT_CHILD_ENV.connectionString] = connectionString
    out[EXIT_CHILD_ENV.bucket] = env.config.bucket
    if (username !== undefined) {
      out[EXIT_CHILD_ENV.username] = username
    }
    if (password !== undefined) {
      out[EXIT_CHILD_ENV.password] = password
    }
  }
  return out
}

function lastJsonLine(stdout: string): unknown {
  const lines = stdout.split('\n').map((l) => l.trim())
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].startsWith('{')) {
      continue
    }
    try {
      return JSON.parse(lines[i])
    } catch {
      continue
    }
  }
  return undefined
}

function tail(output: string): string {
  const lines = output.trimEnd().split('\n')
  if (output.trim() === '') {
    return '(it printed nothing)'
  }
  const shown = lines.slice(-OUTPUT_TAIL_LINES)
  const cut = lines.length - shown.length
  return (
    (cut > 0 ? `(last ${shown.length} of ${lines.length} lines)\n` : '') +
    shown.join('\n')
  )
}
