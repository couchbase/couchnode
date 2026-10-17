// What `teardownorder.test.ts` and its exit fixture share. Imports nothing, so
// the test can read it without loading the addon.

/** Where the test passes its leased keyspace to the fixture. */
export const KEYSPACE_ENV = {
  bucket: 'CNTXNBUCKET',
  scope: 'CNTXNSCOPE',
  collection: 'CNTXNCOLLECTION',
} as const

/**
 * `unclosed` terminates a worker whose cluster and transactions are both still
 * open. `collected` drops the worker's cluster and collects it first, so its
 * finalizers run, in whatever order, before the terminate.
 */
export type TeardownCase = 'unclosed' | 'collected'

export const TEARDOWN_CASES: readonly TeardownCase[] = ['unclosed', 'collected']

export interface CaseOutcome {
  /** Client ids the worker's transactions added to the client record. */
  registered: string[]
  /** Of those, the ones still in the record once the wait ran out. */
  remaining: string[]
  /** For `collected`, whether the worker saw its connection collected. */
  collected?: boolean
}

export interface TeardownOrderOutcome {
  cases: Record<TeardownCase, CaseOutcome>
}
