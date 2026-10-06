// Loads the SDK and ends. `selftest/exit.test.ts` expects it to exit cleanly.
//
// Loading the SDK proves the fixture loader with no cluster, and it reports
// which file it got: resolving `dist/` instead of `lib/` would test the last
// build rather than the source.

import * as couchbase from '../../../../lib/couchbase'
import { runExitFixture } from '../../infra/exitchild'

runExitFixture(async () => ({
  connectType: typeof couchbase.connect,
  resolvedFrom: require.resolve('../../../../lib/couchbase'),
}))
