'use strict';

const assert = require('chai').assert
const testdata = require('./testdata');

const H = require('./harness');

describe('#views', () => {
  H.requireFeature(H.Features.Views, () => {
    const testUid = H.genTestKey();
    const ddocKey = H.genTestKey();

    before(async () => {
      await testdata.upsertData(H.dco, testUid);

      await H.b.viewIndices().insertDesignDocument(ddocKey, {
        views: {
          simple: {
            map: `function(doc, meta){
                                if(meta.id.indexOf("${testUid}")==0){
                                  emit(meta.id);
                                }
                              }`
          }
        }
      });
    });

    after(async () => {
      await H.b.viewIndices().removeDesignDocument(ddocKey);

      await testdata.removeTestData(H.dco, testUid);
    });

    it('should see test data correctly', async () => {
      while (true) {
        var res = null;

        // We wrap this in a try-catch block since its possible that the
        // view won't be available to the query engine yet...
        try {
          res = await H.b.viewQuery(ddocKey, 'simple');
        } catch (err) {}

        if (!res || res.rows.length !== testdata.docCount()) {
          await H.sleep(100);
          continue;
        }

        assert.isArray(res.rows);
        assert.lengthOf(res.rows, testdata.docCount());
        assert.isObject(res.meta);
        // TODO: Assert that the meta is populated correctly

        break;
      }
    }).timeout(20000);
  });
});
