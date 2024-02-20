'use strict'

const assert = require('chai').assert
const testdata = require('./testdata')

const H = require('./harness')
const { DesignDocumentNamespace } = require('../lib/viewtypes')
const {
  DesignDocument,
  DesignDocumentView,
} = require('../lib/viewindexmanager')

describe('#views', function () {
  let testUid, ddocKey
  let testDocs
  let mapFunc

  before(async function () {
    H.skipIfMissingFeature(this, H.Features.Views)

    const tmpKey = H.genTestKey()
    const tokens = tmpKey.split('_')
    testUid = tokens[0]
    ddocKey = H.genTestKey()

    testDocs = await testdata.upsertData(H.dco, testUid)
    mapFunc = `
    function(doc, meta){
      if(meta.id.indexOf("${testUid}")==0){
        const newDoc = {
          batch: "${testUid}",
          id: meta.id,
          name: doc.name
        };
        const batches = newDoc.id.split('::')
        if (parseInt(batches[1]) < 2) {
          const key = batches[0].slice(0, 2)
          emit(key, newDoc)
        } else if (parseInt(batches[1]) >= 2 && parseInt(batches[1]) < 4) {
          const key = batches[0].slice(2, 4)
          emit(key, newDoc);
        } else if (parseInt(batches[1]) >= 4 && parseInt(batches[1]) < 6) {
          const key = batches[0].slice(4, 6)
          emit(key, newDoc);
        } else {
          const key = batches[0].slice(-2)
          emit(key, newDoc);
        }
      }
    }
  `
  })

  after(async function () {
    await testdata.removeTestData(H.dco, testDocs)
  })

  describe('#viewmgmt-deprecated', function () {
    it('should successfully create an index', async function () {
      var ddoc = new H.lib.DesignDocument({
        name: `dev_${ddocKey}`,
        views: {
          simple: new H.lib.DesignDocumentView({ map: mapFunc }),
        },
      })
      await H.b.viewIndexes().upsertDesignDocument(ddoc)
      await H.consistencyUtils.waitUntilDesignDocumentPresent(
        H.bucketName,
        `dev_${ddocKey}`
      )
    }).timeout(60000)

    it('should successfully get a development index', async function () {
      const res = await H.b.viewIndexes().getDesignDocument(`dev_${ddocKey}`)
      assert.instanceOf(res, DesignDocument)
      assert.isTrue(res.name === ddocKey)
      assert.isTrue(res.namespace === DesignDocumentNamespace.Development)
      assert.isObject(res.views)
      assert.isTrue(Object.keys(res.views).length == 1)
      assert.isTrue(Object.keys(res.views)[0] == 'simple')
      assert.instanceOf(res.views.simple, DesignDocumentView)
      assert.strictEqual(res.views.simple.map, mapFunc)
    })

    it('should successfully drop a development index index', async function () {
      await H.b.viewIndexes().dropDesignDocument(`dev_${ddocKey}`)
      await H.consistencyUtils.waitUntilDesignDocumentDropped(
        H.bucketName,
        ddocKey
      )
    })

    it('should successfully recreate an index', async function () {
      var ddoc = new H.lib.DesignDocument({
        name: `dev_${ddocKey}`,
        views: {
          simple: new H.lib.DesignDocumentView({ map: mapFunc }),
        },
      })
      await H.b.viewIndexes().upsertDesignDocument(ddoc)
      await H.consistencyUtils.waitUntilDesignDocumentPresent(
        H.bucketName,
        `dev_${ddocKey}`
      )
    }).timeout(60000)

    it('should successfully publish an index', async function () {
      await H.b.viewIndexes().publishDesignDocument(ddocKey)
    })

    it('should fail to publish a non-existent index', async function () {
      await H.throwsHelper(async () => {
        await H.b.viewIndexes().publishDesignDocument('missing-index-name')
      }, H.lib.DesignDocumentNotFoundError)
    })

    it('should successfully get a production index', async function () {
      const res = await H.b.viewIndexes().getDesignDocument(ddocKey)
      assert.instanceOf(res, DesignDocument)
      assert.isTrue(res.name === ddocKey)
      assert.isTrue(res.namespace === DesignDocumentNamespace.Production)
      assert.isObject(res.views)
      assert.isTrue(Object.keys(res.views).length == 1)
      assert.isTrue(Object.keys(res.views)[0] == 'simple')
      assert.instanceOf(res.views.simple, DesignDocumentView)
      assert.strictEqual(res.views.simple.map, mapFunc)
    })

    it('should successfully get all indexes', async function () {
      const res = await H.b.viewIndexes().getAllDesignDocuments()
      assert.isArray(res)
      assert.isTrue(res.length == 1)
      assert.isTrue(res.every((dd) => dd instanceof DesignDocument))
    })

    it('should successfully drop a production index', async function () {
      await H.b.viewIndexes().dropDesignDocument(ddocKey)
      await H.consistencyUtils.waitUntilDesignDocumentDropped(
        H.bucketName,
        ddocKey
      )
    })

    it('should fail to drop a non-existent index', async function () {
      await H.throwsHelper(async () => {
        await H.b.viewIndexes().dropDesignDocument('missing-index-name')
      }, H.lib.DesignDocumentNotFoundError)
    })
  })

  describe('#viewmgmt-deprecated-callback', function () {
    it('should successfully create an index', function (done) {
      var ddoc = new H.lib.DesignDocument({
        name: `dev_${ddocKey}`,
        views: {
          simple: new H.lib.DesignDocumentView({ map: mapFunc }),
        },
      })
      H.b.viewIndexes().upsertDesignDocument(ddoc, async (err) => {
        if (err) {
          return done(err)
        }
        try {
          await H.consistencyUtils.waitUntilDesignDocumentPresent(
            H.bucketName,
            `dev_${ddocKey}`
          )
          done()
        } catch (e) {
          done(e)
        }
      })
    }).timeout(60000)

    it('should successfully get a development index', function (done) {
      H.b.viewIndexes().getDesignDocument(`dev_${ddocKey}`, (err, res) => {
        if (err) {
          return done(err)
        }
        try {
          assert.instanceOf(res, DesignDocument)
          assert.isTrue(res.name === ddocKey)
          assert.isTrue(res.namespace === DesignDocumentNamespace.Development)
          assert.isObject(res.views)
          assert.isTrue(Object.keys(res.views).length == 1)
          assert.isTrue(Object.keys(res.views)[0] == 'simple')
          assert.instanceOf(res.views.simple, DesignDocumentView)
          assert.strictEqual(res.views.simple.map, mapFunc)
          done()
        } catch (e) {
          done(e)
        }
      })
    })

    it('should successfully drop a development index index', function (done) {
      H.b.viewIndexes().dropDesignDocument(`dev_${ddocKey}`, async (err) => {
        if (err) {
          return done(err)
        }
        try {
          await H.consistencyUtils.waitUntilDesignDocumentDropped(
            H.bucketName,
            ddocKey
          )
          done()
        } catch (e) {
          done(e)
        }
      })
    })

    it('should successfully recreate an index', function (done) {
      var ddoc = new H.lib.DesignDocument({
        name: `dev_${ddocKey}`,
        views: {
          simple: new H.lib.DesignDocumentView({ map: mapFunc }),
        },
      })
      H.b.viewIndexes().upsertDesignDocument(ddoc, async (err) => {
        if (err) {
          return done(err)
        }
        try {
          await H.consistencyUtils.waitUntilDesignDocumentPresent(
            H.bucketName,
            `dev_${ddocKey}`
          )
          done()
        } catch (e) {
          done(e)
        }
      })
    }).timeout(60000)

    it('should successfully publish an index', function (done) {
      H.b.viewIndexes().publishDesignDocument(ddocKey, (err) => {
        if (err) {
          return done(err)
        }
        done()
      })
    })

    it('should fail to publish a non-existent index', function (done) {
      H.b.viewIndexes().publishDesignDocument('missing-index-name', (err) => {
        try {
          assert.isOk(err)
          assert.instanceOf(err, H.lib.DesignDocumentNotFoundError)
          done()
        } catch (e) {
          done(e)
        }
      })
    })

    it('should successfully get a production index', function (done) {
      H.b.viewIndexes().getDesignDocument(ddocKey, (err, res) => {
        if (err) {
          return done(err)
        }
        try {
          assert.instanceOf(res, DesignDocument)
          assert.isTrue(res.name === ddocKey)
          assert.isTrue(res.namespace === DesignDocumentNamespace.Production)
          assert.isObject(res.views)
          assert.isTrue(Object.keys(res.views).length == 1)
          assert.isTrue(Object.keys(res.views)[0] == 'simple')
          assert.instanceOf(res.views.simple, DesignDocumentView)
          assert.strictEqual(res.views.simple.map, mapFunc)
          done()
        } catch (e) {
          done(e)
        }
      })
    })

    it('should successfully get all indexes', function (done) {
      H.b.viewIndexes().getAllDesignDocuments((err, res) => {
        if (err) {
          return done(err)
        }
        try {
          assert.isArray(res)
          assert.isTrue(res.length == 1)
          assert.isTrue(res.every((dd) => dd instanceof DesignDocument))
          done()
        } catch (e) {
          done(e)
        }
      })
    })

    it('should successfully drop a production index', function (done) {
      H.b.viewIndexes().dropDesignDocument(ddocKey, async (err) => {
        if (err) {
          return done(err)
        }
        try {
          await H.consistencyUtils.waitUntilDesignDocumentDropped(
            H.bucketName,
            ddocKey
          )
          done()
        } catch (e) {
          done(e)
        }
      })
    })

    it('should fail to drop a non-existent index', function (done) {
      H.b.viewIndexes().dropDesignDocument('missing-index-name', (err) => {
        try {
          assert.isOk(err)
          assert.instanceOf(err, H.lib.DesignDocumentNotFoundError)
          done()
        } catch (e) {
          done(e)
        }
      })
    })
  })

  describe('#viewmgmt', function () {
    it('should successfully create an index', async function () {
      var ddoc = new H.lib.DesignDocument({
        name: ddocKey,
        views: {
          simple: new H.lib.DesignDocumentView({ map: mapFunc }),
        },
      })
      await H.b
        .viewIndexes()
        .upsertDesignDocument(ddoc, DesignDocumentNamespace.Development)
      await H.consistencyUtils.waitUntilDesignDocumentPresent(
        H.bucketName,
        `dev_${ddocKey}`
      )
    }).timeout(60000)

    it('should successfully get a development index', async function () {
      const res = await H.b
        .viewIndexes()
        .getDesignDocument(ddocKey, DesignDocumentNamespace.Development)
      assert.instanceOf(res, DesignDocument)
      assert.isTrue(res.name === ddocKey)
      assert.isTrue(res.namespace === DesignDocumentNamespace.Development)
      assert.isObject(res.views)
      assert.isTrue(Object.keys(res.views).length == 1)
      assert.isTrue(Object.keys(res.views)[0] == 'simple')
      assert.instanceOf(res.views.simple, DesignDocumentView)
      assert.strictEqual(res.views.simple.map, mapFunc)
    })

    it('should successfully drop a development index', async function () {
      await H.b
        .viewIndexes()
        .dropDesignDocument(ddocKey, DesignDocumentNamespace.Development)
      await H.consistencyUtils.waitUntilDesignDocumentDropped(
        H.bucketName,
        `dev_${ddocKey}`
      )
    })

    it('should successfully recreate an index', async function () {
      var ddoc = new H.lib.DesignDocument({
        name: ddocKey,
        views: {
          simple: new H.lib.DesignDocumentView({ map: mapFunc }),
        },
      })
      await H.b
        .viewIndexes()
        .upsertDesignDocument(ddoc, DesignDocumentNamespace.Development)
      await H.consistencyUtils.waitUntilDesignDocumentPresent(
        H.bucketName,
        `dev_${ddocKey}`
      )
    }).timeout(60000)

    it('should successfully publish an index', async function () {
      await H.b.viewIndexes().publishDesignDocument(ddocKey)
    })

    it('should fail to publish a non-existent index', async function () {
      await H.throwsHelper(async () => {
        await H.b.viewIndexes().publishDesignDocument('missing-index-name')
      }, H.lib.DesignDocumentNotFoundError)
    })

    it('should successfully get a production index', async function () {
      const res = await H.b
        .viewIndexes()
        .getDesignDocument(ddocKey, DesignDocumentNamespace.Production)
      assert.instanceOf(res, DesignDocument)
      assert.isTrue(res.name === ddocKey)
      assert.isTrue(res.namespace === DesignDocumentNamespace.Production)
      assert.isObject(res.views)
      assert.isTrue(Object.keys(res.views).length == 1)
      assert.isTrue(Object.keys(res.views)[0] == 'simple')
      assert.instanceOf(res.views.simple, DesignDocumentView)
      assert.strictEqual(res.views.simple.map, mapFunc)
    })

    it('should successfully get all indexes', async function () {
      const res = await H.b
        .viewIndexes()
        .getAllDesignDocuments(DesignDocumentNamespace.Production)
      assert.isArray(res)
      console.log(res.length)
      assert.isTrue(res.length == 1)
      assert.isTrue(res.every((dd) => dd instanceof DesignDocument))
    })

    it('should successfully drop a production index', async function () {
      await H.b
        .viewIndexes()
        .dropDesignDocument(ddocKey, DesignDocumentNamespace.Production)
      await H.consistencyUtils.waitUntilDesignDocumentDropped(
        H.bucketName,
        ddocKey
      )
    })

    it('should fail to drop a non-existent index', async function () {
      await H.throwsHelper(async () => {
        await H.b
          .viewIndexes()
          .dropDesignDocument(
            'missing-index-name',
            DesignDocumentNamespace.Development
          )
      }, H.lib.DesignDocumentNotFoundError)
    })
  })

  describe('#viewmgmt-callback', function () {
    it('should successfully create an index', function (done) {
      var ddoc = new H.lib.DesignDocument({
        name: ddocKey,
        views: {
          simple: new H.lib.DesignDocumentView({ map: mapFunc }),
        },
      })
      H.b
        .viewIndexes()
        .upsertDesignDocument(
          ddoc,
          DesignDocumentNamespace.Development,
          async (err) => {
            if (err) {
              return done(err)
            }
            try {
              await H.consistencyUtils.waitUntilDesignDocumentPresent(
                H.bucketName,
                `dev_${ddocKey}`
              )
              done()
            } catch (e) {
              done(e)
            }
          }
        )
    }).timeout(60000)

    it('should successfully get a development index', function (done) {
      H.b
        .viewIndexes()
        .getDesignDocument(
          ddocKey,
          DesignDocumentNamespace.Development,
          (err, res) => {
            if (err) {
              return done(err)
            }
            try {
              assert.instanceOf(res, DesignDocument)
              assert.isTrue(res.name === ddocKey)
              assert.isTrue(
                res.namespace === DesignDocumentNamespace.Development
              )
              assert.isObject(res.views)
              assert.isTrue(Object.keys(res.views).length == 1)
              assert.isTrue(Object.keys(res.views)[0] == 'simple')
              assert.instanceOf(res.views.simple, DesignDocumentView)
              assert.strictEqual(res.views.simple.map, mapFunc)
              done()
            } catch (e) {
              done(e)
            }
          }
        )
    })

    it('should successfully drop a development index', function (done) {
      H.b
        .viewIndexes()
        .dropDesignDocument(
          ddocKey,
          DesignDocumentNamespace.Development,
          async (err) => {
            if (err) {
              return done(err)
            }
            try {
              await H.consistencyUtils.waitUntilDesignDocumentDropped(
                H.bucketName,
                `dev_${ddocKey}`
              )
              done()
            } catch (e) {
              done(e)
            }
          }
        )
    })

    it('should successfully recreate an index', function (done) {
      var ddoc = new H.lib.DesignDocument({
        name: ddocKey,
        views: {
          simple: new H.lib.DesignDocumentView({ map: mapFunc }),
        },
      })
      H.b
        .viewIndexes()
        .upsertDesignDocument(
          ddoc,
          DesignDocumentNamespace.Development,
          async (err) => {
            if (err) {
              return done(err)
            }
            try {
              await H.consistencyUtils.waitUntilDesignDocumentPresent(
                H.bucketName,
                `dev_${ddocKey}`
              )
              done()
            } catch (e) {
              done(e)
            }
          }
        )
    }).timeout(60000)

    it('should successfully publish an index', function (done) {
      H.b.viewIndexes().publishDesignDocument(ddocKey, (err) => {
        if (err) {
          return done(err)
        }
        done()
      })
    })

    it('should fail to publish a non-existent index', function (done) {
      H.b.viewIndexes().publishDesignDocument('missing-index-name', (err) => {
        try {
          assert.isOk(err)
          assert.instanceOf(err, H.lib.DesignDocumentNotFoundError)
          done()
        } catch (e) {
          done(e)
        }
      })
    })

    it('should successfully get a production index', function (done) {
      H.b
        .viewIndexes()
        .getDesignDocument(
          ddocKey,
          DesignDocumentNamespace.Production,
          {},
          (err, res) => {
            if (err) {
              return done(err)
            }
            try {
              assert.instanceOf(res, DesignDocument)
              assert.isTrue(res.name === ddocKey)
              assert.isTrue(
                res.namespace === DesignDocumentNamespace.Production
              )
              assert.isObject(res.views)
              assert.isTrue(Object.keys(res.views).length == 1)
              assert.isTrue(Object.keys(res.views)[0] == 'simple')
              assert.instanceOf(res.views.simple, DesignDocumentView)
              assert.strictEqual(res.views.simple.map, mapFunc)
              done()
            } catch (e) {
              done(e)
            }
          }
        )
    })

    it('should successfully get all indexes', function (done) {
      H.b
        .viewIndexes()
        .getAllDesignDocuments(
          DesignDocumentNamespace.Production,
          (err, res) => {
            if (err) {
              return done(err)
            }
            try {
              assert.isArray(res)
              assert.isTrue(res.length == 1)
              assert.isTrue(res.every((dd) => dd instanceof DesignDocument))
              done()
            } catch (e) {
              done(e)
            }
          }
        )
    })

    it('should successfully drop a production index', function (done) {
      H.b
        .viewIndexes()
        .dropDesignDocument(
          ddocKey,
          DesignDocumentNamespace.Production,
          async (err) => {
            if (err) {
              return done(err)
            }
            try {
              await H.consistencyUtils.waitUntilDesignDocumentDropped(
                H.bucketName,
                ddocKey
              )
              done()
            } catch (e) {
              done(e)
            }
          }
        )
    })

    it('should fail to drop a non-existent index', function (done) {
      H.b
        .viewIndexes()
        .dropDesignDocument(
          'missing-index-name',
          DesignDocumentNamespace.Development,
          (err) => {
            try {
              assert.isOk(err)
              assert.instanceOf(err, H.lib.DesignDocumentNotFoundError)
              done()
            } catch (e) {
              done(e)
            }
          }
        )
    })
  })

  describe('#viewquery', function () {
    it('should successfully create an index', async function () {
      var ddoc = new H.lib.DesignDocument({
        name: ddocKey,
        views: {
          simple: new H.lib.DesignDocumentView({ map: mapFunc }),
        },
      })
      await H.b.viewIndexes().upsertDesignDocument(ddoc)
      await H.consistencyUtils.waitUntilDesignDocumentPresent(
        H.bucketName,
        ddocKey
      )
    }).timeout(60000)

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
      await H.consistencyUtils.waitUntilDesignDocumentDropped(
        H.bucketName,
        ddocKey
      )
    })
  })
})
