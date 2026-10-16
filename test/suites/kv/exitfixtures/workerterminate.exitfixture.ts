// Terminates workers with key-value operations still in flight.
// `workerterminate.test.ts` expects the process to exit.

import { runTerminateRounds } from '../workerterminate.rounds'

runTerminateRounds(false)
