// The worker `workerclose.exitfixture.ts` terminates. It connects, commits a
// transaction so the client has a record to remove on close, starts
// `cluster.close()` without awaiting it, and tells the parent the close is
// running. In `settle` mode it waits for the close to finish first, which is
// the control: the same worker and connection with no close running at
// terminate.
//
// Plain .cjs for the reason `../kv/workerthread.worker.cjs` gives. The
// fixture's own `--require ts-node/register/transpile-only` is inherited
// through the worker's `execArgv`, so ts-node is registered here only when it
// is not already, to avoid compiling every module twice.
if (!process[Symbol.for('ts-node.register.instance')]) {
  require('ts-node').register({ transpileOnly: true })
}

const worker = require('worker_threads')
const couchbase = require('../../../lib/couchbase')

const { connStr, connOpts, bucketName, key, settle } = worker.workerData

async function doWork() {
  const cluster = await couchbase.connect(connStr, connOpts)
  const coll = cluster.bucket(bucketName).defaultCollection()
  // A KV operation first, so a connection still opening fails here as a
  // plain timeout rather than inside the transaction.
  await coll.exists(key)
  await cluster.transactions().run(async (attempt) => {
    await attempt.insert(coll, key, { foo: 'bar' })
  })
  // The client record is what the close removes; the document is not needed.
  await coll.remove(key)

  const closing = cluster.close().catch(() => undefined)
  if (settle) {
    await closing
  }
  worker.parentPort.postMessage({ stage: settle ? 'closed' : 'closing' })
  // Stay alive, so terminate is what ends this thread.
  setTimeout(() => undefined, 10 * 60_000)
}

doWork().catch((e) => {
  // A transaction failure says only that it failed; its cause says why.
  const cause = e && e.cause
  const stack = cause
    ? `${e.stack}\nCaused by: ${cause.stack || cause}`
    : e && e.stack
  worker.parentPort.postMessage({
    stage: 'error',
    error: { message: String(e && e.message), stack },
  })
})
