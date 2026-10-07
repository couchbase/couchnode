// Deliberately a plain .cjs file with no Vitest loader: a worker_thread
// spawned from a Vitest child gets none of Vitest's module pipeline, so this
// entry point has to stand on its own, and registers ts-node itself.
require('ts-node').register()

const worker = require('worker_threads')
const couchbase = require('../../../../lib/couchbase')

const { connStr, connOpts, bucketName, testKey } = worker.workerData

async function doWork() {
  try {
    const cluster = await couchbase.connect(connStr, connOpts)
    const coll = cluster.bucket(bucketName).defaultCollection()

    // A longer timeout on the first operation: the connection is not always
    // available immediately, and the old worker carries the same allowance.
    await coll.insert(testKey, 'bar', { timeout: 25000 })
    const getRes = await coll.get(testKey)

    // Intentionally no cluster.close(). This test exists to catch a real libuv
    // handle-cleanup bug: without correct teardown when the worker context is
    // destroyed, libuv panics on the open handles.
    //
    // The document is checked on the test side rather than here. An assertion
    // in this file is caught by the catch below and posted back as an error,
    // which is how the old worker loses the diff on a wrong document.
    worker.parentPort.postMessage({
      success: true,
      cas: String(getRes.cas),
      value: getRes.content,
      pid: process.pid,
    })
  } catch (e) {
    // Posted as plain data rather than as the Error itself. Node clones an
    // Error across the port on the versions this package supports, but the
    // stack is what the test needs and naming it is cheaper than relying on
    // that.
    worker.parentPort.postMessage({
      error: { message: String(e && e.message), stack: e && e.stack },
    })
  }
}
doWork()
