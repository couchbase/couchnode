'use strict'

const H = require('./harness')

describe('#collectionmanager', () => {
  H.requireFeature(H.Features.Collections, () => {
    var testScope = H.genTestKey()
    var testColl = H.genTestKey()

    it('should successfully create a scope', async () => {
      var cmgr = H.b.collections()
      await cmgr.createScope(testScope)
    })

    it('should emit the correct error on duplicate scopes', async () => {
      var cmgr = H.b.collections()
      await H.throwsHelper(async () => {
        await cmgr.createScope(testScope)
      }, H.lib.ScopeExistsError)
    })

    it('should successfully create a collection', async () => {
      var cmgr = H.b.collections()
      await cmgr.createCollection(testColl, testScope)
    })

    it('should emit the correct error on duplicate collections', async () => {
      var cmgr = H.b.collections()
      await H.throwsHelper(async () => {
        await cmgr.createCollection(testColl, testScope)
      }, H.lib.CollectionExistsError)
    })

    it('should emit the correct error on missing scopes', async () => {
      var cmgr = H.b.collections()
      await H.throwsHelper(async () => {
        await cmgr.createCollection('some-scope-for-testing', 'invalid-scope')
      }, H.lib.ScopeNotFoundError)
    })

    it('should successfully drop a collection', async () => {
      var cmgr = H.b.collections()
      await cmgr.dropCollection(testColl, testScope)
    })

    it('should fail to drop a collection from a missing scope', async () => {
      var cmgr = H.b.collections()
      await H.throwsHelper(async () => {
        await cmgr.createCollection(testColl, 'invalid-scope')
      }, H.lib.ScopeNotFoundError)
    })

    it('should fail to drop a missing collection', async () => {
      var cmgr = H.b.collections()
      await H.throwsHelper(async () => {
        await cmgr.dropCollection(testColl, testScope)
      }, H.lib.CollectionNotFoundError)
    })

    it('should successfully drop a scope', async () => {
      var cmgr = H.b.collections()
      await cmgr.dropScope(testScope)
    })

    it('should fail to drop a missing scope', async () => {
      var cmgr = H.b.collections()
      await H.throwsHelper(async () => {
        await cmgr.dropScope(testScope)
      }, H.lib.ScopeNotFoundError)
    })
  })
})
