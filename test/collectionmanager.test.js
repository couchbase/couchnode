'use strict'

const { assert } = require('chai')
const H = require('./harness')

describe('#collectionmanager', function () {
  let testScope, testColl

  before(function () {
    H.skipIfMissingFeature(this, H.Features.Collections)

    testScope = H.genTestKey()
    testColl = H.genTestKey()
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
    await cmgr.createCollection(testColl, testScope)
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
    assert.isNotEmpty(foundScope)

    const foundColl = foundScope.collections.find((v) => v.name === testColl)
    assert.isNotEmpty(foundColl)
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
})
