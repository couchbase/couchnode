// Terminates workers while their cluster is still closing.
// `workerclose.test.ts` expects the process to exit.

import { runCloseRounds } from '../workerclose.rounds'

runCloseRounds(false)
