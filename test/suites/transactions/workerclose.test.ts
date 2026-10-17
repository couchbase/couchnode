import { join } from 'path'

import { expect } from 'vitest'

import { withCtx } from '../../asserts/ctx'
import { ServerFeature, TestProtocol } from '../../infra/capabilities'
import { expectProcessExits } from '../../infra/exit'
import { defineSuite } from '../../infra/suite'
import type { CloseRoundsOutcome } from './workerclose.rounds'

// Terminating a worker thread while its cluster is closing. Closing
// transactions runs on a thread of its own, which can outlive the worker. Its
// callback must then be skipped, since JS can no longer run, and the thread
// still running must not keep the worker's teardown from finishing. The
// symptom of the first is an abort of the whole process, and of the second a
// process that does not exit. Either one ends the test runner, which is why
// this runs in a fixture process of its own.
//
// The settled case is the control. It is the same worker, connection and
// rounds with the close finished at terminate, so a failure of the closing
// case alone points at the close rather than at the harness.

const FIXTURES = join(import.meta.dirname, 'exitfixtures')

/**
 * Three rounds, each a worker that compiles `lib/` under ts-node, opens its
 * own connection and commits a transaction. Generous, because a slow pass is
 * not the defect: the defect is never exiting at all.
 */
const EXIT_BUDGET_MS = 60_000
const TEST_TIMEOUT_MS = EXIT_BUDGET_MS + 15_000

defineSuite(
  '#worker-threads terminate during transactions close',
  {
    features: [ServerFeature.Transactions],
    // Slow: every round starts a worker, connects and commits from it.
    tier: 'nightly',
    // The close thread belongs to the native addon; couchbase2 has none, so
    // there is nothing to prove under it.
    protocols: [TestProtocol.Classic],
  },
  ({ test }) => {
    test(
      'exits after terminating workers whose close had finished',
      async ({ env }) => {
        const { outcome } = await expectProcessExits<CloseRoundsOutcome>(
          join(FIXTURES, 'workerclosesettled.exitfixture.ts'),
          { env, withinMs: EXIT_BUDGET_MS }
        )
        expect(
          outcome.terminateMs,
          withCtx('one terminate per round', env.ctx({ op: 'terminate' }))
        ).toHaveLength(outcome.rounds)
      },
      TEST_TIMEOUT_MS
    )

    test(
      'exits after terminating workers with a close running',
      async ({ env }) => {
        const { outcome } = await expectProcessExits<CloseRoundsOutcome>(
          join(FIXTURES, 'workerclose.exitfixture.ts'),
          { env, withinMs: EXIT_BUDGET_MS }
        )
        expect(
          outcome.settle,
          withCtx('ran the closing fixture', env.ctx({ op: 'terminate' }))
        ).toBe(false)
        expect(
          outcome.terminateMs,
          withCtx('one terminate per round', env.ctx({ op: 'terminate' }))
        ).toHaveLength(outcome.rounds)
      },
      TEST_TIMEOUT_MS
    )
  }
)
