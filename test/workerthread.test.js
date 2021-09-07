'use strict'

const semver = require('semver')
const harness = require('./harness')

const H = harness

async function startWorker(workerData) {
  /* eslint-disable-next-line node/no-unsupported-features/node-builtins */
  const worker = require('worker_threads')

  return await new Promise((resolve, reject) => {
    const work = new worker.Worker('./test/workerthread.worker.js', {
      workerData,
    })
    work.on('message', resolve)
    work.on('error', reject)
    work.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`))
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
