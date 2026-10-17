// What `teardownstall.test.ts` and its exit fixture share. Imports nothing, so
// the test can read it without loading the addon.

/**
 * Each case stalls a worker's IO thread for far longer than its bound and
 * terminates it. `committing` stalls with a commit queued behind the stall, so
 * the shutdown runs with a transaction operation in flight. `stalled` commits,
 * closes the worker's transactions, and then stalls, so none is.
 */
export type StallCase = 'committing' | 'stalled'

export const STALL_CASES: readonly StallCase[] = ['committing', 'stalled']

/** How long each case blocks the IO thread. */
export const STALL_MS = 60_000

/** Each case's `CN_SHUTDOWN_TIMEOUT_MS`. */
export const STALL_BOUND_MS = 1000

/**
 * A terminate faster than this returned at its bound. One that waits out the
 * stall takes `STALL_MS`.
 */
export const RETURNED_UNDER_MS = 15_000

export interface CaseOutcome {
  terminateMs: number
}

export interface TeardownStallOutcome {
  cases: Record<StallCase, CaseOutcome>
}
