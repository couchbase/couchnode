'use strict';

const assert = require('chai').assert
const testdata = require('./testdata');

const H = require('./harness');

describe.skip('#n1ql', () => {
  H.requireFeature(H.Features.N1ql, () => {
    const testUid = H.genTestKey();

    before(async () => {
      await testdata.upsertData(H.dco, testUid);

      try {
        await H.b.query('CREATE PRIMARY INDEX ON ' + H.b.name);
      } catch (e) {
        // We ignore any errors, and assume that if the index already
        // exists that this is not due to a testing error...
      }
    });

    after(async () => {
      await testdata.removeTestData(H.dco, testUid);
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
        // TODO: Assert that the meta is populated correctly

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
        // TODO: Assert that the meta is populated correctly

        break;
      }
    }).timeout(10000);
  });
});
