'use strict'

const { assert } = require('chai')
const H = require('./harness')
const { StorageBackend } = require('../lib/bucketmanager')

describe('#collectionmanager', function () {
  let testScope, testColl, magmaTestBucket, couchstoreTestBucket

  before(function () {
    H.skipIfMissingFeature(this, H.Features.Collections)

    testScope = H.genTestKey()
    testColl = H.genTestKey()
    magmaTestBucket = H.genTestKey()
    couchstoreTestBucket = H.genTestKey()
  })

  it('should successfully create a scope', async function () {
    var cmgr = H.b.collections()
    await cmgr.createScope(testScope)
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

    await cmgr.dropCollection(testColl, testScope)
  })

  it('should should successfully create a collection with callback', function (callback) {
    var cmgr = H.b.collections()
    const localTestColl = H.genTestKey()
    cmgr.createCollection(localTestColl, testScope, { maxExpiry: 3 }, (err) => {
      callback(err)
      cmgr.dropCollection(localTestColl, testScope)
    })
  })

  it('should should successfully create a collection with callback and options', function (callback) {
    var cmgr = H.b.collections()
    const localTestColl = H.genTestKey()
    cmgr.createCollection(
      localTestColl,
      testScope,
      { maxExpiry: 3 },
      { timeout: 5000 },
      (err) => {
        callback(err)
        cmgr.dropCollection(localTestColl, testScope)
      }
    )
  })

  it('should should successfully create a collection with callback and options no settings', function (callback) {
    var cmgr = H.b.collections()
    const localTestColl = H.genTestKey()
    cmgr.createCollection(
      localTestColl,
      testScope,
      { timeout: 5000 },
      (err) => {
        callback(err)
        cmgr.dropCollection(localTestColl, testScope)
      }
    )
  })

  it('should should successfully create a collection with callback no settings', function (callback) {
    var cmgr = H.b.collections()
    const localTestColl = H.genTestKey()
    cmgr.createCollection(localTestColl, testScope, (err) => {
      callback(err)
      cmgr.dropCollection(localTestColl, testScope)
    })
  })

  it('should successfully create a collection with callback deprecated API', function (callback) {
    var cmgr = H.b.collections()
    const localTestColl = H.genTestKey()
    cmgr.createCollection(
      { name: localTestColl, scopeName: testScope },
      (err) => {
        callback(err)
        cmgr.dropCollection(localTestColl, testScope)
      }
    )
  })

  it('should successfully create a collection with callback and options deprecated API', function (callback) {
    var cmgr = H.b.collections()
    const localTestColl = H.genTestKey()
    cmgr.createCollection(
      { name: localTestColl, scopeName: testScope },
      { timeout: 5000 },
      (err) => {
        callback(err)
        cmgr.dropCollection(localTestColl, testScope)
      }
    )
  })

  it('should successfully create a collection with settings', async function () {
    var cmgr = H.b.collections()
    await cmgr.createCollection(testColl, testScope, { maxExpiry: 3 })
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

  it('should successfully drop a scope', async function () {
    var cmgr = H.b.collections()
    await cmgr.dropScope(testScope)
  })

  it('should fail to drop a missing scope', async function () {
    var cmgr = H.b.collections()
    await H.throwsHelper(async () => {
      await cmgr.dropScope(testScope)
    }, H.lib.ScopeNotFoundError)
  })

  it('should fail to create a collection with history on a couchstore bucket', async function () {
    H.skipIfMissingFeature(this, H.Features.BucketDedup)

    var bmgr = H.c.buckets()
    await bmgr.createBucket({
      name: couchstoreTestBucket,
      ramQuotaMB: 128,
      storageBackend: StorageBackend.Couchstore,
    })
    var bucket = await bmgr.getBucket(couchstoreTestBucket)
    assert.isOk(bucket)

    var cmgr = H.c.bucket(couchstoreTestBucket).collections()

    await cmgr.createScope(testScope)

    await H.throwsHelper(async () => {
      await cmgr.createCollection(testColl, testScope, { history: true })
    }, H.lib.FeatureNotAvailableError)
  })

  it('should fail to update a collection with history on a couchstore bucket', async function () {
    H.skipIfMissingFeature(this, H.Features.BucketDedup)
    var cmgr = H.c.bucket(couchstoreTestBucket).collections()

    await cmgr.createCollection(testColl, testScope)

    await H.throwsHelper(async () => {
      await cmgr.updateCollection(testColl, testScope, { history: true })
    }, H.lib.FeatureNotAvailableError)

    await H.c.buckets().dropBucket(couchstoreTestBucket)
  })

  it('should successfully create a collection with history', async function () {
    H.skipIfMissingFeature(this, H.Features.BucketDedup)

    var bmgr = H.c.buckets()
    await bmgr.createBucket({
      name: magmaTestBucket,
      ramQuotaMB: 1024,
      storageBackend: StorageBackend.Magma,
    })
    var bucket = await bmgr.getBucket(magmaTestBucket)
    assert.isOk(bucket)

    var cmgr = H.c.bucket(magmaTestBucket).collections()

    await cmgr.createScope(testScope)
    await cmgr.createCollection(testColl, testScope, { history: true })

    var scopes = await cmgr.getAllScopes()

    const foundScope = scopes.find((v) => v.name === testScope)
    assert.isOk(foundScope)

    const foundColl = foundScope.collections.find((v) => v.name === testColl)
    assert.isOk(foundColl)
    assert.isTrue(foundColl.history)
  })

  it('should successfully update a collection with history', async function () {
    H.skipIfMissingFeature(this, H.Features.BucketDedup)

    var cmgr = H.c.bucket(magmaTestBucket).collections()

    await cmgr.updateCollection(testColl, testScope, { history: false })

    var scopes = await cmgr.getAllScopes()

    const foundScope = scopes.find((v) => v.name === testScope)
    assert.isOk(foundScope)

    const foundColl = foundScope.collections.find((v) => v.name === testColl)
    assert.isOk(foundColl)
    assert.isFalse(foundColl.history)

    await H.c.buckets().dropBucket(magmaTestBucket)
  })
})
