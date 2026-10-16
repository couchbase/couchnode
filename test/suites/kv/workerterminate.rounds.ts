// The body of both `workerterminate*.exitfixture.ts` files: terminate a worker
// thread that holds a connection, round after round, then have nothing left to
// do. Two fixture files rather than a switch, because a fixture inherits the
// parent's environment and so cannot be told apart by a variable.
//
// Each stage is printed as it is reached, so when the process does not exit
// the output tail says where it stopped: still inside `terminate()` (the
// worker's teardown never finished) or past every round (something still holds
// this thread's loop open).

import { join } from 'path'
import { Worker } from 'worker_threads'

import { EXIT_CHILD_ENV, runExitFixture } from '../../infra/exitchild'

const WORKER = join(__dirname, 'workerterminate.worker.cjs')

const ROUNDS = 3
/** Enough that some are still unanswered when `terminate()` runs. */
const INFLIGHT = 256

interface WorkerMessage {
  stage: 'in-flight' | 'settled' | 'error'
  error?: { message: string; stack?: string }
}

export interface TerminateRoundsOutcome {
  rounds: number
  inflight: number
  settle: boolean
  terminateMs: number[]
}

function progress(fields: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify({ progress: true, ...fields })}\n`)
}

async function round(n: number, settle: boolean): Promise<number> {
  const work = new Worker(WORKER, {
    workerData: {
      connStr: process.env[EXIT_CHILD_ENV.connectionString],
      connOpts: {
        username: process.env[EXIT_CHILD_ENV.username],
        password: process.env[EXIT_CHILD_ENV.password],
      },
      bucketName: process.env[EXIT_CHILD_ENV.bucket],
      keyPrefix: `workerterminate-${process.pid}-${n}-`,
      inflight: INFLIGHT,
      settle,
    },
  })
  const msg = await new Promise<WorkerMessage>((resolve, reject) => {
    work.once('message', resolve)
    work.once('error', reject)
    work.once('exit', (code) =>
      reject(new Error(`worker exited with code ${code} before reporting`))
    )
  })
  if (msg.stage === 'error') {
    await work.terminate()
    throw new Error(
      `worker failed: ${msg.error?.stack ?? msg.error?.message ?? 'unknown'}`
    )
  }
  progress({ round: n, stage: `${msg.stage}, terminating` })
  const started = performance.now()
  await work.terminate()
  const ms = Math.round(performance.now() - started)
  progress({ round: n, stage: 'terminated', ms })
  return ms
}

/**
 * `settle` waits for every operation to answer before terminating: the
 * control, with the same worker and connection and nothing pending.
 */
export function runTerminateRounds(settle: boolean): void {
  runExitFixture(async () => {
    const terminateMs: number[] = []
    for (let n = 0; n < ROUNDS; n++) {
      terminateMs.push(await round(n, settle))
    }
    const outcome: TerminateRoundsOutcome = {
      rounds: ROUNDS,
      inflight: INFLIGHT,
      settle,
      terminateMs,
    }
    return { ...outcome }
  })
}
