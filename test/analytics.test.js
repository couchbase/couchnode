'use strict';

const assert = require('chai').assert
const testdata = require('./testdata');

const H = require('./harness');

describe('#analytics', () => {
  H.requireFeature(H.Features.Analytics, () => {
    const testUid = H.genTestKey();
    const dvName = H.genTestKey();
    const dsName = H.genTestKey();
    const idxName = H.genTestKey();

    before(async () => {
      await testdata.upsertData(H.dco, testUid);
    });

    after(async () => {
      await testdata.removeTestData(H.dco, testUid);
    });

    it('should successfully create a dataverse', async () => {
      await H.c.analyticsIndexes().createDataverse(dvName);
    });

    it('should successfully upsert a dataverse', async () => {
      await H.c.analyticsIndexes().createDataverse(dvName, {
        ignoreIfExists: true
      });
    });

    it('should fail to overwrite an existing index', async () => {
      await H.throwsHelper(async () => {
        await H.c.analyticsIndexes().createDataverse(dvName);
      }, H.lib.DataverseAlreadyExistsError);
    });
  });
});
