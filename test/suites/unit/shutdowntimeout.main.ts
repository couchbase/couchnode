// The body of both `shutdowntimeoutmain*.exitfixture.ts` files: a connection
// on the main thread, its close stalled, and then nothing left to do, so the
// process exit is what shuts it down. Two fixture files rather than a switch,
// because a fixture inherits the parent's environment and so cannot be told
// apart by a variable.

import binding from '../../../lib/binding'
import { runExitFixture } from '../../infra/exitchild'
import type { MainExitOutcome } from './shutdowntimeout.cases'
import { STALL_MS } from './shutdowntimeout.cases'

/** Held for the life of the process, so no finalizer shuts it down first. */
const held: unknown[] = []

/**
 * `timeout` is set as `CN_SHUTDOWN_TIMEOUT_MS` before the connection is made,
 * which is when the addon reads it.
 */
export function runMainExit(timeout: string): void {
  runExitFixture(async () => {
    process.env.CN_SHUTDOWN_TIMEOUT_MS = timeout
    const conn = new binding.Connection()
    conn._stallIo(STALL_MS)
    held.push(conn)
    const outcome: MainExitOutcome = { timeout, endedAt: Date.now() }
    return { ...outcome }
  })
}
