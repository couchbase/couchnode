// Exits the main thread with a connection's close stalled, under a bound
// longer than the stall. `shutdowntimeout.test.ts` expects the exit to wait.

import { runMainExit } from '../shutdowntimeout.main'

runMainExit('10000')
