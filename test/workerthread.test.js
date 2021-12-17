'use strict'

const semver = require('semver')
const harness = require('./harness')

const H = harness

async function startWorker(workerData) {
  /* eslint-disable-next-line node/no-unsupported-features/node-builtins */
  const worker = require('worker_threads')

  return await new Promise((resolve, reject) => {
    let has_resolved = false
    const work = new worker.Worker('./test/workerthread.worker.js', {
      workerData,
    })
    work.on('message', (data) => {
      // we need to force terminate the worker so it doesn't stay running, but
      // we mark the handler as resolved so we don't send an error for the terminate
      has_resolved = true
      work.terminate().then(() => {
        resolve(data)
      })
    })
    work.on('error', (err) => {
      if (!has_resolved) {
        has_resolved = true
        reject(err)
      }
    })
    work.on('exit', (code) => {
      if (!has_resolved) {
        if (code !== 0) {
          has_resolved = true
          reject(new Error(`Worker stopped with exit code ${code}`))
        }
      }
    })
  })
}

describe('#worker-threads', function () {
  it('should start a worker and complete an operation', async function () {
    if (semver.lt(process.version, '12.11.0')) {
      return this.skip()
    }

    const res = await startWorker({
      connStr: H.connStr,
      connOpts: H.connOpts,
      bucketName: H.bucketName,
      testKey: H.genTestKey(),
    })
    if (!res.success) {
      throw res.error
    }
  }).timeout(30000)
})
