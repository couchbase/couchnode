// Shared by the mock backend and `exit.ts`. A `spawn` handle keeps the parent's
// event loop referenced until the child exits, so a child left running hangs
// the run with no diagnostic.

import { ChildProcess } from 'child_process'

import { sleep } from '../retry'

const SIGTERM_GRACE_MS = 5_000

/**
 * SIGTERM, then SIGKILL, then await exit. Resolves only once the child is gone,
 * so a teardown never leaves one holding ports.
 */
export async function killChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return
  }

  const exited = new Promise<void>((resolve) => {
    child.once('exit', () => resolve())
  })

  child.kill('SIGTERM')
  const graceful = await Promise.race([
    exited.then(() => true),
    sleep(SIGTERM_GRACE_MS).then(() => false),
  ])
  if (!graceful) {
    child.kill('SIGKILL')
    await exited
  }
}
