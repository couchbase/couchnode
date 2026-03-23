'use strict'

const assert = require('chai').assert
const H = require('./harness')
const { NoOpTestMeter, TestMeter } = require('./metrics/metertypes')
const { createKeyValueValidator } = require('./metrics/validators')
const { KeyValueOp } = require('../lib/observabilitytypes')
const { MutateInSpec, LookupInSpec } = require('../lib/sdspecs')
const { EncodingFailureError, DecodingFailureError } = require('../lib/errors')
const testdata = require('./testdata')

const INVALID_KEY_NAME = 'not-a-key'
const testObjVal = {
  foo: 'bar',
  baz: 19,
}

function metricsTests(collFn, meterFn, collectionDetailsFn) {
  describe('#Key-Value Operations', function () {
    this.retries(3)
    let meter
    let coll
    let collectionDetails
    let testUid
    let testDocs = []
    let extraTestDocs = []
    let origTestDocsLength = 0
    let validator

    before(async function () {
      testUid = H.genTestKey()
      coll = collFn()
      meter = meterFn()
      collectionDetails = collectionDetailsFn()
      await H.tryNTimes(3, 1000, async () => {
        try {
          const result = await testdata.upsertData(coll, testUid, 1)
          if (!result.every((r) => r.status === 'fulfilled')) {
            throw new Error('Failed to upsert all test data')
          }
          testDocs = result.map((r) => r.value)
          origTestDocsLength = testDocs.length
        } catch (err) {
          await testdata.removeTestData(coll, testDocs)
          throw err
        } finally {
          meter.clear()
        }
      })
      validator = createKeyValueValidator(
        meter,
        collectionDetails,
        H.supportsClusterLabels
      )
    })

    after(async function () {
      let allTestDocs = testDocs.concat(extraTestDocs)
      try {
        await testdata.removeTestData(coll, allTestDocs)
      } catch (_e) {
        // ignore
      }
    }).timeout(10000)

    describe('#Mutation Operations', function () {
      const kvMutationOpMap = {
        insert: { op: KeyValueOp.Insert },
        replace: { op: KeyValueOp.Replace, needsExistingKey: true },
        upsert: { op: KeyValueOp.Upsert },
      }

      const errorTranscoder = {
        encode: () => {
          throw new EncodingFailureError('encode error')
        },
        decode: () => {
          throw new DecodingFailureError('decode error')
        },
      }

      Object.keys(kvMutationOpMap).forEach((funcName) => {
        describe(`#${funcName}`, function () {
          beforeEach(function () {
            validator.reset()
          })

          it(`should perform ${funcName}`, async function () {
            let testKey = H.genTestKey()

            if (kvMutationOpMap[funcName].needsExistingKey) {
              testKey = testDocs[Math.floor(Math.random() * origTestDocsLength)]
            } else {
              extraTestDocs.push(testKey)
            }
            validator.reset().op(kvMutationOpMap[funcName].op)
            const res = await coll[funcName](testKey, testObjVal)
            assert.isObject(res)
            assert.isOk(res.cas)
            validator.validate()
          })

          it(`should perform ${funcName} via callback`, function (done) {
            let testKey = H.genTestKey()
            if (kvMutationOpMap[funcName].needsExistingKey) {
              testKey = testDocs[Math.floor(Math.random() * origTestDocsLength)]
            } else {
              extraTestDocs.push(testKey)
            }
            validator.reset().op(kvMutationOpMap[funcName].op)

            coll[funcName](testKey, testObjVal, (err, res) => {
              if (err) {
                return done(err)
              }
              try {
                assert.isObject(res)
                assert.isOk(res.cas)
                validator.validate()
                done()
              } catch (_e) {
                done(_e)
              }
            })
          })

          it(`should handle error in ${funcName}`, async function () {
            let testKey = H.genTestKey()
            if (!kvMutationOpMap[funcName].needsExistingKey) {
              testKey = testDocs[Math.floor(Math.random() * origTestDocsLength)]
            }

            validator.reset().op(kvMutationOpMap[funcName].op).error(true)
            try {
              if (funcName === 'upsert') {
                await coll.upsert(testKey, testObjVal, {
                  transcoder: errorTranscoder,
                })
              } else {
                await coll[funcName](testKey, testObjVal)
              }
            } catch (_e) {
              console.log(`Expected error in ${funcName}:`, _e.message)
              // ignore
            }
            validator.validate()
          })
        })
      })

      describe('#remove', function () {
        let testKeyToRemove
        beforeEach(async function () {
          testKeyToRemove = H.genTestKey()
          await coll.upsert(testKeyToRemove, { foo: 'bar' })
          validator.reset()
        })

        it('should perform remove', async function () {
          validator.reset().op(KeyValueOp.Remove)
          const res = await coll.remove(testKeyToRemove)
          assert.isObject(res)
          assert.isOk(res.cas)
          validator.validate()
        })

        it('should perform remove via callback', function (done) {
          validator.reset().op(KeyValueOp.Remove)
          coll.remove(testKeyToRemove, (err, res) => {
            if (err) {
              return done(err)
            }
            try {
              assert.isObject(res)
              assert.isOk(res.cas)
              validator.validate()
              done()
            } catch (_e) {
              done(_e)
            }
          })
        })

        it('should handle error in remove', async function () {
          // so we remove the added key
          await coll.remove(testKeyToRemove)
          validator.reset().op(KeyValueOp.Remove).error(true)
          try {
            await coll.remove(INVALID_KEY_NAME)
          } catch (_e) {
            // ignore
          }
          validator.validate()
        })
      })
    })

    describe('#Non-Mutation Operations', function () {
      let kvReadDocs = []
      let kvReadDocsLength = 0
      const kvNonMutationOpMap = {
        get: { op: KeyValueOp.Get },
        getAllReplicas: { op: KeyValueOp.GetAllReplicas },
        getAnyReplica: { op: KeyValueOp.GetAnyReplica },
        getAndTouch: { op: KeyValueOp.GetAndTouch, args: [1] },
        touch: { op: KeyValueOp.Touch, args: [1] },
      }

      before(async function () {
        const testUid = H.genTestKey()
        await H.tryNTimes(3, 1000, async () => {
          try {
            let testDocsToUpsert = []
            for (let i = 0; i < 30; i++) {
              testDocsToUpsert.push({ foo: `val${i + 1}`, baz: i + 1 })
            }
            const result = await testdata.upserDataFromList(
              coll,
              testUid,
              testDocsToUpsert
            )
            if (!result.every((r) => r.status === 'fulfilled')) {
              throw new Error('Failed to upsert all test data')
            }
            kvReadDocs = result.map((r) => r.value)
            kvReadDocsLength = kvReadDocs.length
          } catch (err) {
            await testdata.removeTestData(coll, kvReadDocs)
            throw err
          } finally {
            meter.clear()
          }
        })
      })

      after(async function () {
        try {
          await testdata.removeTestData(coll, kvReadDocs)
        } catch (_e) {
          // ignore
        }
      }).timeout(10000)

      Object.keys(kvNonMutationOpMap).forEach((funcName) => {
        describe(`#${funcName}`, function () {
          beforeEach(function () {
            if (funcName === 'getAllReplicas' || funcName === 'getAnyReplica') {
              H.skipIfMissingFeature(this, H.Features.Replicas)
            }
            validator.reset()
          })

          it(`should perform ${funcName}`, async function () {
            const testKey =
              kvReadDocs[Math.floor(Math.random() * kvReadDocsLength)]
            validator.reset().op(kvNonMutationOpMap[funcName].op)
            const args = kvNonMutationOpMap[funcName].args
              ? kvNonMutationOpMap[funcName].args
              : []
            const res = await coll[funcName](testKey, ...args)
            if (kvNonMutationOpMap[funcName].op === KeyValueOp.GetAllReplicas) {
              assert.isArray(res)
            } else {
              assert.isObject(res)
            }
            validator.validate()
          }).timeout(5000)

          it(`should perform ${funcName} via callback`, function (done) {
            const testKey =
              kvReadDocs[Math.floor(Math.random() * kvReadDocsLength)]
            validator.reset().op(kvNonMutationOpMap[funcName].op)
            const args = kvNonMutationOpMap[funcName].args
              ? kvNonMutationOpMap[funcName].args
              : []
            coll[funcName](testKey, ...args, (err, res) => {
              if (err) {
                return done(err)
              }
              try {
                if (
                  kvNonMutationOpMap[funcName].op === KeyValueOp.GetAllReplicas
                ) {
                  assert.isArray(res)
                } else {
                  assert.isObject(res)
                }
                validator.validate()
                done()
              } catch (_e) {
                done(_e)
              }
            })
          }).timeout(5000)

          it(`should handle error in ${funcName}`, async function () {
            validator.reset().op(kvNonMutationOpMap[funcName].op).error(true)
            try {
              await coll[funcName](INVALID_KEY_NAME)
            } catch (_e) {
              // ignore
            }
            validator.validate()
          })
        })
      })

      describe(`#exists`, function () {
        beforeEach(function () {
          H.skipIfMissingFeature(this, H.Features.GetMeta)
          validator.reset()
        })

        it(`should perform exists`, async function () {
          const testKey =
            kvReadDocs[Math.floor(Math.random() * kvReadDocsLength)]
          validator.reset().op(KeyValueOp.Exists)
          const res = await coll.exists(testKey)
          assert.isObject(res)
          validator.validate()
        })

        it(`should perform exists via callback`, function (done) {
          const testKey =
            kvReadDocs[Math.floor(Math.random() * kvReadDocsLength)]
          validator.reset().op(KeyValueOp.Exists)
          coll.exists(testKey, (err, res) => {
            if (err) {
              return done(err)
            }
            try {
              assert.isObject(res)
              validator.validate()
              done()
            } catch (_e) {
              done(_e)
            }
          })
        })
      })

      describe('#getProject', function () {
        beforeEach(function () {
          validator.reset()
        })

        it('should perform getProject', async function () {
          const testKey =
            testDocs[Math.floor(Math.random() * origTestDocsLength)]
          validator.reset().op(KeyValueOp.Get).nestedOps([KeyValueOp.LookupIn])
          const res = await coll.get(testKey, { project: ['baz'] })
          assert.isObject(res)
          validator.validate()
        })

        it(`should perform getProject via callback`, function (done) {
          const testKey =
            testDocs[Math.floor(Math.random() * origTestDocsLength)]
          validator.reset().op(KeyValueOp.Get).nestedOps([KeyValueOp.LookupIn])
          coll.get(testKey, { project: ['baz'] }, (err, res) => {
            if (err) {
              return done(err)
            }
            try {
              assert.isObject(res)
              validator.validate()
              done()
            } catch (_e) {
              done(_e)
            }
          })
        })

        it('should handle error in getProject', async function () {
          validator
            .reset()
            .op(KeyValueOp.Get)
            .nestedOps([KeyValueOp.LookupIn])
            .error(true)
          try {
            await coll.get(INVALID_KEY_NAME, { project: ['baz'] })
          } catch (_e) {
            // ignore
          }
          validator.validate()
        })
      })
    })

    describe('#Subdoc Operations', function () {
      const kvSubdocOpMap = {
        lookupIn: {
          op: KeyValueOp.LookupIn,
          args: [[LookupInSpec.get('baz')]],
        },
        lookupInAllReplicas: {
          op: KeyValueOp.LookupInAllReplicas,
          args: [[LookupInSpec.get('baz')]],
        },
        lookupInAnyReplica: {
          op: KeyValueOp.LookupInAnyReplica,
          args: [[LookupInSpec.get('baz')]],
        },
        mutateIn: {
          op: KeyValueOp.MutateIn,
          args: [[MutateInSpec.upsert('new_field', 'new_value')]],
        },
      }

      Object.keys(kvSubdocOpMap).forEach((funcName) => {
        describe(`#${funcName}`, function () {
          beforeEach(function () {
            if (
              funcName === 'lookupInAllReplicas' ||
              funcName === 'lookupInAnyReplica'
            ) {
              H.skipIfMissingFeature(this, H.Features.SubdocReadReplica)
              H.skipIfMissingFeature(this, H.Features.Replicas)
            }
            validator.reset()
          })

          it(`should perform ${funcName}`, async function () {
            const testKey =
              testDocs[Math.floor(Math.random() * origTestDocsLength)]
            validator.reset().op(kvSubdocOpMap[funcName].op)
            const res = await coll[funcName](
              testKey,
              ...kvSubdocOpMap[funcName].args
            )
            if (kvSubdocOpMap[funcName].op === KeyValueOp.LookupInAllReplicas) {
              assert.isArray(res)
            } else {
              assert.isObject(res)
            }
            validator.validate()
          })

          it(`should perform ${funcName} via callback`, function (done) {
            const testKey =
              testDocs[Math.floor(Math.random() * origTestDocsLength)]
            validator.reset().op(kvSubdocOpMap[funcName].op)
            coll[funcName](
              testKey,
              ...kvSubdocOpMap[funcName].args,
              (err, res) => {
                if (err) {
                  return done(err)
                }
                try {
                  if (
                    kvSubdocOpMap[funcName].op ===
                    KeyValueOp.LookupInAllReplicas
                  ) {
                    assert.isArray(res)
                  } else {
                    assert.isObject(res)
                  }
                  validator.validate()
                  done()
                } catch (_e) {
                  done(_e)
                }
              }
            )
          })

          it(`should handle error in ${funcName}`, async function () {
            validator.reset().op(kvSubdocOpMap[funcName].op).error(true)
            try {
              await coll[funcName](
                INVALID_KEY_NAME,
                ...kvSubdocOpMap[funcName].args
              )
            } catch (_e) {
              // ignore
            }
            validator.validate()
          })
        })
      })
    })

    describe('#Lock Operations', function () {
      let testUnlockKey

      before(function () {
        const idx = Math.floor(Math.random() * origTestDocsLength)
        testUnlockKey = testDocs[idx]
      })

      it('should perform getAndLock and unlock', async function () {
        validator.reset().op(KeyValueOp.GetAndLock)
        const result = await coll.getAndLock(testUnlockKey, 5)
        assert.isObject(result)
        validator.validate()
        // now unlock
        validator.reset().op(KeyValueOp.Unlock)
        await coll.unlock(testUnlockKey, result.cas)
        validator.validate()
      }).timeout(5000)

      it(`should perform getAndLock and unlock via callback`, function (done) {
        validator.reset().op(KeyValueOp.GetAndLock)
        coll.getAndLock(testUnlockKey, 5, (err, result) => {
          if (err) {
            return done(err)
          }
          assert.isObject(result)
          validator.validate()
          // now unlock
          validator.reset().op(KeyValueOp.Unlock)
          coll.unlock(testUnlockKey, result.cas, (err, _) => {
            if (err) {
              return done(err)
            }
            try {
              validator.validate()
              done()
            } catch (_e) {
              done(_e)
            }
          })
        })
      }).timeout(5000)

      it('should handle error in getAndLock and unlock', async function () {
        validator.reset().op(KeyValueOp.GetAndLock).error(true)
        try {
          await coll.getAndLock(INVALID_KEY_NAME, 1)
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset().op(KeyValueOp.Unlock).error(true)
        try {
          await coll.unlock(INVALID_KEY_NAME, 100)
        } catch (_e) {
          // ignore
        }
        validator.validate()
      })
    })

    describe('#Binary Operations', function () {
      describe('#counter-ops', function () {
        let testCounterKey

        const binaryCounterOpMap = {
          increment: { op: KeyValueOp.Increment },
          decrement: { op: KeyValueOp.Decrement },
        }

        before(async function () {
          testCounterKey = H.genTestKey()

          await coll.insert(testCounterKey, 14)
        })

        after(async function () {
          try {
            await coll.remove(testCounterKey)
          } catch (_e) {
            // ignore
          }
        })

        Object.keys(binaryCounterOpMap).forEach((funcName) => {
          describe(`#${funcName}`, function () {
            beforeEach(function () {
              validator.reset()
            })

            it(`should perform ${funcName}`, async function () {
              validator.reset().op(binaryCounterOpMap[funcName].op)
              const res = await coll.binary()[funcName](testCounterKey, 3)
              assert.isObject(res)
              validator.validate()
            })

            it(`should perform ${funcName} via callback`, function (done) {
              validator.reset().op(binaryCounterOpMap[funcName].op)
              coll.binary()[funcName](testCounterKey, 3, (err, res) => {
                if (err) {
                  return done(err)
                }
                try {
                  assert.isObject(res)
                  validator.validate()
                  done()
                } catch (_e) {
                  done(_e)
                }
              })
            })

            it(`should handle error in ${funcName}`, async function () {
              validator.reset().op(binaryCounterOpMap[funcName].op).error(true)
              try {
                await coll.binary()[funcName](INVALID_KEY_NAME, -1)
              } catch (_e) {
                // ignore
              }
              validator.validate()
            })
          })
        })
      })

      describe('#mutation-ops', function () {
        let testBinKey

        const binaryMutationOpMap = {
          append: { op: KeyValueOp.Append },
          prepend: { op: KeyValueOp.Prepend },
        }

        before(async function () {
          testBinKey = H.genTestKey()

          await coll.insert(testBinKey, 14)
        })

        after(async function () {
          try {
            await coll.remove(testBinKey)
          } catch (_e) {
            // ignore
          }
        })

        Object.keys(binaryMutationOpMap).forEach((funcName) => {
          describe(`#${funcName}`, function () {
            beforeEach(function () {
              validator.reset()
            })

            it(`should perform ${funcName}`, async function () {
              validator.reset().op(binaryMutationOpMap[funcName].op)
              const res = await coll.binary()[funcName](testBinKey, 'world')
              assert.isObject(res)
              validator.validate()
            })

            it(`should perform ${funcName} via callback`, function (done) {
              validator.reset().op(binaryMutationOpMap[funcName].op)
              coll.binary()[funcName](testBinKey, 'hello', (err, res) => {
                if (err) {
                  return done(err)
                }
                try {
                  assert.isObject(res)
                  validator.validate()
                  done()
                } catch (_e) {
                  done(_e)
                }
              })
            })

            it(`should handle error in ${funcName}`, async function () {
              validator.reset().op(binaryMutationOpMap[funcName].op).error(true)
              try {
                await coll.binary()[funcName](INVALID_KEY_NAME, 'hello')
              } catch (_e) {
                // ignore
              }
              validator.validate()
            })
          })
        })
      })
    })
  })
}

describe('#basic metrics', function () {
  let meter
  let cluster
  let coll
  let collectionDetails

  before(async function () {
    let opts = H.connOpts
    opts.metricsConfig = { enableMetrics: true }
    meter = new TestMeter()
    opts.meter = meter
    cluster = await H.lib.Cluster.connect(H.connStr, opts)
    const bucket = cluster.bucket(H.bucketName)
    coll = bucket.defaultCollection()
    collectionDetails = {
      bucketName: H.bucketName,
      scopeName: H.scopeName,
      collName: coll.name,
    }
  })

  after(async function () {
    await cluster.close()
  })

  metricsTests(
    () => coll,
    () => meter,
    () => collectionDetails
  )
})

describe('#no-op metrics', function () {
  let meter
  let cluster
  let coll
  let collectionDetails

  before(async function () {
    let opts = H.connOpts
    opts.metricsConfig = { enableMetrics: true }
    meter = new NoOpTestMeter()
    opts.meter = meter
    cluster = await H.lib.Cluster.connect(H.connStr, opts)
    const bucket = cluster.bucket(H.bucketName)
    coll = bucket.defaultCollection()
    collectionDetails = {
      bucketName: H.bucketName,
      scopeName: H.scopeName,
      collName: coll.name,
    }
  })

  after(async function () {
    await cluster.close()
  })

  metricsTests(
    () => coll,
    () => meter,
    () => collectionDetails
  )
})
