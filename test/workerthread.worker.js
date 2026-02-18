require('ts-node').register()

const worker = require('worker_threads')
const assert = require('chai').assert
const couchbase = require('../lib/couchbase')

const workerData = worker.workerData

async function doWork() {
  try {
    const cluster = await couchbase.connect(
      workerData.connStr,
      workerData.connOpts
    )
    const bucket = cluster.bucket(workerData.bucketName)
    const coll = bucket.defaultCollection()

    // increased timeout for the first operation.  sometimes the connection
    // isn't available immediately and leads to this failing.
    await coll.insert(workerData.testKey, 'bar', { timeout: 25000 })

    const getRes = await coll.get(workerData.testKey)
    assert.isObject(getRes)
    assert.isOk(getRes.cas)
    assert.deepStrictEqual(getRes.value, 'bar')

    // We intentionally omit the call to close here to test that the
    // connection is correctly cleaned up automatically when the context
    // is destroyed.  Without proper handling, this causes libuv to panic
    // due to handles that are left open.
    //await cluster.close()

    worker.parentPort.postMessage({
      success: true,
    })
  } catch (e) {
    worker.parentPort.postMessage({
      error: e,
    })
  }
}
doWork()
