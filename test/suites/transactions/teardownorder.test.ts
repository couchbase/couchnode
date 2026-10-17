import { join } from 'path'

import { expect } from 'vitest'

import { withCtx } from '../../asserts/ctx'
import { ServerFeature, TestProtocol } from '../../infra/capabilities'
import { expectProcessExits } from '../../infra/exit'
import { CollectionStrategy } from '../../infra/requirements'
import { defineSuite } from '../../infra/suite'
import {
  KEYSPACE_ENV,
  TEARDOWN_CASES,
  type TeardownOrderOutcome,
} from './teardownorder.cases'

// Tearing down a connection that still has transactions open. Closing the
// transactions removes this client from the client record, which needs the
// cluster, so the teardown has to close the transactions first. When it closes
// the cluster first, the removal fails and the record keeps the client until
// it expires. Each case ends with a worker terminate, in a fixture process of
// its own, since a teardown that hangs would otherwise hang the test runner.
//
// The transactions use the suite's collection as their metadata collection,
// so the record there holds no clients but the workers'.

const FIXTURES = join(import.meta.dirname, 'exitfixtures')

/**
 * Two workers, each compiling `lib/` under ts-node, connecting and
 * committing, with up to two record waits apiece. Generous, because a slow
 * pass is not the defect.
 */
const EXIT_BUDGET_MS = 90_000
const TEST_TIMEOUT_MS = EXIT_BUDGET_MS + 15_000

defineSuite(
  '#worker-threads transactions teardown order',
  {
    features: [ServerFeature.Transactions],
    collection: CollectionStrategy.Named,
    // Slow: every case starts a worker, connects and commits from it.
    tier: 'nightly',
    // The teardown order belongs to the native addon; couchbase2 has none, so
    // there is nothing to prove under it.
    protocols: [TestProtocol.Classic],
  },
  ({ test }) => {
    test(
      'closes transactions before the cluster at teardown',
      async ({ collection, env }) => {
        const { outcome } = await expectProcessExits<TeardownOrderOutcome>(
          join(FIXTURES, 'teardownorder.exitfixture.ts'),
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
        for (const mode of TEARDOWN_CASES) {
          const result = outcome.cases[mode]
          const ctx = env.ctx({ op: 'terminate', extra: mode })
          // The positive control: without a registration there is nothing
          // for the teardown to remove.
          expect(
            result.registered,
            withCtx(`${mode}: registered one client`, ctx)
          ).toHaveLength(1)
          if (mode === 'collected') {
            expect(
              result.collected,
              withCtx('collected: connection collected before terminate', ctx)
            ).toBe(true)
          }
          expect(
            result.remaining,
            withCtx(`${mode}: client removed at teardown`, ctx)
          ).toEqual([])
        }
      },
      TEST_TIMEOUT_MS
    )
  }
)
