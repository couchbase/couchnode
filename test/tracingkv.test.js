'use strict'

const assert = require('chai').assert
const H = require('./harness')
const {
  NoOpTestTracer,
  TestTracer,
  ThresholdLoggingTestTracer,
} = require('./tracing/tracingtypes')
const { createKeyValueValidator } = require('./tracing/validators')
const { DurabilityLevel } = require('../lib/generaltypes')
const { KeyValueOp } = require('../lib/observabilitytypes')
const { MutateInSpec, LookupInSpec } = require('../lib/sdspecs')
const testdata = require('./testdata')

const INVALID_KEY_NAME = 'not-a-key'
const testObjVal = {
  foo: 'bar',
  baz: 19,
}

function tracingTests(collFn, tracerFn, collectionDetailsFn) {
  describe('#Key-Value Operations', function () {
    this.retries(3)
    let tracer
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
      tracer = tracerFn()
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
          tracer.clear()
        }
      })
      validator = createKeyValueValidator(
        tracer,
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
          throw new Error('encode error')
        },
        decode: () => {
          throw new Error('decode error')
        },
      }

      Object.keys(kvMutationOpMap).forEach((funcName) => {
        describe(`#${funcName}`, function () {
          beforeEach(function () {
            validator.reset()
          })

          it(`should perform ${funcName}`, async function () {
            let testKey = H.genTestKey()
            extraTestDocs.push(testKey)
            if (kvMutationOpMap[funcName].needsExistingKey) {
              testKey = testDocs[Math.floor(Math.random() * origTestDocsLength)]
            }
            validator.reset().op(kvMutationOpMap[funcName].op)
            const res = await coll[funcName](testKey, testObjVal)
            assert.isObject(res)
            assert.isOk(res.cas)
            validator.validate()
          })

          it(`should perform ${funcName} via callback`, function (done) {
            let testKey = H.genTestKey()
            extraTestDocs.push(testKey)
            if (kvMutationOpMap[funcName].needsExistingKey) {
              testKey = testDocs[Math.floor(Math.random() * origTestDocsLength)]
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

          it(`should perform ${funcName} with parent span`, async function () {
            let testKey = H.genTestKey()
            extraTestDocs.push(testKey)
            if (kvMutationOpMap[funcName].needsExistingKey) {
              testKey = testDocs[Math.floor(Math.random() * origTestDocsLength)]
            }
            validator.reset()
            const parentSpan = tracer.requestSpan(`${funcName}-parent-span`)
            validator.op(kvMutationOpMap[funcName].op).parent(parentSpan)
            const res = await coll[funcName](testKey, testObjVal, {
              parentSpan: parentSpan,
            })
            assert.isObject(res)
            assert.isOk(res.cas)
            validator.validate()
          })

          it(`should handle error in ${funcName}`, async function () {
            let testKey = H.genTestKey()
            if (!kvMutationOpMap[funcName].needsExistingKey) {
              testKey = testDocs[Math.floor(Math.random() * origTestDocsLength)]
            }

            validator.reset().op(kvMutationOpMap[funcName].op).error(true)
            try {
              if (funcName === 'upsert') {
                validator.errorBeforeDispatch(true)
                await coll.upsert(testKey, testObjVal, {
                  transcoder: errorTranscoder,
                })
              } else {
                await coll[funcName](testKey, testObjVal)
              }
            } catch (_e) {
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

        it('should perform remove with parent span', async function () {
          validator.reset()
          const parentSpan = tracer.requestSpan(`remove-parent-span`)
          validator.op(KeyValueOp.Remove).parent(parentSpan)
          const res = await coll.remove(testKeyToRemove, {
            parentSpan: parentSpan,
          })
          assert.isObject(res)
          assert.isOk(res.cas)
          validator.validate()
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

        it('should perform remove with durability', async function () {
          H.skipIfMissingFeature(this, H.Features.ServerDurability)
          validator.reset().op(KeyValueOp.Remove).durability('majority')
          const res = await coll.remove(testKeyToRemove, {
            durabilityLevel: DurabilityLevel.Majority,
          })
          assert.isObject(res)
          assert.isOk(res.cas)
          validator.validate()
        })
      })

      describe('#Mutation Durability', function () {
        const kvMutationDurabilityOpMap = {
          insert: { op: KeyValueOp.Insert },
          replace: { op: KeyValueOp.Replace, needsExistingKey: true },
          upsert: { op: KeyValueOp.Upsert },
          mutateIn: { op: KeyValueOp.MutateIn, needsExistingKey: true },
        }

        before(function () {
          H.skipIfMissingFeature(this, H.Features.ServerDurability)
        })

        Object.keys(kvMutationDurabilityOpMap).forEach((funcName) => {
          it(`should perform ${funcName} with durability`, async function () {
            let testKey = H.genTestKey()
            extraTestDocs.push(testKey)
            if (kvMutationDurabilityOpMap[funcName].needsExistingKey) {
              testKey = testDocs[Math.floor(Math.random() * origTestDocsLength)]
            }
            validator
              .reset()
              .op(kvMutationDurabilityOpMap[funcName].op)
              .durability('majority')
            if (funcName === 'mutateIn') {
              await coll.mutateIn(
                testKey,
                [MutateInSpec.upsert('durability_test', 'value')],
                {
                  durabilityLevel: DurabilityLevel.Majority,
                }
              )
            } else {
              await coll[funcName](testKey, testObjVal, {
                durabilityLevel: DurabilityLevel.Majority,
              })
            }
            validator.validate()
          })
        })
      })
    })

    describe('#Non-Mutation Operations', function () {
      let kvReadDocs = []
      let kvReadDocsLength = 0
      const kvNonMutationOpMap = {
        get: { op: KeyValueOp.Get },
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
            tracer.clear()
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
            assert.isObject(res)
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
                assert.isObject(res)
                validator.validate()
                done()
              } catch (_e) {
                done(_e)
              }
            })
          }).timeout(5000)

          it(`should perform ${funcName} with parent span`, async function () {
            const testKey =
              kvReadDocs[Math.floor(Math.random() * kvReadDocsLength)]
            validator.reset()
            const parentSpan = tracer.requestSpan(`${funcName}-parent-span`)
            validator.op(kvNonMutationOpMap[funcName].op).parent(parentSpan)
            const args = kvNonMutationOpMap[funcName].args
              ? kvNonMutationOpMap[funcName].args
              : []
            const res = await coll[funcName](testKey, ...args, {
              parentSpan: parentSpan,
            })
            assert.isObject(res)
            validator.validate()
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

        it(`should perform exists with parent span`, async function () {
          const testKey =
            kvReadDocs[Math.floor(Math.random() * kvReadDocsLength)]
          validator.reset()
          const parentSpan = tracer.requestSpan('exists-parent-span')
          validator.op(KeyValueOp.Exists).parent(parentSpan)
          const res = await coll.exists(testKey, {
            parentSpan: parentSpan,
          })
          assert.isObject(res)
          validator.validate()
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

        it('should perform getProject with parent span', async function () {
          const testKey =
            testDocs[Math.floor(Math.random() * origTestDocsLength)]
          validator.reset()
          const parentSpan = tracer.requestSpan('getProject-parent-span')
          validator
            .op(KeyValueOp.Get)
            .nestedOps([KeyValueOp.LookupIn])
            .parent(parentSpan)
          const res = await coll.get(testKey, {
            project: ['baz'],
            parentSpan: parentSpan,
          })
          assert.isObject(res)
          validator.validate()
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

      describe('#retries', function () {
        it('should perform kv op with retries', async function () {
          const testKey =
            testDocs[Math.floor(Math.random() * origTestDocsLength)]
          await coll.getAndLock(testKey, 1)
          validator.reset().op(KeyValueOp.Upsert).retryCountAboveZero(true)
          const res = await coll.upsert(
            testKey,
            { foo: 'bar', baz: 1 },
            { timeout: 5000 }
          )
          assert.isObject(res)
          validator.validate()
        }).timeout(10000)
      })
    })

    describe('#Replica Operations', function () {
      const kvReplicaOpMap = {
        getAllReplicas: {
          op: KeyValueOp.GetAllReplicas,
          nestedOps: [KeyValueOp.Get, KeyValueOp.GetReplica],
          resultIsArray: true,
        },
        getAnyReplica: {
          op: KeyValueOp.GetAnyReplica,
          nestedOps: [KeyValueOp.Get, KeyValueOp.GetReplica],
          serverDurationAboveZero: false,
        },
      }

      before(function () {
        H.skipIfMissingFeature(this, H.Features.Replicas)
      })

      Object.keys(kvReplicaOpMap).forEach((funcName) => {
        describe(`#${funcName}`, function () {
          beforeEach(function () {
            validator.reset()
          })

          it(`should perform ${funcName}`, async function () {
            const testKey =
              testDocs[Math.floor(Math.random() * origTestDocsLength)]
            validator.reset().op(kvReplicaOpMap[funcName].op)
            if (kvReplicaOpMap[funcName].nestedOps) {
              validator.nestedOps(kvReplicaOpMap[funcName].nestedOps)
            }
            if (kvReplicaOpMap[funcName].serverDurationAboveZero === false) {
              validator.serverDurationAboveZero(false)
            }
            const res = await coll[funcName](testKey)
            if (kvReplicaOpMap[funcName].resultIsArray) {
              assert.isArray(res)
            } else {
              assert.isObject(res)
            }
            validator.validate()
          })

          it(`should perform ${funcName} via callback`, function (done) {
            const testKey =
              testDocs[Math.floor(Math.random() * origTestDocsLength)]
            validator.reset().op(kvReplicaOpMap[funcName].op)
            if (kvReplicaOpMap[funcName].nestedOps) {
              validator.nestedOps(kvReplicaOpMap[funcName].nestedOps)
            }
            if (kvReplicaOpMap[funcName].serverDurationAboveZero === false) {
              validator.serverDurationAboveZero(false)
            }
            coll[funcName](testKey, (err, res) => {
              if (err) {
                return done(err)
              }
              try {
                if (kvReplicaOpMap[funcName].resultIsArray) {
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
          }).timeout(3000)

          it(`should perform ${funcName} with parent span`, async function () {
            const testKey =
              testDocs[Math.floor(Math.random() * origTestDocsLength)]
            validator.reset()
            const parentSpan = tracer.requestSpan(`${funcName}-parent-span`)
            validator.op(kvReplicaOpMap[funcName].op).parent(parentSpan)
            if (kvReplicaOpMap[funcName].nestedOps) {
              validator.nestedOps(kvReplicaOpMap[funcName].nestedOps)
            }
            if (kvReplicaOpMap[funcName].serverDurationAboveZero === false) {
              validator.serverDurationAboveZero(false)
            }
            const res = await coll[funcName](testKey, {
              parentSpan: parentSpan,
            })
            if (kvReplicaOpMap[funcName].resultIsArray) {
              assert.isArray(res)
            } else {
              assert.isObject(res)
            }
            validator.validate()
          })

          it(`should handle error in ${funcName}`, async function () {
            validator.reset().op(kvReplicaOpMap[funcName].op).error(true)
            try {
              await coll[funcName](INVALID_KEY_NAME)
            } catch (_e) {
              // ignore
            }
            validator.validate()
          })
        })
      })
    })

    describe('#Subdoc Operations', function () {
      const kvSubdocOpMap = {
        lookupIn: {
          op: KeyValueOp.LookupIn,
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
            assert.isObject(res)
            validator.validate()
          })

          it(`should perform ${funcName} via callback`, function (done) {
            const testKey =
              testDocs[Math.floor(Math.random() * origTestDocsLength)]
            validator.reset().op(kvSubdocOpMap[funcName].op)
            if (kvSubdocOpMap[funcName].nestedOps) {
              validator.nestedOps(kvSubdocOpMap[funcName].nestedOps)
            }
            if (kvSubdocOpMap[funcName].serverDurationAboveZero === false) {
              validator.serverDurationAboveZero(false)
            }
            coll[funcName](
              testKey,
              ...kvSubdocOpMap[funcName].args,
              (err, res) => {
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
              }
            )
          })

          it(`should perform ${funcName} with parent span`, async function () {
            const testKey =
              testDocs[Math.floor(Math.random() * origTestDocsLength)]
            validator.reset()
            const parentSpan = tracer.requestSpan(`${funcName}-parent-span`)
            validator.op(kvSubdocOpMap[funcName].op).parent(parentSpan)
            const res = await coll[funcName](
              testKey,
              ...kvSubdocOpMap[funcName].args,
              {
                parentSpan: parentSpan,
              }
            )
            assert.isObject(res)
            validator.validate()
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

    describe('#Subdoc Replica Operations', function () {
      const kvSubdocReplicaOpMap = {
        lookupInAllReplicas: {
          op: KeyValueOp.LookupInAllReplicas,
          args: [[LookupInSpec.get('baz')]],
          nestedOps: [KeyValueOp.LookupIn, KeyValueOp.LookupInReplica],
          resultIsArray: true,
        },
        lookupInAnyReplica: {
          op: KeyValueOp.LookupInAnyReplica,
          args: [[LookupInSpec.get('baz')]],
          nestedOps: [KeyValueOp.LookupIn, KeyValueOp.LookupInReplica],
          serverDurationAboveZero: false,
        },
      }

      before(function () {
        H.skipIfMissingFeature(this, H.Features.SubdocReadReplica)
        H.skipIfMissingFeature(this, H.Features.Replicas)
      })

      Object.keys(kvSubdocReplicaOpMap).forEach((funcName) => {
        describe(`#${funcName}`, function () {
          beforeEach(function () {
            validator.reset()
          })

          it(`should perform ${funcName}`, async function () {
            const testKey =
              testDocs[Math.floor(Math.random() * origTestDocsLength)]
            validator.reset().op(kvSubdocReplicaOpMap[funcName].op)
            if (kvSubdocReplicaOpMap[funcName].nestedOps) {
              validator.nestedOps(kvSubdocReplicaOpMap[funcName].nestedOps)
            }
            if (
              kvSubdocReplicaOpMap[funcName].serverDurationAboveZero === false
            ) {
              validator.serverDurationAboveZero(false)
            }
            const res = await coll[funcName](
              testKey,
              ...kvSubdocReplicaOpMap[funcName].args
            )
            if (kvSubdocReplicaOpMap[funcName].resultIsArray === true) {
              assert.isArray(res)
            } else {
              assert.isObject(res)
            }
            validator.validate()
          })

          it(`should perform ${funcName} via callback`, function (done) {
            const testKey =
              testDocs[Math.floor(Math.random() * origTestDocsLength)]
            validator.reset().op(kvSubdocReplicaOpMap[funcName].op)
            if (kvSubdocReplicaOpMap[funcName].nestedOps) {
              validator.nestedOps(kvSubdocReplicaOpMap[funcName].nestedOps)
            }
            if (
              kvSubdocReplicaOpMap[funcName].serverDurationAboveZero === false
            ) {
              validator.serverDurationAboveZero(false)
            }
            coll[funcName](
              testKey,
              ...kvSubdocReplicaOpMap[funcName].args,
              (err, res) => {
                if (err) {
                  return done(err)
                }
                try {
                  if (kvSubdocReplicaOpMap[funcName].resultIsArray === true) {
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

          it(`should perform ${funcName} with parent span`, async function () {
            const testKey =
              testDocs[Math.floor(Math.random() * origTestDocsLength)]
            validator.reset()
            const parentSpan = tracer.requestSpan(`${funcName}-parent-span`)
            validator.op(kvSubdocReplicaOpMap[funcName].op).parent(parentSpan)
            if (kvSubdocReplicaOpMap[funcName].nestedOps) {
              validator.nestedOps(kvSubdocReplicaOpMap[funcName].nestedOps)
            }
            if (
              kvSubdocReplicaOpMap[funcName].serverDurationAboveZero === false
            ) {
              validator.serverDurationAboveZero(false)
            }
            const res = await coll[funcName](
              testKey,
              ...kvSubdocReplicaOpMap[funcName].args,
              {
                parentSpan: parentSpan,
              }
            )
            if (kvSubdocReplicaOpMap[funcName].resultIsArray === true) {
              assert.isArray(res)
            } else {
              assert.isObject(res)
            }
            validator.validate()
          })

          it(`should handle error in ${funcName}`, async function () {
            validator.reset().op(kvSubdocReplicaOpMap[funcName].op).error(true)
            if (kvSubdocReplicaOpMap[funcName].nestedOps) {
              validator.nestedOps(kvSubdocReplicaOpMap[funcName].nestedOps)
            }
            try {
              await coll[funcName](
                INVALID_KEY_NAME,
                ...kvSubdocReplicaOpMap[funcName].args
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

      it('should perform getAndLock and unlock with parent span', async function () {
        validator.reset()
        let parentSpan = tracer.requestSpan('getAndLock-parent-span')
        validator.op(KeyValueOp.GetAndLock).parent(parentSpan)
        const result = await coll.getAndLock(testUnlockKey, 5, {
          parentSpan: parentSpan,
        })
        assert.isObject(result)
        validator.validate()
        // now unlock
        validator.reset()
        parentSpan = tracer.requestSpan('unlock-parent-span')
        validator.op(KeyValueOp.Unlock).parent(parentSpan)
        await coll.unlock(testUnlockKey, result.cas, {
          parentSpan: parentSpan,
        })
        validator.validate()
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

            it(`should perform ${funcName} with parent span`, async function () {
              validator.reset()
              const parentSpan = tracer.requestSpan(`${funcName}-parent-span`)
              validator.op(binaryCounterOpMap[funcName].op).parent(parentSpan)
              const res = await coll.binary()[funcName](testCounterKey, 3, {
                parentSpan: parentSpan,
              })
              assert.isObject(res)
              validator.validate()
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

            it(`should perform ${funcName} with parent span`, async function () {
              validator.reset()
              const parentSpan = tracer.requestSpan(`${funcName}-parent-span`)
              validator.op(binaryMutationOpMap[funcName].op).parent(parentSpan)
              const res = await coll.binary()[funcName](testBinKey, 'world', {
                parentSpan: parentSpan,
              })
              assert.isObject(res)
              validator.validate()
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

describe('#basic tracing', function () {
  let tracer
  let cluster
  let coll
  let collectionDetails

  before(async function () {
    let opts = H.connOpts
    opts.tracingConfig = { enableTracing: true }
    tracer = new TestTracer()
    opts.tracer = tracer
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

  tracingTests(
    () => coll,
    () => tracer,
    () => collectionDetails
  )
})

describe('#no-op tracing', function () {
  let tracer
  let cluster
  let coll
  let collectionDetails

  before(async function () {
    let opts = H.connOpts
    opts.tracingConfig = { enableTracing: true }
    tracer = new NoOpTestTracer()
    opts.tracer = tracer
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

  tracingTests(
    () => coll,
    () => tracer,
    () => collectionDetails
  )
})

describe('#threshold tracing', function () {
  let tracer
  let cluster
  let coll
  let collectionDetails

  before(async function () {
    let opts = H.connOpts
    opts.tracingConfig = { enableTracing: true }
    tracer = new ThresholdLoggingTestTracer()
    opts.tracer = tracer
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

  tracingTests(
    () => coll,
    () => tracer,
    () => collectionDetails
  )
})
