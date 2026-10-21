// Exits the main thread with a connection's close stalled, under a bound
// shorter than the stall. `shutdowntimeout.test.ts` expects the exit not to
// wait for the stall.

import { runMainExit } from '../shutdowntimeout.main'

runMainExit('100')
