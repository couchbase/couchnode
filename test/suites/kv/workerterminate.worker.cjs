// The worker `workerterminate.exitfixture.ts` terminates. It connects, starts
// operations without awaiting them, and tells the parent once they are in
// flight. In `settle` mode it waits for them to finish first, which is the
// control: the same worker and connection with nothing pending at terminate.
//
// Plain .cjs for the reason `workerthread.worker.cjs` gives. The fixture's own
// `--require ts-node/register/transpile-only` is inherited through the
// worker's `execArgv`, so ts-node is registered here only when it is not
// already, to avoid compiling every module twice.
if (!process[Symbol.for('ts-node.register.instance')]) {
  require('ts-node').register({ transpileOnly: true })
}

const worker = require('worker_threads')
const couchbase = require('../../../lib/couchbase')

const { connStr, connOpts, bucketName, keyPrefix, inflight, settle } =
  worker.workerData

async function doWork() {
  const cluster = await couchbase.connect(connStr, connOpts)
  const coll = cluster.bucket(bucketName).defaultCollection()
  // The bucket opens asynchronously. Waiting on one operation first makes
  // sure the batch below is dispatched to the server rather than queued
  // behind the bucket, which is a different path.
  await coll.get(`${keyPrefix}warmup`, { timeout: 25000 }).catch(() => undefined)

  const pending = []
  for (let i = 0; i < inflight; i++) {
    // Missing keys: a not-found answer is still a completion, and nothing
    // needs cleaning up afterwards.
    pending.push(coll.get(`${keyPrefix}${i}`).catch(() => undefined))
  }
  if (settle) {
    await Promise.all(pending)
  }
  // Intentionally no cluster.close(): terminate is the teardown under test.
  worker.parentPort.postMessage({ stage: settle ? 'settled' : 'in-flight' })
  // Stay alive, so terminate is what ends this thread.
  setTimeout(() => undefined, 10 * 60_000)
}

doWork().catch((e) => {
  worker.parentPort.postMessage({
    stage: 'error',
    error: { message: String(e && e.message), stack: e && e.stack },
  })
})
