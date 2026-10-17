// Terminates a worker for each case in `teardownstall.cases.ts`, and reports
// how long each terminate took. `teardownstall.test.ts` reads the outcome.
//
// In a process of its own because a teardown that waits out the stall leaves
// `terminate()` waiting on the worker, and a test runner that then tries to
// exit waits on it too.

import { join } from 'path'
import { Worker } from 'worker_threads'

import { EXIT_CHILD_ENV, runExitFixture } from '../../../infra/exitchild'
import {
  STALL_BOUND_MS,
  STALL_CASES,
  STALL_MS,
  type CaseOutcome,
  type StallCase,
  type TeardownStallOutcome,
} from '../teardownstall.cases'
import { KEYSPACE_ENV } from '../teardownorder.cases'

const WORKER = join(__dirname, '..', 'teardownstall.worker.cjs')

interface WorkerMessage {
  stage: 'committing' | 'ready' | 'error'
  error?: { message: string; stack?: string }
}

function progress(fields: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify({ progress: true, ...fields })}\n`)
}

function env(name: string): string {
  const value = process.env[name]
  if (value === undefined) {
    throw new Error(`${name} is not set`)
  }
  return value
}

function nextMessage(work: Worker): Promise<WorkerMessage> {
  return new Promise<WorkerMessage>((resolve, reject) => {
    const onExit = (code: number) =>
      reject(new Error(`worker exited with code ${code} before reporting`))
    work.once('message', (msg: WorkerMessage) => {
      work.off('error', reject)
      work.off('exit', onExit)
      resolve(msg)
    })
    work.once('error', reject)
    work.once('exit', onExit)
  })
}

async function runCase(
  mode: StallCase,
  keyspace: { bucket: string; scope: string; collection: string }
): Promise<CaseOutcome> {
  const key = `teardownstall-${process.pid}-${mode}`
  // The bound goes through the worker's `env` option, which is the
  // environment the addon reads it from.
  const workerEnv: NodeJS.ProcessEnv = {
    ...process.env,
    CN_SHUTDOWN_TIMEOUT_MS: String(STALL_BOUND_MS),
  }
  const work = new Worker(WORKER, {
    env: workerEnv,
    workerData: {
      connStr: env(EXIT_CHILD_ENV.connectionString),
      connOpts: {
        username: process.env[EXIT_CHILD_ENV.username],
        password: process.env[EXIT_CHILD_ENV.password],
      },
      keyspace,
      key,
      mode,
      stallMs: STALL_MS,
    },
  })

  const expected = mode === 'committing' ? 'committing' : 'ready'
  const msg = await nextMessage(work)
  if (msg.stage !== expected) {
    await work.terminate()
    throw new Error(
      `worker reported ${msg.stage} rather than ${expected}: ` +
        `${msg.error?.stack ?? msg.error?.message ?? ''}`
    )
  }

  progress({ mode, stage: `${msg.stage}, terminating` })
  const started = performance.now()
  await work.terminate()
  const terminateMs = Math.round(performance.now() - started)
  progress({ mode, stage: 'terminated', terminateMs })
  return { terminateMs }
}

runExitFixture(async () => {
  const keyspace = {
    bucket: env(KEYSPACE_ENV.bucket),
    scope: env(KEYSPACE_ENV.scope),
    collection: env(KEYSPACE_ENV.collection),
  }
  const cases = {} as Record<StallCase, CaseOutcome>
  for (const mode of STALL_CASES) {
    cases[mode] = await runCase(mode, keyspace)
  }
  const outcome: TeardownStallOutcome = { cases }
  return { ...outcome }
})
