'use strict'

const { assert } = require('chai')
const H = require('./harness')
const { StorageBackend } = require('../lib/bucketmanager')

describe('#collectionmanager', function () {
  let testScope, testColl, magmaTestBucket, couchstoreTestBucket, testCluster

  before(async function () {
    H.skipIfMissingFeature(this, H.Features.Collections)

    testScope = H.genTestKey()
    testColl = H.genTestKey()
    magmaTestBucket = H.genTestKey()
    couchstoreTestBucket = H.genTestKey()
    testCluster = await H.newCluster()
  })

  after(async function () {
    this.timeout(10000)
    if (typeof testCluster !== 'undefined') {
      var bmgr = testCluster.buckets()
      /* eslint no-empty: ["error", { "allowEmptyCatch": true }] */
      try {
        await bmgr.dropBucket(magmaTestBucket)
      } catch (_) {}
      await H.consistencyUtils.waitUntilBucketDropped(magmaTestBucket)
      try {
        await bmgr.dropBucket(couchstoreTestBucket)
      } catch (_) {}
      await H.consistencyUtils.waitUntilBucketDropped(couchstoreTestBucket)
      await testCluster.close()
    }
  })

  it('should successfully create a scope', async function () {
    var cmgr = H.b.collections()
    await cmgr.createScope(testScope)
    await H.consistencyUtils.waitUntilScopePresent(H.bucketName, testScope)
  })

  it('should emit the correct error on duplicate scopes', async function () {
    var cmgr = H.b.collections()
    await H.throwsHelper(async () => {
      await cmgr.createScope(testScope)
    }, H.lib.ScopeExistsError)
  })

  it('should successfully create a collection', async function () {
    var cmgr = H.b.collections()
    await cmgr.createCollection(testColl, testScope, { timeout: 4000 })
    await H.consistencyUtils.waitUntilCollectionPresent(
      H.bucketName,
      testScope,
      testColl
    )
  })

  it('should emit the correct error on duplicate collections', async function () {
    var cmgr = H.b.collections()
    await H.throwsHelper(async () => {
      await cmgr.createCollection(testColl, testScope)
    }, H.lib.CollectionExistsError)
  })

  it('should emit the correct error on missing scopes', async function () {
    var cmgr = H.b.collections()
    await H.throwsHelper(async () => {
      await cmgr.createCollection('some-scope-for-testing', 'invalid-scope')
    }, H.lib.ScopeNotFoundError)
  })

  it('should successfully fetch all scopes', async function () {
    var cmgr = H.b.collections()
    const scopes = await cmgr.getAllScopes()

    const foundScope = scopes.find((v) => v.name === testScope)
    assert.isOk(foundScope)

    const foundColl = foundScope.collections.find((v) => v.name === testColl)
    assert.isOk(foundColl)
  })

  it('should successfully drop a collection', async function () {
    var cmgr = H.b.collections()
    await cmgr.dropCollection(testColl, testScope)
    await H.consistencyUtils.waitUntilCollectionDropped(
      H.bucketName,
      testScope,
      testColl
    )
  })

  it('should fail to drop a collection from a missing scope', async function () {
    var cmgr = H.b.collections()
    await H.throwsHelper(async () => {
      await cmgr.createCollection(testColl, 'invalid-scope')
    }, H.lib.ScopeNotFoundError)
  })

  it('should fail to drop a missing collection', async function () {
    var cmgr = H.b.collections()
    await H.throwsHelper(async () => {
      await cmgr.dropCollection(testColl, testScope)
    }, H.lib.CollectionNotFoundError)
  })

  it('should successfully create a collection with a collection spec', async function () {
    var cmgr = H.b.collections()
    await cmgr.createCollection(
      { name: testColl, scopeName: testScope, maxExpiry: 3 },
      { timeout: 4000 }
    )
    await H.consistencyUtils.waitUntilCollectionPresent(
      H.bucketName,
      testScope,
      testColl
    )

    await cmgr.dropCollection(testColl, testScope)
    await H.consistencyUtils.waitUntilCollectionDropped(
      H.bucketName,
      testScope,
      testColl
    )
  })

  it('should should successfully create a collection with callback', function (done) {
    var cmgr = H.b.collections()
    const localTestColl = H.genTestKey()
    cmgr.createCollection(
      localTestColl,
      testScope,
      { maxExpiry: 3 },
      async (err) => {
        if (err) {
          done(err)
        } else {
          await H.consistencyUtils.waitUntilCollectionPresent(
            H.bucketName,
            testScope,
            localTestColl
          )
          await cmgr.dropCollection(localTestColl, testScope)
          await H.consistencyUtils.waitUntilCollectionDropped(
            H.bucketName,
            testScope,
            localTestColl
          )
          done()
        }
      }
    )
  })

  it('should should successfully create a collection with callback and options', function (done) {
    var cmgr = H.b.collections()
    const localTestColl = H.genTestKey()
    cmgr.createCollection(
      localTestColl,
      testScope,
      { maxExpiry: 3 },
      { timeout: 5000 },
      async (err) => {
        if (err) {
          done(err)
        } else {
          await H.consistencyUtils.waitUntilCollectionPresent(
            H.bucketName,
            testScope,
            localTestColl
          )
          await cmgr.dropCollection(localTestColl, testScope)
          await H.consistencyUtils.waitUntilCollectionDropped(
            H.bucketName,
            testScope,
            localTestColl
          )
          done()
        }
      }
    )
  })

  it('should should successfully create a collection with callback and options no settings', function (done) {
    var cmgr = H.b.collections()
    const localTestColl = H.genTestKey()
    cmgr.createCollection(
      localTestColl,
      testScope,
      { timeout: 5000 },
      async (err) => {
        if (err) {
          done(err)
        } else {
          await H.consistencyUtils.waitUntilCollectionPresent(
            H.bucketName,
            testScope,
            localTestColl
          )
          await cmgr.dropCollection(localTestColl, testScope)
          await H.consistencyUtils.waitUntilCollectionDropped(
            H.bucketName,
            testScope,
            localTestColl
          )
          done()
        }
      }
    )
  })

  it('should should successfully create a collection with callback no settings', function (done) {
    var cmgr = H.b.collections()
    const localTestColl = H.genTestKey()
    cmgr.createCollection(localTestColl, testScope, async (err) => {
      if (err) {
        done(err)
      } else {
        await H.consistencyUtils.waitUntilCollectionPresent(
          H.bucketName,
          testScope,
          localTestColl
        )
        await cmgr.dropCollection(localTestColl, testScope)
        await H.consistencyUtils.waitUntilCollectionDropped(
          H.bucketName,
          testScope,
          localTestColl
        )
        done()
      }
    })
  })

  it('should successfully create a collection with callback deprecated API', function (done) {
    var cmgr = H.b.collections()
    const localTestColl = H.genTestKey()
    cmgr.createCollection(
      { name: localTestColl, scopeName: testScope },
      async (err) => {
        if (err) {
          done(err)
        } else {
          await H.consistencyUtils.waitUntilCollectionPresent(
            H.bucketName,
            testScope,
            localTestColl
          )
          await cmgr.dropCollection(localTestColl, testScope)
          await H.consistencyUtils.waitUntilCollectionDropped(
            H.bucketName,
            testScope,
            localTestColl
          )
          done()
        }
      }
    )
  })

  it('should successfully create a collection with callback and options deprecated API', function (done) {
    var cmgr = H.b.collections()
    const localTestColl = H.genTestKey()
    cmgr.createCollection(
      { name: localTestColl, scopeName: testScope },
      { timeout: 5000 },
      async (err) => {
        if (err) {
          done(err)
        } else {
          await H.consistencyUtils.waitUntilCollectionPresent(
            H.bucketName,
            testScope,
            localTestColl
          )
          await cmgr.dropCollection(localTestColl, testScope)
          await H.consistencyUtils.waitUntilCollectionDropped(
            H.bucketName,
            testScope,
            localTestColl
          )
          done()
        }
      }
    )
  })

  it('should successfully create a collection with settings', async function () {
    var cmgr = H.b.collections()
    await cmgr.createCollection(testColl, testScope, { maxExpiry: 3 })
    await H.consistencyUtils.waitUntilCollectionPresent(
      H.bucketName,
      testScope,
      testColl
    )
    const scopes = await cmgr.getAllScopes()

    const foundScope = scopes.find((v) => v.name === testScope)
    assert.isOk(foundScope)

    const foundColl = foundScope.collections.find((v) => v.name === testColl)
    assert.isOk(foundColl)
    assert.strictEqual(foundColl.maxExpiry, 3)
  })

  it('should successfully update a collection', async function () {
    H.skipIfMissingFeature(this, H.Features.UpdateCollectionMaxExpiry)

    var cmgr = H.b.collections()
    await cmgr.updateCollection(testColl, testScope, { maxExpiry: 1 })
    const scopes = await cmgr.getAllScopes()

    const foundScope = scopes.find((v) => v.name === testScope)
    assert.isOk(foundScope)

    const foundColl = foundScope.collections.find((v) => v.name === testColl)
    assert.isOk(foundColl)
    assert.strictEqual(foundColl.maxExpiry, 1)
  })

  it('should successfully create a collection with default max expiry', async function () {
    H.skipIfMissingFeature(this, H.Features.NegativeCollectionMaxExpiry)
    var cmgr = H.b.collections()
    const localTestColl = H.genTestKey()
    await cmgr.createCollection(localTestColl, testScope, {})
    await H.consistencyUtils.waitUntilCollectionPresent(
      H.bucketName,
      testScope,
      localTestColl
    )
    const scopes = await cmgr.getAllScopes()

    const foundScope = scopes.find((v) => v.name === testScope)
    assert.isOk(foundScope)

    const foundColl = foundScope.collections.find(
      (v) => v.name === localTestColl
    )
    assert.isOk(foundColl)
    assert.strictEqual(foundColl.maxExpiry, 0)
  })

  it('should successfully create a collection with no expiry', async function () {
    H.skipIfMissingFeature(this, H.Features.NegativeCollectionMaxExpiry)
    var cmgr = H.b.collections()
    const localTestColl = H.genTestKey()
    await cmgr.createCollection(localTestColl, testScope, { maxExpiry: -1 })
    await H.consistencyUtils.waitUntilCollectionPresent(
      H.bucketName,
      testScope,
      localTestColl
    )
    const scopes = await cmgr.getAllScopes()

    const foundScope = scopes.find((v) => v.name === testScope)
    assert.isOk(foundScope)

    const foundColl = foundScope.collections.find(
      (v) => v.name === localTestColl
    )
    assert.isOk(foundColl)
    assert.strictEqual(foundColl.maxExpiry, -1)
  })

  it('should fail to create a collection with invalid expiry', async function () {
    H.skipIfMissingFeature(this, H.Features.NegativeCollectionMaxExpiry)
    var cmgr = H.b.collections()
    const localTestColl = H.genTestKey()
    await H.throwsHelper(async () => {
      await cmgr.createCollection(localTestColl, testScope, { maxExpiry: -20 })
    }, H.lib.InvalidArgumentError)
  })

  it('should successfully update a collection with default max expiry', async function () {
    H.skipIfMissingFeature(this, H.Features.NegativeCollectionMaxExpiry)
    var cmgr = H.b.collections()
    const localTestColl = H.genTestKey()
    await cmgr.createCollection(localTestColl, testScope, { maxExpiry: 5 })
    await H.consistencyUtils.waitUntilCollectionPresent(
      H.bucketName,
      testScope,
      localTestColl
    )
    let scopes = await cmgr.getAllScopes()

    let foundScope = scopes.find((v) => v.name === testScope)
    assert.isOk(foundScope)

    let foundColl = foundScope.collections.find((v) => v.name === localTestColl)
    assert.isOk(foundColl)
    assert.strictEqual(foundColl.maxExpiry, 5)

    await cmgr.updateCollection(localTestColl, testScope, { maxExpiry: 0 })
    scopes = await cmgr.getAllScopes()

    foundScope = scopes.find((v) => v.name === testScope)
    assert.isOk(foundScope)

    foundColl = foundScope.collections.find((v) => v.name === localTestColl)
    assert.isOk(foundColl)
    assert.strictEqual(foundColl.maxExpiry, 0)
  })

  it('should successfully update a collection with no expiry', async function () {
    H.skipIfMissingFeature(this, H.Features.NegativeCollectionMaxExpiry)
    var cmgr = H.b.collections()
    const localTestColl = H.genTestKey()
    await cmgr.createCollection(localTestColl, testScope, {})
    await H.consistencyUtils.waitUntilCollectionPresent(
      H.bucketName,
      testScope,
      localTestColl
    )
    let scopes = await cmgr.getAllScopes()

    let foundScope = scopes.find((v) => v.name === testScope)
    assert.isOk(foundScope)

    let foundColl = foundScope.collections.find((v) => v.name === localTestColl)
    assert.isOk(foundColl)
    assert.strictEqual(foundColl.maxExpiry, 0)

    await cmgr.updateCollection(localTestColl, testScope, { maxExpiry: -1 })
    scopes = await cmgr.getAllScopes()

    foundScope = scopes.find((v) => v.name === testScope)
    assert.isOk(foundScope)

    foundColl = foundScope.collections.find((v) => v.name === localTestColl)
    assert.isOk(foundColl)
    assert.strictEqual(foundColl.maxExpiry, -1)
  })

  it('should fail to update a collection with invalid expiry', async function () {
    H.skipIfMissingFeature(this, H.Features.NegativeCollectionMaxExpiry)
    var cmgr = H.b.collections()
    await H.throwsHelper(async () => {
      await cmgr.updateCollection(testColl, testScope, { maxExpiry: -20 })
    }, H.lib.InvalidArgumentError)
  })

  it('should successfully drop a scope', async function () {
    var cmgr = H.b.collections()
    await cmgr.dropScope(testScope)
    await H.consistencyUtils.waitUntilScopeDropped(H.bucketName, testScope)
  })

  it('should fail to drop a missing scope', async function () {
    var cmgr = H.b.collections()
    await H.throwsHelper(async () => {
      await cmgr.dropScope(testScope)
    }, H.lib.ScopeNotFoundError)
  })

  it('should fail to create a collection with history on a couchstore bucket', async function () {
    H.skipIfMissingFeature(this, H.Features.BucketDedup)

    var bmgr = testCluster.buckets()
    await bmgr.createBucket({
      name: couchstoreTestBucket,
      ramQuotaMB: 128,
      storageBackend: StorageBackend.Couchstore,
    })
    await H.consistencyUtils.waitUntilBucketPresent(couchstoreTestBucket)

    var bucket = await bmgr.getBucket(couchstoreTestBucket)
    assert.isOk(bucket)

    var cmgr = testCluster.bucket(couchstoreTestBucket).collections()

    await cmgr.createScope(testScope)
    await H.consistencyUtils.waitUntilScopePresent(
      couchstoreTestBucket,
      testScope
    )

    await H.throwsHelper(async () => {
      await cmgr.createCollection(testColl, testScope, { history: true })
    }, H.lib.FeatureNotAvailableError)
  })

  it('should fail to update a collection with history on a couchstore bucket', async function () {
    H.skipIfMissingFeature(this, H.Features.BucketDedup)
    var cmgr = testCluster.bucket(couchstoreTestBucket).collections()

    await cmgr.createCollection(testColl, testScope)
    await H.consistencyUtils.waitUntilCollectionPresent(
      couchstoreTestBucket,
      testScope,
      testColl
    )

    await H.throwsHelper(async () => {
      await cmgr.updateCollection(testColl, testScope, { history: true })
    }, H.lib.FeatureNotAvailableError)

    await testCluster.buckets().dropBucket(couchstoreTestBucket)
    await H.consistencyUtils.waitUntilBucketDropped(couchstoreTestBucket)
  })

  it('should successfully create a collection with history', async function () {
    H.skipIfMissingFeature(this, H.Features.BucketDedup)

    var bmgr = testCluster.buckets()
    await bmgr.createBucket({
      name: magmaTestBucket,
      ramQuotaMB: 1024,
      storageBackend: StorageBackend.Magma,
    })
    await H.consistencyUtils.waitUntilBucketPresent(magmaTestBucket)

    var bucket = await bmgr.getBucket(magmaTestBucket)
    assert.isOk(bucket)

    var cmgr = testCluster.bucket(magmaTestBucket).collections()

    await cmgr.createScope(testScope)
    await H.consistencyUtils.waitUntilScopePresent(magmaTestBucket, testScope)

    await cmgr.createCollection(testColl, testScope, { history: true })
    await H.consistencyUtils.waitUntilCollectionPresent(
      magmaTestBucket,
      testScope,
      testColl
    )

    var scopes = await cmgr.getAllScopes()

    const foundScope = scopes.find((v) => v.name === testScope)
    assert.isOk(foundScope)

    const foundColl = foundScope.collections.find((v) => v.name === testColl)
    assert.isOk(foundColl)
    assert.isTrue(foundColl.history)
  })

  it('should successfully update a collection with history', async function () {
    H.skipIfMissingFeature(this, H.Features.BucketDedup)

    var cmgr = testCluster.bucket(magmaTestBucket).collections()

    await cmgr.updateCollection(testColl, testScope, { history: false })

    var scopes = await cmgr.getAllScopes()

    const foundScope = scopes.find((v) => v.name === testScope)
    assert.isOk(foundScope)

    const foundColl = foundScope.collections.find((v) => v.name === testColl)
    assert.isOk(foundColl)
    assert.isFalse(foundColl.history)

    await testCluster.buckets().dropBucket(magmaTestBucket)
    await H.consistencyUtils.waitUntilBucketDropped(magmaTestBucket)
  }).timeout(5000)
})
