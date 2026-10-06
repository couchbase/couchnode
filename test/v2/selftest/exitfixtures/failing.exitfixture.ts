// Fails its expectation and exits. `selftest/exit.test.ts` expects the
// failure, not a clean exit, to be what it reports.

import { runExitFixture } from '../../infra/exitchild'

runExitFixture(async () => {
  throw new Error('the expectation this fixture exists to fail')
})
