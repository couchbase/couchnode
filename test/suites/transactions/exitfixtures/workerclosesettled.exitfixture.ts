// The control for `workerclose.exitfixture.ts`: the same rounds, with the
// close finished before the worker is terminated.

import { runCloseRounds } from '../workerclose.rounds'

runCloseRounds(true)
