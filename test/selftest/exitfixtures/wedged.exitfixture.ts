// Reports success and then never exits. `selftest/exit.test.ts` expects it to
// be killed at its budget.
//
// A referenced timer stands in for a native callback the core never makes:
// both keep the loop alive with every assertion passed.

import { runExitFixture } from '../../infra/exitchild'

runExitFixture(async () => {
  setTimeout(() => undefined, 10 * 60_000)
  return { armed: true }
})
