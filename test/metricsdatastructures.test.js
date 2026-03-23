'use strict'

const assert = require('chai').assert
const H = require('./harness')
const { NoOpTestMeter, TestMeter } = require('./metrics/metertypes')
const { createKeyValueValidator } = require('./metrics/validators')
const { DatastructureOp, KeyValueOp } = require('../lib/observabilitytypes')

function metricsTests(collFn, meterFn, collectionDetailsFn) {
  describe('#Data Structure Operations', function () {
    this.retries(2)
    this.timeout(5000)
    let meter
    let coll
    let collectionDetails
    let validator

    before(async function () {
      coll = collFn()
      meter = meterFn()
      collectionDetails = collectionDetailsFn()
      validator = createKeyValueValidator(
        meter,
        collectionDetails,
        H.supportsClusterLabels
      )
    })

    describe('#CouchbaseList', function () {
      let testKeyLst
      let listObj = null

      before(function () {
        testKeyLst = H.genTestKey()
      })

      after(async function () {
        try {
          await coll.remove(testKeyLst)
        } catch (_e) {
          // nothing
        }
      })

      it('should handle all list operations', async function () {
        listObj = coll.list(testKeyLst)
        validator
          .reset()
          .op(DatastructureOp.ListPush)
          .nestedOps([KeyValueOp.MutateIn])
        await listObj.push('test2')
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.ListUnshift)
          .nestedOps([KeyValueOp.MutateIn])
        await listObj.unshift('test1')
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.ListGetAll)
          .nestedOps([KeyValueOp.Get])
        let items = await listObj.getAll()
        assert.lengthOf(items, 2)
        assert.deepEqual(items[0], 'test1')
        assert.deepEqual(items[1], 'test2')
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.ListGetAt)
          .nestedOps([KeyValueOp.LookupIn])
        let item = await listObj.getAt(1)
        assert.deepEqual(item, 'test2')
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.ListGetAt)
          .nestedOps([KeyValueOp.LookupIn])
          .error(true)
        try {
          await listObj.getAt(5)
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.ListIndexOf)
          .nestedOps([KeyValueOp.Get])
        let test2Idx = await listObj.indexOf('test2')
        assert.equal(test2Idx, 1)

        validator
          .reset()
          .op(DatastructureOp.ListIndexOf)
          .nestedOps([KeyValueOp.Get])
        var missingIdx = await listObj.indexOf('missing-item')
        assert.equal(missingIdx, -1)

        validator
          .reset()
          .op(DatastructureOp.ListSize)
          .nestedOps([KeyValueOp.LookupIn])
        var listSize = await listObj.size()
        assert.equal(listSize, 2)

        validator
          .reset()
          .op(DatastructureOp.ListRemoveAt)
          .nestedOps([KeyValueOp.MutateIn])
        await listObj.removeAt(1)

        validator
          .reset()
          .op(DatastructureOp.ListRemoveAt)
          .nestedOps([KeyValueOp.MutateIn])
          .error(true)
        try {
          await listObj.removeAt(4)
        } catch (_e) {
          // ignore
        }
        validator.validate()
      })
    })

    describe('#CouchbaseMap', function () {
      let testKeyMap
      let mapObj = null

      before(function () {
        testKeyMap = H.genTestKey()
      })

      after(async function () {
        try {
          await coll.remove(testKeyMap)
        } catch (_e) {
          // nothing
        }
      })

      it('should handle all map operations', async function () {
        mapObj = coll.map(testKeyMap)

        validator
          .reset()
          .op(DatastructureOp.MapSet)
          .nestedOps([KeyValueOp.MutateIn])
        await mapObj.set('foo', 'test2')
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.MapSet)
          .nestedOps([KeyValueOp.MutateIn])
        await mapObj.set('bar', 'test4')
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.MapGetAll)
          .nestedOps([KeyValueOp.Get])
        let items = await mapObj.getAll()
        assert.deepEqual(items, {
          foo: 'test2',
          bar: 'test4',
        })
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.MapGet)
          .nestedOps([KeyValueOp.LookupIn])
        let item = await mapObj.get('bar')
        assert.deepEqual(item, 'test4')
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.MapGet)
          .nestedOps([KeyValueOp.LookupIn])
          .error(true)
        try {
          await mapObj.get('invalid-item')
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.MapExists)
          .nestedOps([KeyValueOp.LookupIn])
        let result = await mapObj.exists('bar')
        assert.equal(result, true)
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.MapExists)
          .nestedOps([KeyValueOp.LookupIn])
        result = await mapObj.exists('invalid-item')
        assert.equal(result, false)
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.MapSize)
          .nestedOps([KeyValueOp.LookupIn])
        let mapSize = await mapObj.size()
        assert.equal(mapSize, 2)
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.MapRemove)
          .nestedOps([KeyValueOp.MutateIn])
        await mapObj.remove('bar')
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.MapRemove)
          .nestedOps([KeyValueOp.MutateIn])
          .error(true)
        try {
          await mapObj.remove('invalid-item')
        } catch (_e) {
          // ignore
        }
        validator.validate()
      })
    })

    describe('#CouchbaseQueue', function () {
      let testKeyQueue
      let queueObj = null

      before(function () {
        testKeyQueue = H.genTestKey()
      })

      after(async function () {
        try {
          await coll.remove(testKeyQueue)
        } catch (_e) {
          // nothing
        }
      })

      it('should handle all queue operations', async function () {
        queueObj = coll.queue(testKeyQueue)

        validator
          .reset()
          .op(DatastructureOp.QueuePush)
          .nestedOps([KeyValueOp.MutateIn])
        await queueObj.push('test2')
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.QueueSize)
          .nestedOps([KeyValueOp.LookupIn])
        var queueSize = await queueObj.size()
        assert.equal(queueSize, 1)
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.QueuePop)
          .nestedOps([KeyValueOp.LookupIn, KeyValueOp.MutateIn])
        var res = await queueObj.pop()
        assert.deepEqual(res, 'test2')
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.QueuePush)
          .nestedOps([KeyValueOp.MutateIn])
        await queueObj.push('test1')
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.QueuePush)
          .nestedOps([KeyValueOp.MutateIn])
        await queueObj.push('test2')
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.QueuePush)
          .nestedOps([KeyValueOp.MutateIn])
        await queueObj.push('test3')
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.QueuePop)
          .nestedOps([KeyValueOp.LookupIn, KeyValueOp.MutateIn])
        var res1 = await queueObj.pop()
        assert.deepEqual(res1, 'test1')
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.QueuePop)
          .nestedOps([KeyValueOp.LookupIn, KeyValueOp.MutateIn])
        var res2 = await queueObj.pop()
        assert.deepEqual(res2, 'test2')
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.QueuePop)
          .nestedOps([KeyValueOp.LookupIn, KeyValueOp.MutateIn])
        var res3 = await queueObj.pop()
        assert.deepEqual(res3, 'test3')
        validator.validate()

        const subOps = []
        // the logic will loop 16 times before failing out
        for (let i = 0; i < 16; i++) {
          subOps.push(KeyValueOp.LookupIn)
          subOps.push(KeyValueOp.MutateIn)
        }
        validator
          .reset()
          .op(DatastructureOp.QueuePop)
          .nestedOps(subOps)
          .error(true)
        try {
          await queueObj.pop()
        } catch (_e) {
          // ignore
        }
        validator.validate()

        await coll.upsert(testKeyQueue, [])
        validator
          .reset()
          .op(DatastructureOp.QueuePop)
          .nestedOps(subOps)
          .error(true)
        try {
          await queueObj.pop()
        } catch (_e) {
          // ignore
        }
        validator.validate()
      })
    })

    describe('#CouchbaseSet', function () {
      let testKeySet
      let setObj = null

      before(function () {
        testKeySet = H.genTestKey()
      })

      after(async function () {
        try {
          await coll.remove(testKeySet)
        } catch (_e) {
          // nothing
        }
      })

      it('should handle all set operations', async function () {
        setObj = coll.set(testKeySet)

        validator
          .reset()
          .op(DatastructureOp.SetAdd)
          .nestedOps([KeyValueOp.MutateIn])
        let res = await setObj.add('test1')
        assert.equal(res, true)
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.SetAdd)
          .nestedOps([KeyValueOp.MutateIn])
        res = await setObj.add('test2')
        assert.equal(res, true)
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.SetAdd)
          .nestedOps([KeyValueOp.MutateIn])
        res = await setObj.add('test2')
        assert.equal(res, false)
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.SetSize)
          .nestedOps([KeyValueOp.LookupIn])
        let setSize = await setObj.size()
        assert.equal(setSize, 2)
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.SetValues)
          .nestedOps([KeyValueOp.Get])
        let values = await setObj.values()
        assert.lengthOf(values, 2)
        assert.oneOf('test1', values)
        assert.oneOf('test2', values)
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.SetContains)
          .nestedOps([KeyValueOp.Get])
        res = await setObj.contains('test1')
        assert.equal(res, true)
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.SetContains)
          .nestedOps([KeyValueOp.Get])
        res = await setObj.contains('invalid-item')
        assert.equal(res, false)
        validator.validate()

        validator
          .reset()
          .op(DatastructureOp.SetRemove)
          .nestedOps([KeyValueOp.Get, KeyValueOp.MutateIn])
        await setObj.remove('test2')
        validator.validate()

        const subOps = []
        // the logic will loop 16 times before failing out
        for (let i = 0; i < 16; i++) {
          subOps.push(KeyValueOp.Get)
        }
        validator
          .reset()
          .op(DatastructureOp.SetRemove)
          .nestedOps(subOps)
          .error(true)
        try {
          await setObj.remove('invalid-item')
        } catch (_e) {
          // ignore
        }
        validator.validate()
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
