require('ts-node').register()

/* eslint-disable-next-line node/no-unsupported-features/node-builtins */
const worker = require('worker_threads')
const assert = require('chai').assert
const couchbase = require('../lib/couchbase')

const workerData = worker.workerData

async function doWork() {
  const cluster = await couchbase.connect(
    workerData.connStr,
    workerData.connOpts
  )
  const bucket = cluster.bucket(workerData.bucketName)
  const coll = bucket.defaultCollection()

  await coll.insert(workerData.testKey, 'bar')

  const getRes = await coll.get(workerData.testKey)
  assert.isObject(getRes)
  assert.isNotEmpty(getRes.cas)
  assert.deepStrictEqual(getRes.value, 'bar')

  // We intentionally omit the call to close here to test that the
  // connection is correctly cleaned up automatically when the context
  // is destroyed.  Without proper handling, this causes libuv to panic
  // due to handles that are left open.
  //cluster.close()

  worker.parentPort.postMessage({
    success: true,
  })
}
doWork()
