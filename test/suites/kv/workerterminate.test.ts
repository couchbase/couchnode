import { join } from 'path'

import { expect } from 'vitest'

import { withCtx } from '../../asserts/ctx'
import { ServerFeature, TestProtocol } from '../../infra/capabilities'
import { expectProcessExits } from '../../infra/exit'
import { defineSuite } from '../../infra/suite'
import type { TerminateRoundsOutcome } from './workerterminate.rounds'

// Terminating a worker thread that holds a connection, with operations still
// unanswered. Every pending operation holds a thread-safe function the native
// addon releases only when the operation's callback runs. One never answered
// leaves a release that never happens, and the symptom is a process that does
// not exit. An operation answered while the worker is terminating runs its
// callback when JS can no longer run, and the symptom there is an abort of the
// whole process. Either one ends the test runner, which is why this runs in a
// fixture process of its own.
//
// The settled case is the control. It is the same worker, connection and
// rounds with nothing pending at terminate, so a failure of the in-flight case
// alone points at the pending operations rather than at the harness.

const FIXTURES = join(import.meta.dirname, 'exitfixtures')

/**
 * Three rounds, each a worker that compiles `lib/` under ts-node and opens its
 * own connection. Generous, because a slow pass is not the defect: the defect
 * is never exiting at all.
 */
const EXIT_BUDGET_MS = 60_000
const TEST_TIMEOUT_MS = EXIT_BUDGET_MS + 15_000

defineSuite(
  '#worker-threads terminate',
  {
    features: [ServerFeature.KeyValue],
    // Slow: every round starts a worker and connects from it.
    tier: 'nightly',
    // The thread-safe functions belong to the native addon; couchbase2 has
    // none, so there is nothing to prove under it.
    protocols: [TestProtocol.Classic],
  },
  ({ test, known }) => {
    test(
      'exits after terminating workers whose operations had all answered',
      async ({ env }) => {
        const { outcome } = await expectProcessExits<TerminateRoundsOutcome>(
          join(FIXTURES, 'workerterminatesettled.exitfixture.ts'),
          { env, withinMs: EXIT_BUDGET_MS }
        )
        expect(
          outcome.terminateMs,
          withCtx('one terminate per round', env.ctx({ op: 'terminate' }))
        ).toHaveLength(outcome.rounds)
      },
      TEST_TIMEOUT_MS
    )

    test.skipIf(known('worker-terminate-cancel-after-env'))(
      'exits after terminating workers with key-value operations in flight',
      async ({ env }) => {
        const { outcome } = await expectProcessExits<TerminateRoundsOutcome>(
          join(FIXTURES, 'workerterminate.exitfixture.ts'),
          { env, withinMs: EXIT_BUDGET_MS }
        )
        expect(
          outcome.settle,
          withCtx('ran the in-flight fixture', env.ctx({ op: 'terminate' }))
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
