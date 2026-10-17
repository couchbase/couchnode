// The worker `teardownorder.exitfixture.ts` terminates. It connects with the
// fixture's keyspace as its transactions metadata collection, so its client
// record lives where nothing else writes one, commits a transaction, and
// reports. On the parent's go ahead it either stays as it is (`unclosed`) or
// drops its cluster and collects it (`collected`), then reports again and
// stays alive, so terminate is what ends this thread.
//
// Plain .cjs for the reason `../kv/workerthread.worker.cjs` gives. The
// fixture's own `--require ts-node/register/transpile-only` is inherited
// through the worker's `execArgv`, so ts-node is registered here only when it
// is not already, to avoid compiling every module twice.
if (!process[Symbol.for('ts-node.register.instance')]) {
  require('ts-node').register({ transpileOnly: true })
}

const { setFlagsFromString } = require('v8')
const { runInNewContext } = require('vm')
const worker = require('worker_threads')
const couchbase = require('../../../lib/couchbase')

const { connStr, connOpts, keyspace, key, mode } = worker.workerData

const MAX_SWEEPS = 50

// Holds an `unclosed` cluster once `doWork` returns, so a collection cannot
// turn that case into the other one.
const held = []

async function commit() {
  const cluster = await couchbase.connect(connStr, {
    ...connOpts,
    transactions: { metadataCollection: keyspace },
  })
  const coll = cluster
    .bucket(keyspace.bucket)
    .scope(keyspace.scope)
    .collection(keyspace.collection)
  // A KV operation first, so a connection still opening fails here as a
  // plain timeout rather than inside the transaction.
  await coll.exists(key)
  await cluster.transactions().run(async (attempt) => {
    await attempt.insert(coll, key, { foo: 'bar' })
  })
  // The client record is what the teardown removes; the document is not
  // needed.
  await coll.remove(key)
  return cluster
}

// The registry is kept with the flag, since a registry that is itself
// collected never reports.
function watch(target) {
  const watched = { collected: false }
  watched.registry = new FinalizationRegistry(() => {
    watched.collected = true
  })
  watched.registry.register(target, undefined)
  return watched
}

async function sweep(watched) {
  setFlagsFromString('--expose_gc')
  const gc = runInNewContext('gc')
  for (let n = 0; n < MAX_SWEEPS && !watched.collected; n++) {
    gc()
    await new Promise((resolve) => setImmediate(resolve))
  }
  // A native finalizer may be deferred to the task after the sweep.
  await new Promise((resolve) => setImmediate(resolve))
  return watched.collected
}

async function doWork() {
  let cluster = await commit()
  worker.parentPort.postMessage({ stage: 'committed' })
  await new Promise((resolve) => worker.parentPort.once('message', resolve))

  let collected
  if (mode === 'collected') {
    // Only the binding's connection is watched: the cluster holds it and its
    // transactions, so they all become unreachable together.
    const watched = watch(cluster._conn)
    cluster = undefined
    collected = await sweep(watched)
  } else {
    held.push(cluster)
  }
  worker.parentPort.postMessage({ stage: 'ready', collected })
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
