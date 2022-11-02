'use strict'

const assert = require('chai').assert
const testdata = require('./testdata')

const H = require('./harness')

describe('#analytics', function () {
  let testUid, dvName, dsName, idxName
  let testDocs

  before(async function () {
    H.skipIfMissingFeature(this, H.Features.Analytics)

    testUid = H.genTestKey()
    dvName = H.genTestKey()
    dsName = H.genTestKey()
    idxName = H.genTestKey()

    testDocs = await testdata.upsertData(H.dco, testUid)
  })

  after(async function () {
    await testdata.removeTestData(H.dco, testDocs)
  })

  it('should successfully create a dataverse', async function () {
    await H.c.analyticsIndexes().createDataverse(dvName)
  }).timeout(10000)

  it('should successfully upsert a dataverse', async function () {
    await H.c.analyticsIndexes().createDataverse(dvName, {
      ignoreIfExists: true,
    })
  }).timeout(10000)

  it('should fail to overwrite an existing dataverse', async function () {
    await H.throwsHelper(async () => {
      await H.c.analyticsIndexes().createDataverse(dvName)
    }, H.lib.DataverseExistsError)
  }).timeout(10000)

  it('should successfully create a dataset', async function () {
    await H.c.analyticsIndexes().createDataset(H.b.name, dsName, {
      dataverseName: dvName,
    })
  }).timeout(10000)

  it('should successfully upsert a dataset', async function () {
    await H.c.analyticsIndexes().createDataset(H.b.name, dsName, {
      dataverseName: dvName,
      ignoreIfExists: true,
    })
  }).timeout(10000)

  it('should fail to overwrite an existing dataset', async function () {
    await H.throwsHelper(async () => {
      await H.c.analyticsIndexes().createDataset(H.b.name, dsName, {
        dataverseName: dvName,
      })
    }, H.lib.DatasetExistsError)
  }).timeout(10000)

  it('should successfully create an index', async function () {
    await H.c.analyticsIndexes().createIndex(
      dsName,
      idxName,
      { name: 'string' },
      {
        dataverseName: dvName,
      }
    )
  }).timeout(10000)

  it('should successfully upsert an index', async function () {
    await H.c.analyticsIndexes().createIndex(
      dsName,
      idxName,
      { name: 'string' },
      {
        dataverseName: dvName,
        ignoreIfExists: true,
      }
    )
  }).timeout(10000)

  it('should fail to overwrite an existing index', async function () {
    await H.throwsHelper(async () => {
      await H.c.analyticsIndexes().createIndex(
        dsName,
        idxName,
        { name: 'string' },
        {
          dataverseName: dvName,
        }
      )
    }, H.lib.IndexExistsError)
  }).timeout(10000)

  it('should successfully connect a link', async function () {
    var targetName = '`' + dvName + '`.Local'
    await H.c.analyticsIndexes().connectLink(targetName)
  }).timeout(10000)

  it('should successfully list all datasets', async function () {
    var res = await H.c.analyticsIndexes().getAllDatasets()
    assert.isAtLeast(res.length, 1)
  })

  it('should successfully list all indexes', async function () {
    var res = await H.c.analyticsIndexes().getAllIndexes()
    assert.isAtLeast(res.length, 1)
  })

  it('should successfully get pending mutations', async function () {
    H.skipIfMissingFeature(this, H.Features.AnalyticsPendingMutations)
    var numPending = await H.c.analyticsIndexes().getPendingMutations()
    assert.isObject(numPending)
  })

  it('should see test data correctly', async function () {
    /* eslint-disable-next-line no-constant-condition */
    while (true) {
      var res = null

      // We wrap this in a try-catch block since its possible that the
      // view won't be available to the query engine yet...
      try {
        var targetName = '`' + dvName + '`.`' + dsName + '`'
        var qs = `SELECT * FROM ${targetName} WHERE testUid='${testUid}'`
        res = await H.c.analyticsQuery(qs)
      } catch (err) {} // eslint-disable-line no-empty

      if (!res || res.rows.length !== testdata.docCount()) {
        await H.sleep(100)
        continue
      }

      assert.isArray(res.rows)
      assert.lengthOf(res.rows, testdata.docCount())
      assert.isObject(res.meta)

      break
    }
  }).timeout(20000)

  it('should work with parameters correctly', async function () {
    /* eslint-disable-next-line no-constant-condition */
    while (true) {
      var res = null
      try {
        var targetName = '`' + dvName + '`.`' + dsName + '`'
        var qs = `SELECT * FROM ${targetName} WHERE testUid=$2`
        res = await H.c.analyticsQuery(qs, {
          parameters: [undefined, testUid],
        })
      } catch (e) {} // eslint-disable-line no-empty

      if (res.rows.length !== testdata.docCount()) {
        await H.sleep(100)
        continue
      }

      assert.isArray(res.rows)
      assert.lengthOf(res.rows, testdata.docCount())
      assert.isObject(res.meta)

      break
    }
  }).timeout(10000)

  it('should work with named parameters correctly', async function () {
    /* eslint-disable-next-line no-constant-condition */
    while (true) {
      var res = null
      try {
        var targetName = '`' + dvName + '`.`' + dsName + '`'
        var qs = `SELECT * FROM ${targetName} WHERE testUid=$tuid`
        res = await H.c.analyticsQuery(qs, {
          parameters: {
            tuid: testUid,
          },
        })
      } catch (e) {} // eslint-disable-line no-empty

      if (res.rows.length !== testdata.docCount()) {
        await H.sleep(100)
        continue
      }

      assert.isArray(res.rows)
      assert.lengthOf(res.rows, testdata.docCount())
      assert.isObject(res.meta)

      break
    }
  }).timeout(10000)

  it('should filter undefined named parameters', async function () {
    /* eslint-disable-next-line no-constant-condition */
    while (true) {
      var res = null
      try {
        var targetName = '`' + dvName + '`.`' + dsName + '`'
        var qs = `SELECT * FROM ${targetName} WHERE testUid=$tuid`
        res = await H.c.analyticsQuery(qs, {
          parameters: {
            tuid: testUid,
            filterMe: undefined,
          },
        })
      } catch (e) {} // eslint-disable-line no-empty

      if (res.rows.length !== testdata.docCount()) {
        await H.sleep(100)
        continue
      }

      assert.isArray(res.rows)
      assert.lengthOf(res.rows, testdata.docCount())
      assert.isObject(res.meta)

      break
    }
  }).timeout(10000)

  it('should work with lots of options specified', async function () {
    /* eslint-disable-next-line no-constant-condition */
    while (true) {
      var res = null
      try {
        var targetName = '`' + dvName + '`.`' + dsName + '`'
        res = await H.c.analyticsQuery(
          `SELECT * FROM ${targetName} WHERE testUid='${testUid}'`,
          {
            clientContextId: 'hello-world',
            readOnly: true,
          }
        )
      } catch (err) {} // eslint-disable-line no-empty

      if (!res || res.rows.length !== testdata.docCount()) {
        await H.sleep(100)
        continue
      }

      assert.isArray(res.rows)
      assert.lengthOf(res.rows, testdata.docCount())
      assert.isObject(res.meta)
      assert.isString(res.meta.requestId)
      assert.equal(res.meta.clientContextId, 'hello-world')
      assert.equal(res.meta.status, H.lib.AnalyticsStatus.Success)
      assert.isObject(res.meta.signature)
      assert.isObject(res.meta.metrics)

      break
    }
  }).timeout(20000)

  it('should successfully disconnect a link', async function () {
    var targetName = '`' + dvName + '`.Local'
    await H.c.analyticsIndexes().disconnectLink(targetName)
  })

  it('should successfully drop an index', async function () {
    await H.c.analyticsIndexes().dropIndex(dsName, idxName, {
      dataverseName: dvName,
    })
  })

  it('should successfully ignore a missing index when dropping', async function () {
    await H.c.analyticsIndexes().dropIndex(dsName, idxName, {
      dataverseName: dvName,
      ignoreIfNotExists: true,
    })
  })

  it('should fail to drop a missing index', async function () {
    await H.throwsHelper(async () => {
      await H.c.analyticsIndexes().dropIndex(dsName, idxName, {
        dataverseName: dvName,
      })
    }, H.lib.AnalyticsIndexNotFoundError)
  })

  it('should successfully drop a dataset', async function () {
    await H.c.analyticsIndexes().dropDataset(dsName, {
      dataverseName: dvName,
    })
  })

  it('should successfully ignore a missing dataset when dropping', async function () {
    await H.c.analyticsIndexes().dropDataset(dsName, {
      dataverseName: dvName,
      ignoreIfNotExists: true,
    })
  })

  it('should fail to drop a missing dataset', async function () {
    await H.throwsHelper(async () => {
      await H.c.analyticsIndexes().dropDataset(dsName, {
        dataverseName: dvName,
      })
    }, H.lib.DatasetNotFoundError)
  })

  it('should successfully drop a dataverse', async function () {
    await H.c.analyticsIndexes().dropDataverse(dvName)
  })

  it('should successfully ignore a missing dataverse when dropping', async function () {
    await H.c.analyticsIndexes().dropDataverse(dvName, {
      ignoreIfNotExists: true,
    })
  })

  it('should fail to drop a missing dataverse', async function () {
    await H.throwsHelper(async () => {
      await H.c.analyticsIndexes().dropDataverse(dvName)
    }, H.lib.DataverseNotFoundError)
  })
})
