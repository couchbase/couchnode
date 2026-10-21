// Terminates a worker whose connection's close is stalled, once per case in
// `shutdowntimeout.cases.ts`. `shutdowntimeout.test.ts` expects the process
// to exit, and reads each terminate's duration from the outcome.
//
// In a process of its own because a bound that does not hold leaves
// `terminate()` waiting on the worker, and a test runner that then tries to
// exit waits on it too.
//
// Each stage is printed as it is reached, so when the process does not exit
// the output tail names the case it stopped in.

import { join } from 'path'
import { Worker } from 'worker_threads'

import { runExitFixture } from '../../../infra/exitchild'
import { STALL_MS, WORKER_CASES } from '../shutdowntimeout.cases'
import type { WorkerCase, WorkerCasesOutcome } from '../shutdowntimeout.cases'

const WORKER = join(__dirname, '..', 'shutdowntimeout.worker.cjs')

function progress(fields: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify({ progress: true, ...fields })}\n`)
}

/**
 * Starts a worker with its IO thread stalled, terminates it, and returns how
 * long the terminate took. The bound goes through the worker's `env` option,
 * which `getenv` in the addon cannot see. This process's environment is the
 * same for every case, so a bound read from it would give every case the same
 * wait, and either the abandoning cases or the waiting ones would fail.
 */
async function terminateStalled(c: WorkerCase): Promise<number> {
  const env: NodeJS.ProcessEnv = { ...process.env }
  delete env.CN_SHUTDOWN_TIMEOUT_MS
  if (c.timeout !== undefined) {
    env.CN_SHUTDOWN_TIMEOUT_MS = c.timeout
  }

  const work = new Worker(WORKER, { env, workerData: { stallMs: STALL_MS } })
  try {
    await new Promise<void>((resolve, reject) => {
      work.once('message', () => resolve())
      work.once('error', reject)
      work.once('exit', (code) =>
        reject(new Error(`worker exited with code ${code} before stalling`))
      )
    })
  } catch (e) {
    await work.terminate()
    throw e
  }

  progress({ case: c.name, stage: 'stalled, terminating' })
  const started = performance.now()
  await work.terminate()
  const ms = Math.round(performance.now() - started)
  progress({ case: c.name, stage: 'terminated', ms })
  return ms
}

runExitFixture(async () => {
  const terminateMs: Record<string, number> = {}
  for (const c of WORKER_CASES) {
    terminateMs[c.name] = await terminateStalled(c)
  }
  const outcome: WorkerCasesOutcome = { terminateMs }
  return { ...outcome }
})
