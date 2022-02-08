'use strict'

const assert = require('chai').assert
const testdata = require('./testdata')

const H = require('./harness')

describe('#views', function () {
  let testUid, ddocKey
  let testDocs

  before(async function () {
    H.skipIfMissingFeature(this, H.Features.Views)

    testUid = H.genTestKey()
    ddocKey = H.genTestKey()

    testDocs = await testdata.upsertData(H.dco, testUid)
  })

  after(async function () {
    await testdata.removeTestData(H.dco, testDocs)
  })

  it('should successfully create an index', async function () {
    var ddoc = new H.lib.DesignDocument(`dev_${ddocKey}`, {
      simple: new H.lib.DesignDocument.View(`
          function(doc, meta){
            if(meta.id.indexOf("${testUid}")==0){
              emit(meta.id);
            }
          }
        `),
    })
    await H.b.viewIndexes().upsertDesignDocument(ddoc)
  }).timeout(60000)

  it('should successfully publish an index', async function () {
    await H.b.viewIndexes().publishDesignDocument(ddocKey)
  })

  it('should fail to publish a non-existant index', async function () {
    await H.throwsHelper(async () => {
      await H.b.viewIndexes().publishDesignDocument('missing-index-name')
    }, H.lib.DesignDocumentNotFoundError)
  })

  it('should see test data correctly', async function () {
    /* eslint-disable-next-line no-constant-condition */
    while (true) {
      var res = null

      // We wrap this in a try-catch block since its possible that the
      // view won't be available to the query engine yet...
      try {
        res = await H.b.viewQuery(ddocKey, 'simple')
      } catch (err) {
        if (!(err instanceof H.lib.ViewNotFoundError)) {
          throw err
        }
      }

      if (!res || res.rows.length !== testdata.docCount()) {
        await H.sleep(100)
        continue
      }

      assert.isArray(res.rows)
      assert.lengthOf(res.rows, testdata.docCount())
      assert.isObject(res.meta)

      res.rows.forEach((row) => {
        assert.isDefined(row.id)
        assert.isDefined(row.key)
        assert.isDefined(row.value)
      })

      break
    }
  }).timeout(20000)

  it('should see test data correctly with a new connection', async function () {
    var cluster = await H.lib.Cluster.connect(H.connStr, H.connOpts)
    var bucket = cluster.bucket(H.bucketName)

    const res = await bucket.viewQuery(ddocKey, 'simple')
    assert.isArray(res.rows)
    assert.lengthOf(res.rows, testdata.docCount())
    assert.isObject(res.meta)

    res.rows.forEach((row) => {
      assert.isDefined(row.id)
      assert.isDefined(row.key)
      assert.isDefined(row.value)
    })

    await cluster.close()
  }).timeout(10000)

  it('should successfully drop an index', async function () {
    await H.b.viewIndexes().dropDesignDocument(ddocKey)
  })

  it('should fail to drop a non-existance index', async function () {
    await H.throwsHelper(async () => {
      await H.b.viewIndexes().dropDesignDocument('missing-index-name')
    }, H.lib.DesignDocumentNotFoundError)
  })
})
