'use strict'

const assert = require('chai').assert
const testdata = require('./testdata')
const H = require('./harness')
const {
  RangeScan,
  ScanTerm,
  SamplingScan,
  PrefixScan,
} = require('../lib/rangeScan')
const { MutationState } = require('../lib/mutationstate')

function validateResults(
  result,
  expected_count,
  idsOnly = false,
  return_rows = false
) {
  const rows = []
  result.forEach((r) => {
    assert.isObject(r)
    assert.isString(r.id)
    if (idsOnly) {
      assert.isUndefined(r.expiryTime)
      assert.isUndefined(r.cas)
      assert.isUndefined(r.content)
    } else {
      assert.isOk(r.cas)
      assert.isObject(r.content)
      assert.deepStrictEqual(r.content, { id: r.id })
    }
    rows.push(r)
  })
  assert.lengthOf(result, expected_count)
  if (return_rows) {
    return rows
  }
}

async function upsertTestData(target, testUid) {
  var promises = []

  for (var i = 0; i < 100; ++i) {
    promises.push(
      (async () => {
        var testDocKey = testUid + '::' + i
        var testDoc = { id: testDocKey }

        const res = await target.upsert(testDocKey, testDoc)
        return { id: testDocKey, token: res.token }
      })()
    )
  }

  return await Promise.all(promises)
}

function rangeScanTests(collFn) {
  describe('#rangescan', function () {
    this.timeout(5000)
    let testUid, testIds, mutationState

    before(async function () {
      H.skipIfMissingFeature(this, H.Features.RangeScan)
      // cleanup the bucket prior to running the tests
      this.timeout(10000)
      const bmgr = H.c.buckets()
      await H.tryNTimes(3, 1000, bmgr.flushBucket.bind(bmgr), H.bucketName)

      testUid = H.genTestKey()
      const results = await upsertTestData(collFn(), testUid)
      testIds = results.map((r) => r.id)
      mutationState = new MutationState(...results.map((r) => r.token))
    })

    after(async function () {
      await testdata.removeTestData(collFn(), testIds)
    })

    it('should execute a range scan', async function () {
      const scanType = new RangeScan(
        new ScanTerm(`${testUid}::1`),
        new ScanTerm(`${testUid}::2`)
      )

      const res = await collFn().scan(scanType, {
        consistentWith: mutationState,
      })

      assert.isArray(res)
      validateResults(res, 12)
    })

    it('should execute a range scan with default terms', async function () {
      const scanType = new RangeScan()

      const res = await collFn().scan(scanType, {
        consistentWith: mutationState,
      })

      assert.isArray(res)
      validateResults(res, testIds.length)
    })

    it('should execute a range scan exclusive', async function () {
      const scanType = new RangeScan(
        new ScanTerm(`${testUid}::1`, true),
        new ScanTerm(`${testUid}::2`, true)
      )

      const res = await collFn().scan(scanType, {
        consistentWith: mutationState,
      })

      assert.isArray(res)
      validateResults(res, 10)
    })

    it('should execute a range scan from prefix', async function () {
      const scanType = new PrefixScan(testUid)

      const res = await collFn().scan(scanType)

      assert.isArray(res)
      validateResults(res, testIds.length)
    })

    it('should execute a range scan returning only ids', async function () {
      const scanType = new PrefixScan(testUid)
      const res = await collFn().scan(scanType, { idsOnly: true })

      assert.isArray(res)
      validateResults(res, testIds.length, true)
    })

    it('should stream scan results', async function () {
      const streamRangeScan = (scanType, options) => {
        return new Promise((resolve, reject) => {
          let resultsOut = []
          collFn()
            .scan(scanType, options)
            .on('result', (res) => {
              resultsOut.push(res)
            })
            .on('end', () => {
              resolve({
                results: resultsOut,
              })
            })
            .on('error', (err) => {
              reject(err)
            })
        })
      }

      const scanType = new PrefixScan(testUid)
      const res = await streamRangeScan(scanType, { idsOnly: true })
      assert.isArray(res.results)
      validateResults(res.results, testIds.length, true)
    })

    it('should cancel streaming scan results', async function () {
      const streamRangeScan = (scanType, options, cancelAt) => {
        return new Promise((resolve, reject) => {
          let resultsOut = []
          const emitter = collFn().scan(scanType, options)
          emitter
            .on('result', (res) => {
              resultsOut.push(res)
              if (resultsOut.length == cancelAt) {
                emitter.cancelStreaming()
              }
            })
            .on('end', () => {
              resolve({
                results: resultsOut,
              })
            })
            .on('error', (err) => {
              reject(err)
            })
        })
      }

      const scanType = new PrefixScan(testUid)
      const res = await streamRangeScan(scanType, { idsOnly: true }, 5)
      assert.isArray(res.results)
      validateResults(res.results, 5, true)
    })

    it('should execute a sample scan', async function () {
      const limit = 10
      const scanType = new SamplingScan(limit)
      const res = await collFn().scan(scanType, { idsOnly: true })

      assert.isArray(res)
      const results = validateResults(res, limit, true, true)
      results.forEach((r) => assert.isTrue(testIds.includes(r.id)))
    })

    it('should execute a sample scan with seed', async function () {
      const limit = 10
      const scanType = new SamplingScan(limit, 50)
      let res = await collFn().scan(scanType, { idsOnly: true })
      assert.isArray(res)
      let results = validateResults(res, limit, true, true)
      const resultIds = []
      results.forEach((r) => {
        assert.isTrue(testIds.includes(r.id))
        resultIds.push(r.id)
      })

      res = await collFn().scan(scanType, { idsOnly: true })
      assert.isArray(res)
      results = validateResults(res, limit, true, true)
      const compareIds = results.map((r) => r.id)
      assert.lengthOf(resultIds, compareIds.length)
      resultIds.forEach((rId) => assert.isTrue(compareIds.includes(rId)))
    })

    describe('#batchByteLimit', function () {
      const testBatchByteLimit = ({ scanType, limit, expected }) =>
        async function () {
          const res = await collFn().scan(scanType, { batchByteLimit: limit })

          assert.isArray(res)
          validateResults(res, expected)
        }

      it('should execute RangeScan with batchByteLimit=0',
        testBatchByteLimit({
          scanType: new RangeScan(),
          limit: 0,
          expected: 100,
        })
      )

      it('should execute RangeScan with batchByteLimit=1',
        testBatchByteLimit({
          scanType: new RangeScan(),
          limit: 1,
          expected: 100,
        })
      )

      it('should execute RangeScan with batchByteLimit=25',
        testBatchByteLimit({
          scanType: new RangeScan(),
          limit: 25,
          expected: 100,
        })
      )

      it('should execute RangeScan with batchByteLimit=100',
        testBatchByteLimit({
          scanType: new RangeScan(),
          limit: 100,
          expected: 100,
        })
      )

      it('should execute PrefixScan with batchByteLimit=0',
        testBatchByteLimit({
          scanType: new PrefixScan(testUid),
          limit: 0,
          expected: 100,
        })
      )

      it('should execute PrefixScan with batchByteLimit=1',
        testBatchByteLimit({
          scanType: new PrefixScan(testUid),
          limit: 1,
          expected: 100,
        })
      )

      it('should execute PrefixScan with batchByteLimit=25',
        testBatchByteLimit({
          scanType: new PrefixScan(testUid),
          limit: 25,
          expected: 100,
        })
      )

      it('should execute PrefixScan with batchByteLimit=100',
        testBatchByteLimit({
          scanType: new PrefixScan(testUid),
          limit: 100,
          expected: 100,
        })
      )

      it('should execute SamplingScan with batchByteLimit=0',
        testBatchByteLimit({
          scanType: new SamplingScan(10, 50),
          limit: 0,
          expected: 10,
        })
      )

      it('should execute SamplingScan with batchByteLimit=1',
        testBatchByteLimit({
          scanType: new SamplingScan(10, 50),
          limit: 1,
          expected: 10,
        })
      )

      it('should execute SamplingScan with batchByteLimit=25',
        testBatchByteLimit({
          scanType: new SamplingScan(10, 50),
          limit: 25,
          expected: 10,
        })
      )

      it('should execute SamplingScan with batchByteLimit=100',
        testBatchByteLimit({
          scanType: new SamplingScan(10, 50),
          limit: 100,
          expected: 10,
        })
      )
    })

    describe('#batchItemLimit', function () {
      const testBatchItemLimit = ({ scanType, limit, expected }) =>
        async function () {
          const res = await collFn().scan(scanType, { batchItemLimit: limit })

          assert.isArray(res)
          validateResults(res, expected)
        }

      it('should execute RangeScan with batchItemLimit=0',
        testBatchItemLimit({
          scanType: new RangeScan(),
          limit: 0,
          expected: 100,
        })
      )

      it('should execute RangeScan with batchItemLimit=10',
        testBatchItemLimit({
          scanType: new RangeScan(),
          limit: 10,
          expected: 100,
        })
      )

      it('should execute RangeScan with batchItemLimit=25',
        testBatchItemLimit({
          scanType: new RangeScan(),
          limit: 25,
          expected: 100,
        })
      )

      it('should execute RangeScan with batchItemLimit=100',
        testBatchItemLimit({
          scanType: new RangeScan(),
          limit: 100,
          expected: 100,
        })
      )

      it('should execute PrefixScan with batchItemLimit=0',
        testBatchItemLimit({
          scanType: new PrefixScan(testUid),
          limit: 0,
          expected: 100,
        })
      )

      it('should execute PrefixScan with batchItemLimit=10',
        testBatchItemLimit({
          scanType: new PrefixScan(testUid),
          limit: 10,
          expected: 100,
        })
      )

      it('should execute PrefixScan with batchItemLimit=25',
        testBatchItemLimit({
          scanType: new PrefixScan(testUid),
          limit: 25,
          expected: 100,
        })
      )

      it('should execute PrefixScan with batchItemLimit=100',
        testBatchItemLimit({
          scanType: new PrefixScan(testUid),
          limit: 100,
          expected: 100,
        })
      )

      it('should execute SamplingScan with batchItemLimit=0',
        testBatchItemLimit({
          scanType: new SamplingScan(10, 50),
          limit: 0,
          expected: 10,
        })
      )

      it('should execute SamplingScan with batchItemLimit=10',
        testBatchItemLimit({
          scanType: new SamplingScan(10, 50),
          limit: 10,
          expected: 10,
        })
      )

      it('should execute SamplingScan with batchItemLimit=25',
        testBatchItemLimit({
          scanType: new SamplingScan(10, 50),
          limit: 25,
          expected: 10,
        })
      )

      it('should execute SamplingScan with batchItemLimit=100',
        testBatchItemLimit({
          scanType: new SamplingScan(10, 50),
          limit: 100,
          expected: 10,
        })
      )
    })

    describe('#concurrency', function () {
      const testConcurrency = ({ concurrency }) =>
        async function () {
          const scanType = new RangeScan(
            new ScanTerm(`${testUid}::1`),
            new ScanTerm(`${testUid}::2`)
          )
          const res = await collFn().scan(scanType, {
            concurrency: concurrency,
            consistentWith: mutationState,
          })

          assert.isArray(res)
          validateResults(res, 12)
        }

      it('should execute RangeScan with concurrency=1',
        testConcurrency({ concurrency: 1 })
      )

      it('should execute RangeScan with concurrency=2',
        testConcurrency({ concurrency: 2 })
      )

      it('should execute RangeScan with concurrency=4',
        testConcurrency({ concurrency: 4 })
      )

      it('should execute RangeScan with concurrency=16',
        testConcurrency({ concurrency: 16 })
      )

      it('should execute RangeScan with concurrency=64',
        testConcurrency({ concurrency: 64 })
      )

      it('should execute RangeScan with concurrency=128',
        testConcurrency({ concurrency: 128 })
      )
    })

    describe('#invalid-concurrency', function () {
      const testConcurrency = ({ concurrency }) =>
        async function () {
          const scanType = new RangeScan(
            new ScanTerm(`${testUid}::1`),
            new ScanTerm(`${testUid}::2`)
          )
          await H.throwsHelper(async () => {
            await collFn().scan(scanType, {
              concurrency: concurrency,
              consistentWith: mutationState,
            })
          }, H.lib.InvalidArgumentError)
        }

      it('should return an invalid argument when concurrency <= 0 (concurrency=0)',
        testConcurrency({ concurrency: 0 })
      )

      it('should return an invalid argument when concurrency <= 0 (concurrency=-1)',
        testConcurrency({ concurrency: -1 })
      )
    })

    describe('#invalid-sample-limit', function () {
      const testConcurrency = ({ limit }) =>
        async function () {
          const scanType = new SamplingScan(limit)
          await H.throwsHelper(async () => {
            await collFn().scan(scanType)
          }, H.lib.InvalidArgumentError)
        }

      it('should return an invalid argument when SamplingScan limit <= 0 (limit=0)',
        testConcurrency({ limit: 0 })
      )

      it('should return an invalid argument when SamplingScan limit <= 0 (limit=-10)',
        testConcurrency({ limit: -10 })
      )
    })
  })
}

describe('#default-rangescan', function () {
  /* eslint-disable-next-line mocha/no-setup-in-describe */
  rangeScanTests(() => H.dco)
})

describe('#collections-rangescan', function () {
  /* eslint-disable-next-line mocha/no-hooks-for-single-case */
  before(function () {
    H.skipIfMissingFeature(this, H.Features.Collections)
  })

  /* eslint-disable-next-line mocha/no-setup-in-describe */
  rangeScanTests(() => H.co)
})
