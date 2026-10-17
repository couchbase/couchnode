import { join } from 'path'

import { expect } from 'vitest'

import { withCtx } from '../../asserts/ctx'
import { ServerFeature, TestProtocol } from '../../infra/capabilities'
import { expectProcessExits } from '../../infra/exit'
import { CollectionStrategy } from '../../infra/requirements'
import { defineSuite } from '../../infra/suite'
import {
  RETURNED_UNDER_MS,
  type TeardownStallOutcome,
} from './teardownstall.cases'
import { KEYSPACE_ENV } from './teardownorder.cases'

// Terminating a worker whose IO thread is stalled, with and without a
// transaction operation in flight. The connection's shutdown destroys the
// transactions objects itself, off the JS thread, so the terminate returns at
// its bound rather than waiting in a finalizer for the core's destructor,
// which closes the object again through the cluster. With an operation in
// flight it keeps the objects until the IO thread has stopped, since the
// operation still uses them.

const FIXTURES = join(import.meta.dirname, 'exitfixtures')

/**
 * Two workers, each compiling `lib/` under ts-node, connecting and
 * committing. Long enough for a `stalled` terminate that waits out the whole
 * stall to report its time rather than time out.
 */
const EXIT_BUDGET_MS = 150_000
const TEST_TIMEOUT_MS = EXIT_BUDGET_MS + 15_000

defineSuite(
  '#worker-threads transactions teardown stall',
  {
    features: [ServerFeature.Transactions],
    collection: CollectionStrategy.Named,
    // Slow: every case starts a worker, connects and commits from it.
    tier: 'nightly',
    // The shutdown belongs to the native addon; couchbase2 has none, so there
    // is nothing to prove under it.
    protocols: [TestProtocol.Classic],
  },
  ({ test }) => {
    test(
      'returns at the bound when stalled, with or without a commit in flight',
      async ({ collection, env }) => {
        const { outcome } = await expectProcessExits<TeardownStallOutcome>(
          join(FIXTURES, 'teardownstall.exitfixture.ts'),
          {
            env,
            withinMs: EXIT_BUDGET_MS,
            vars: {
              [KEYSPACE_ENV.bucket]: collection.scope.bucket.name,
              [KEYSPACE_ENV.scope]: collection.scope.name,
              [KEYSPACE_ENV.collection]: collection.name,
            },
          }
        )
        for (const [mode, { terminateMs }] of Object.entries(outcome.cases)) {
          expect(
            terminateMs,
            withCtx(
              `${mode}: terminate returned at its bound`,
              env.ctx({ op: 'terminate', extra: mode })
            )
          ).toBeLessThan(RETURNED_UNDER_MS)
        }
      },
      TEST_TIMEOUT_MS
    )
  }
)
