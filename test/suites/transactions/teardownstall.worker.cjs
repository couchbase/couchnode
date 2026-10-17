// The worker `teardownstall.exitfixture.ts` terminates. It connects with the
// fixture's keyspace as its transactions metadata collection, then sets up
// one case and reports, staying alive so terminate is what ends this thread.
//
// `committing` inserts a document in a transaction and stalls the IO thread,
// so the commit that follows is queued behind the stall when the parent is
// told it has started, and is still in flight at the terminate. `stalled`
// commits a transaction, closes the transactions, and then stalls the IO
// thread.
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

const { connStr, connOpts, keyspace, key, mode, stallMs } = worker.workerData

// Holds the cluster once setup returns, so a collection cannot shut it down
// before the terminate.
const held = []

function collection(cluster) {
  return cluster
    .bucket(keyspace.bucket)
    .scope(keyspace.scope)
    .collection(keyspace.collection)
}

// Reports once the commit has been handed to the addon, rather than when the
// transaction lambda returns, so the commit is in flight at the terminate.
// `_commit` calls the addon before its first await. The addon's own `commit`
// cannot be wrapped: Node-API defines it read only, and assigning to it here
// fails without an error.
function reportCommitStarted() {
  const proto = couchbase.TransactionAttemptContext.prototype
  const commit = proto._commit
  proto._commit = function () {
    const result = commit.call(this)
    worker.parentPort.postMessage({ stage: 'committing' })
    return result
  }
}

async function committing(cluster) {
  reportCommitStarted()
  const coll = collection(cluster)
  // The transaction never settles here: its callback is dropped when the
  // worker is torn down.
  cluster
    .transactions()
    .run(async (attempt) => {
      await attempt.insert(coll, key, { foo: 'bar' })
      cluster._conn._stallIo(stallMs)
    })
    .catch(() => undefined)
}

async function stalled(cluster) {
  const coll = collection(cluster)
  await cluster.transactions().run(async (attempt) => {
    await attempt.insert(coll, key, { foo: 'bar' })
  })
  await coll.remove(key)
  await cluster.transactions()._close()
  cluster._conn._stallIo(stallMs)
  worker.parentPort.postMessage({ stage: 'ready' })
}

async function doWork() {
  const cluster = await couchbase.connect(connStr, {
    ...connOpts,
    transactions: { metadataCollection: keyspace },
  })
  held.push(cluster)
  // A KV operation first, so a connection still opening fails here as a
  // plain timeout rather than inside the transaction.
  await collection(cluster).exists(key)
  await (mode === 'committing' ? committing(cluster) : stalled(cluster))
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
