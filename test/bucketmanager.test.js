'use strict'

const assert = require('chai').assert

const H = require('./harness')
const { StorageBackend } = require('../lib/bucketmanager')

describe('#bucketmanager', function () {
  let testBucket, magmaBucket

  before(function () {
    H.skipIfMissingFeature(this, H.Features.BucketManagement)

    testBucket = H.genTestKey()
    magmaBucket = H.genTestKey()
  })

  it('should successfully create a bucket', async function () {
    var bmgr = H.c.buckets()
    await bmgr.createBucket({
      name: testBucket,
      flushEnabled: true,
      ramQuotaMB: 256,
    })
  }).timeout(10 * 1000)

  it('should emit the correct error on duplicate buckets', async function () {
    var bmgr = H.c.buckets()
    await H.throwsHelper(async () => {
      await bmgr.createBucket({
        name: testBucket,
        ramQuotaMB: 256,
      })
    }, H.lib.BucketExistsError)
  })

  it('should successfully get a bucket', async function () {
    var bmgr = H.c.buckets()
    var res = await bmgr.getBucket(testBucket)
    assert.isObject(res)
    const expected = {
      name: testBucket,
      flushEnabled: true,
      ramQuotaMB: 256,
      numReplicas: 1,
      replicaIndexes: true,
      bucketType: 'membase',
      storageBackend: 'couchstore',
      evictionPolicy: 'valueOnly',
      maxExpiry: 0,
      compressionMode: 'passive',
      minimumDurabilityLevel: 0,
      historyRetentionCollectionDefault: undefined,
      historyRetentionBytes: undefined,
      historyRetentionDuration: undefined,
    }
    assert.deepStrictEqual(res, expected)
  })

  it('should successfully get all buckets', async function () {
    var bmgr = H.c.buckets()
    var res = await bmgr.getAllBuckets()
    assert.isArray(res)
    assert.isObject(res[0])
  })

  it('should fail to get a missing bucket', async function () {
    var bmgr = H.c.buckets()
    await H.throwsHelper(async () => {
      await bmgr.getBucket('invalid-bucket')
    }, H.lib.BucketNotFoundError)
  })

  it('should successfully flush a bucket', async function () {
    var bmgr = H.c.buckets()
    await bmgr.flushBucket(testBucket)
  }).timeout(10 * 1000)

  it('should error when trying to flush a missing bucket', async function () {
    var bmgr = H.c.buckets()
    await H.throwsHelper(async () => {
      await bmgr.flushBucket('invalid-bucket')
    }, H.lib.BucketNotFoundError)
  })

  it('should successfully update a bucket', async function () {
    var bmgr = H.c.buckets()
    await bmgr.updateBucket({
      name: testBucket,
      flushEnabled: false,
      ramQuotaMB: 1024,
    })
  })

  it('should return an InvalidArgument error when updating a couchstore bucket with history', async function () {
    H.skipIfMissingFeature(this, H.Features.BucketDedup)

    var bmgr = H.c.buckets()
    await H.throwsHelper(async () => {
      await bmgr.updateBucket({
        name: testBucket,
        historyRetentionCollectionDefault: true,
        ramQuotaMB: 1024,
      })
    }, H.lib.InvalidArgumentError)
  })

  it('should error when trying to flush an unflushable bucket', async function () {
    var bmgr = H.c.buckets()
    await H.throwsHelper(async () => {
      await bmgr.flushBucket(testBucket)
    }, H.lib.CouchbaseError)
  })

  it('should successfully drop a bucket', async function () {
    var bmgr = H.c.buckets()
    await bmgr.dropBucket(testBucket)
  })

  it('should fail to drop a missing bucket', async function () {
    var bmgr = H.c.buckets()
    await H.throwsHelper(async () => {
      await bmgr.dropBucket(testBucket)
    }, H.lib.BucketNotFoundError)
  })

  it('should successfully create a bucket with flush and replicaIndexes disabled', async function () {
    var bmgr = H.c.buckets()
    await bmgr.createBucket({
      name: testBucket,
      flushEnabled: false,
      replicaIndexes: false,
      ramQuotaMB: 256,
    })

    var res = await bmgr.getBucket(testBucket)
    assert.isObject(res)
    const expected = {
      name: testBucket,
      flushEnabled: false,
      ramQuotaMB: 256,
      numReplicas: 1,
      replicaIndexes: false,
      bucketType: 'membase',
      storageBackend: 'couchstore',
      evictionPolicy: 'valueOnly',
      maxExpiry: 0,
      compressionMode: 'passive',
      minimumDurabilityLevel: 0,
      historyRetentionCollectionDefault: undefined,
      historyRetentionBytes: undefined,
      historyRetentionDuration: undefined,
    }
    assert.deepStrictEqual(res, expected)

    await bmgr.dropBucket(testBucket)
  }).timeout(10 * 1000)

  it('should successfully create a bucket with history settings', async function () {
    H.skipIfMissingFeature(this, H.Features.BucketDedup)

    var bmgr = H.c.buckets()
    await bmgr.createBucket({
      name: magmaBucket,
      ramQuotaMB: 1024,
      storageBackend: StorageBackend.Magma,
      historyRetentionCollectionDefault: true,
      historyRetentionBytes: 2147483648,
      historyRetentionDuration: 13000,
    })

    var res = await bmgr.getBucket(magmaBucket)
    assert.isObject(res)
    const expected = {
      name: magmaBucket,
      bucketType: 'membase',
      compressionMode: 'passive',
      evictionPolicy: 'fullEviction',
      flushEnabled: false,
      maxExpiry: 0,
      minimumDurabilityLevel: 0,
      numReplicas: 1,
      replicaIndexes: undefined,
      ramQuotaMB: 1024,
      storageBackend: 'magma',
      historyRetentionCollectionDefault: true,
      historyRetentionBytes: 2147483648,
      historyRetentionDuration: 13000,
    }

    assert.deepStrictEqual(res, expected)
  }).timeout(10 * 1000)

  it('should update the history settings on a bucket', async function () {
    H.skipIfMissingFeature(this, H.Features.BucketDedup)

    var bmgr = H.c.buckets()
    await bmgr.updateBucket({
      name: magmaBucket,
      historyRetentionCollectionDefault: false,
      historyRetentionBytes: 0,
      historyRetentionDuration: 14000,
    })

    var res = await bmgr.getBucket(magmaBucket)
    assert.isObject(res)

    const expected = {
      name: magmaBucket,
      bucketType: 'membase',
      compressionMode: 'passive',
      evictionPolicy: 'fullEviction',
      flushEnabled: false,
      maxExpiry: 0,
      minimumDurabilityLevel: 0,
      numReplicas: 1,
      replicaIndexes: undefined,
      ramQuotaMB: 1024,
      storageBackend: 'magma',
      historyRetentionCollectionDefault: false,
      historyRetentionBytes: 0,
      historyRetentionDuration: 14000,
    }

    assert.deepStrictEqual(res, expected)

    await bmgr.dropBucket(magmaBucket)
  }).timeout(10 * 1000)

  it('should return an InvalidArgument error when creating a couchstore bucket with history', async function () {
    H.skipIfMissingFeature(this, H.Features.BucketDedup)

    var bmgr = H.c.buckets()
    await H.throwsHelper(async () => {
      await bmgr.createBucket({
        name: testBucket,
        storageBackend: StorageBackend.Couchstore,
        historyRetentionCollectionDefault: true,
      })
    }, H.lib.InvalidArgumentError)
  })
})
