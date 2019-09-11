'use strict';

const assert = require('chai').assert
const testdata = require('./testdata');

const H = require('./harness');

describe.skip('#n1ql', () => {
  H.requireFeature(H.Features.N1ql, () => {
    const testUid = H.genTestKey();
    const idxName = H.genTestKey();
    const sidxName = H.genTestKey();

    before(async () => {
      await testdata.upsertData(H.dco, testUid);
    });

    after(async () => {
      await testdata.removeTestData(H.dco, testUid);
    });

    it('should successfully create a primary index', async () => {
      await H.c.queryIndexes().createPrimaryIndex(H.b.name, {
        name: idxName
      });
    }).timeout(60000);

    it('should fail to create a duplicate primary index', async () => {
      await H.throwsHelper(async () => {
        await H.c.queryIndexes().createPrimaryIndex(H.b.name, {
          name: idxName
        });
      }, H.lib.QueryIndexAlreadyExistsError);
    });

    it('should successfully create a secondary index', async () => {
      await H.c.queryIndexes().createIndex(H.b.name, sidxName, ['name']);
    }).timeout(20000);

    it('should fail to create a duplicate secondary index', async () => {
      await H.throwsHelper(async () => {
        await H.c.queryIndexes().createIndex(H.b.name, sidxName, ['name']);
      }, H.lib.QueryIndexAlreadyExistsError);
    });

    it('should see test data correctly', async () => {
      while (true) {
        var qs = 'SELECT * FROM ' + H.b.name +
          ' WHERE testUid="' + testUid + '"';
        var res = await H.b.query(qs);

        if (res.rows.length !== testdata.docCount()) {
          await H.sleep(100);
          continue;
        }

        assert.isArray(res.rows);
        assert.lengthOf(res.rows, testdata.docCount());
        assert.isObject(res.meta);

        break;
      }
    }).timeout(10000);

    it('should work with parameters correctly', async () => {
      while (true) {
        var qs = 'SELECT * FROM ' + H.b.name +
          ' WHERE testUid=$1';
        var res = await H.b.query(qs, [testUid]);

        if (res.rows.length !== testdata.docCount()) {
          await H.sleep(100);
          continue;
        }

        assert.isArray(res.rows);
        assert.lengthOf(res.rows, testdata.docCount());
        assert.isObject(res.meta);

        break;
      }
    }).timeout(10000);

    it('should successfully drop a secondary index', async () => {
      await H.c.queryIndexes().dropIndex(H.b.name, sidxName);
    });

    it('should fail to drop a missing secondary index', async () => {
      await H.throwsHelper(async () => {
        await H.c.queryIndexes().dropIndex(H.b.name, sidxName);
      }, H.lib.QueryIndexNotFoundError);
    });

    it('should successfully drop a primary index', async () => {
      await H.c.queryIndexes().dropPrimaryIndex(H.b.name, {
        name: idxName
      });
    });

    it('should fail to drop a missing primary index', async () => {
      await H.throwsHelper(async () => {
        await H.c.queryIndexes().dropPrimaryIndex(H.b.name, {
          name: idxName
        });
      }, H.lib.QueryIndexNotFoundError);
    });
  });
});
