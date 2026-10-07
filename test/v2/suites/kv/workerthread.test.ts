import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'

import { expect } from 'vitest'

import { withCtx } from '../../asserts/ctx'
import { ServerFeature, TestProtocol } from '../../infra/capabilities'
import { defineSuite } from '../../infra/suite'

// A `.cjs` file with its own `ts-node` registration: a worker_thread spawned
// from a Vitest child gets none of Vitest's module pipeline. Resolved from this
// module's URL so the path holds whatever the working directory.
const WORKER = fileURLToPath(
  new URL('./workerthread.worker.cjs', import.meta.url)
)

/**
 * What the worker reads from `workerData`. The `.cjs` file destructures these
 * names unchecked, so this is the one place the contract is written down.
 */
interface WorkerInput {
  connStr: string
  connOpts: { username?: string; password?: string }
  bucketName: string
  testKey: string
}

/** Structured-cloned, so plain data throughout. */
interface WorkerReply {
  success?: boolean
  error?: { message: string; stack?: string }
  cas?: string
  value?: unknown
  pid?: number
}

/**
 * Run the worker to its first message and terminate it, on every path.
 *
 * The worker never closes its cluster (that is what the test exercises), so
 * `terminate()` is the only cleanup; a worker left alive holds the process
 * open. The `exit` handler rejects whatever the code, so a worker that exits 0
 * without posting fails this test instead of hanging to a suite timeout.
 */
async function runWorker(workerData: WorkerInput): Promise<WorkerReply> {
  const work = new Worker(WORKER, { workerData })
  try {
    return await new Promise<WorkerReply>((resolve, reject) => {
      work.once('message', resolve)
      work.once('error', reject)
      work.once('exit', (code) =>
        reject(
          new Error(`Worker exited with code ${code} before reporting a result`)
        )
      )
    })
  } finally {
    await work.terminate()
  }
}

defineSuite(
  '#worker-threads',
  {
    features: [ServerFeature.KeyValue],
    // Slow: most of the test is the worker opening a connection of its own.
    tier: 'nightly',
    // Asserts the native addon survives loading on a worker thread;
    // couchbase2 needs no addon, so there is nothing to prove under it.
    protocols: [TestProtocol.Classic],
  },
  ({ test }) => {
    test('should start a worker and complete an operation', async ({
      collection,
      env,
      runState,
    }) => {
      const testKey = env.key()
      const c = env.ctx({
        op: 'worker round trip',
        key: testKey,
        collection: collection.name,
      })

      try {
        // The worker connects for itself: the suite verifies a connection made
        // inside a worker thread is cleaned up with the thread's context. It is
        // handed the env's connection details rather than re-reading the
        // environment, so it also runs under a mock backend.
        const res = await runWorker({
          connStr: runState.connection.connectionString,
          connOpts: {
            username: runState.connection.username,
            password: runState.connection.password,
          },
          bucketName: env.config.bucket,
          testKey,
        })

        // Asserted here rather than in the worker, so a failure carries a diff
        // and the usual context.
        expect(
          res.error?.stack ?? res.error?.message,
          withCtx('worker reported an error', c)
        ).toBeUndefined()
        expect(res.success, withCtx('worker did not report success', c)).toBe(
          true
        )
        expect(res.cas, withCtx('worker get returned no cas', c)).toBeTruthy()
        expect(res.value, withCtx('document content', c)).toEqual('bar')
        // Same OS process: a crash in the worker takes the Vitest child with
        // it. Asserted so a move to child_process cannot silently weaken what
        // this covers.
        expect(
          res.pid,
          withCtx('worker did not run in the test process', c)
        ).toBe(process.pid)
      } finally {
        await collection.remove(testKey).catch(() => undefined)
      }
    }, 45_000)
  }
)
