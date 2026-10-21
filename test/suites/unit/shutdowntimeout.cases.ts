// What `shutdowntimeout.test.ts` and its exit fixtures share: the stall, the
// cases, and the outcomes the fixtures report. It imports nothing, so the test
// can read it without loading the addon.

/** How long a fixture blocks its connection's IO thread. */
export const STALL_MS = 1500

/** A teardown faster than this gave up on the close; slower, it waited. */
export const ABANDONED_UNDER_MS = STALL_MS / 2

/** The bound when `CN_SHUTDOWN_TIMEOUT_MS` is unset or not a number. */
export const DEFAULT_TIMEOUT_MS = 5000

export interface WorkerCase {
  readonly name: string
  /** The worker's `CN_SHUTDOWN_TIMEOUT_MS`, left unset when undefined. */
  readonly timeout: string | undefined
  /** Whether the terminate gives up on the close before the stall ends. */
  readonly abandons: boolean
  /** The bound the addon should have read. */
  readonly boundMs: number
}

export const WORKER_CASES: readonly WorkerCase[] = [
  {
    name: 'a bound shorter than the stall',
    timeout: '100',
    abandons: true,
    boundMs: 100,
  },
  { name: 'a bound of 0', timeout: '0', abandons: true, boundMs: 0 },
  {
    name: 'a bound longer than the stall',
    timeout: '10000',
    abandons: false,
    boundMs: 10_000,
  },
  {
    name: 'the default bound',
    timeout: undefined,
    abandons: false,
    boundMs: DEFAULT_TIMEOUT_MS,
  },
  {
    name: 'the default bound, for a value that is not a number',
    timeout: 'soon',
    abandons: false,
    boundMs: DEFAULT_TIMEOUT_MS,
  },
]

/** What `shutdowntimeout.exitfixture.ts` reports: one terminate per case. */
export interface WorkerCasesOutcome {
  readonly terminateMs: Record<string, number>
}

/** What a `shutdowntimeoutmain*.exitfixture.ts` reports. */
export interface MainExitOutcome {
  readonly timeout: string
  /**
   * `Date.now()` once the fixture has nothing left to do, so the parent can
   * tell how long the teardown after it took.
   */
  readonly endedAt: number
}
