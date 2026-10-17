// The body of both `workerclose*.exitfixture.ts` files: terminate a worker
// thread while its cluster is closing, round after round, then have nothing
// left to do. Two fixture files rather than a switch, because a fixture
// inherits the parent's environment and so cannot be told apart by a variable.
//
// Each stage is printed as it is reached, so when the process does not exit
// the output tail says where it stopped: still inside `terminate()` (the
// worker's teardown never finished) or past every round (something still holds
// this thread's loop open).

import { join } from 'path'
import { Worker } from 'worker_threads'

import { EXIT_CHILD_ENV, runExitFixture } from '../../infra/exitchild'

const WORKER = join(__dirname, 'workerclose.worker.cjs')

const ROUNDS = 3

interface WorkerMessage {
  stage: 'closing' | 'closed' | 'error'
  error?: { message: string; stack?: string }
}

export interface CloseRoundsOutcome {
  rounds: number
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
      key: `workerclose-${process.pid}-${n}`,
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
 * `settle` waits for the close to finish before terminating: the control,
 * with the same worker and connection and no close running.
 */
export function runCloseRounds(settle: boolean): void {
  runExitFixture(async () => {
    const terminateMs: number[] = []
    for (let n = 0; n < ROUNDS; n++) {
      terminateMs.push(await round(n, settle))
    }
    const outcome: CloseRoundsOutcome = {
      rounds: ROUNDS,
      settle,
      terminateMs,
    }
    return { ...outcome }
  })
}
