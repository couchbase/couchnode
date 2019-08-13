'use strict';

const assert = require('chai').assert
const testdata = require('./testdata');

const H = require('./harness');

describe('#collectionmanager', () => {
  H.requireFeature(H.Features.Collections, () => {
    var testScope = H.genTestKey();
    var testColl = H.genTestKey();

    it('should successfully create a scope', async () => {
      var cmgr = H.b.collections();
      await cmgr.createScope(testScope);
    });

    it('should emit the correct error on duplicate scopes', async () => {
      var cmgr = H.b.collections();
      await H.throwsHelper(async () => {
        await cmgr.createScope(testScope);
      }, H.lib.ScopeAlreadyExistsError);
    });

    it('should successfully create a collection', async () => {
      var cmgr = H.b.collections();
      await cmgr.createCollection(testColl, testScope);
    });

    it('should emit the correct error on duplicate collections', async () => {
      var cmgr = H.b.collections();
      await H.throwsHelper(async () => {
        await cmgr.createCollection(testColl, testScope);
      }, H.lib.CollectionAlreadyExistsError);
    });

    it('should emit the correct error on missing scopes', async () => {
      var cmgr = H.b.collections();
      await H.throwsHelper(async () => {
        await cmgr.createCollection('some-scope-for-testing', 'invalid-scope');
      }, H.lib.ScopeNotFoundError);
    });

    it('should successfully drop a collection', async () => {
      var cmgr = H.b.collections();
      await cmgr.dropCollection(testColl, testScope);
    });

    it('should successfully drop a scope', async () => {
      var cmgr = H.b.collections();
      await cmgr.dropScope(testScope);
    });

  });
});
