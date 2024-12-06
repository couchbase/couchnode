'use strict'

const assert = require('chai').assert
const testdata = require('./testdata')

const H = require('./harness')
const {
  DesignDocumentNamespace,
  ViewOrdering,
  ViewRow,
} = require('../lib/viewtypes')
const {
  DesignDocument,
  DesignDocumentView,
} = require('../lib/viewindexmanager')

function* getTestUidKeys(testUid, keySize) {
  for (let i = 0; i < testUid.length; i += keySize) {
    yield testUid.slice(i, i + keySize)
  }
}

function getkeysAndDocIds(testDocs) {
  const keysAndDocIds = {}
  for (let i = 0; i < testDocs.length; i++) {
    const tokens = testDocs[i].split('::')
    let key
    if (parseInt(tokens[1]) < 2) {
      key = tokens[0].slice(0, 2)
    } else if (parseInt(tokens[1]) >= 2 && parseInt(tokens[1]) < 4) {
      key = tokens[0].slice(2, 4)
    } else if (parseInt(tokens[1]) >= 4 && parseInt(tokens[1]) < 6) {
      key = tokens[0].slice(4, 6)
    } else {
      key = tokens[0].slice(-2)
    }
    if (key in keysAndDocIds) {
      keysAndDocIds[key].push(testDocs[i])
    } else {
      keysAndDocIds[key] = [testDocs[i]]
    }
  }
  return keysAndDocIds
}

function getSortedDocIds(testDocs, desc = false) {
  const keysAndDocIds = getkeysAndDocIds(testDocs)
  return desc
    ? Object.keys(keysAndDocIds)
        .sort()
        .reverse()
        .reduce((arr, key) => {
          return arr.concat(keysAndDocIds[key].sort().reverse())
        }, [])
    : Object.keys(keysAndDocIds)
        .sort()
        .reduce((arr, key) => {
          return arr.concat(keysAndDocIds[key])
        }, [])
}

describe('#views', function () {
  let testUid, ddocKey
  let testDocs
  let mapFunc

  before(async function () {
    H.skipIfMissingFeature(this, H.Features.Views)
    this.timeout(60000)

    const tmpKey = H.genTestKey()
    const tokens = tmpKey.split('_')
    testUid = tokens[0]
    ddocKey = H.genTestKey()

    testDocs = await testdata.upsertData(H.dco, testUid)
    // 40.5s for all retries, excludes time for actual operations (specifically the batched remove)
    await H.tryNTimes(3, 1000, async () => {
      try {
        // w/ 3 retries for each doc (TEST_DOCS.length == 9) w/ 500ms delay, 1.5s * 9 = 22.5s
        const result = await testdata.upsertData(H.dco, testUid)
        if (!result.every((r) => r.status === 'fulfilled')) {
          throw new Error('Failed to upsert all test data')
        }
        testDocs = result.map((r) => r.value)
      } catch (err) {
        await testdata.removeTestData(H.dco, testDocs)
        throw err
      }
    })
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
    try {
      await testdata.removeTestData(H.dco, testDocs)
    } catch (e) {
      // ignore
    }
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
      const vmgr = H.b.viewIndexes()
      await vmgr.publishDesignDocument(ddocKey)
      await H.tryNTimes(5, 1000, vmgr.getDesignDocument.bind(vmgr), ddocKey)
    }).timeout(7500)

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
      const vmgr = H.b.viewIndexes()
      H.tryNTimesWithCallback(
        5,
        1000,
        vmgr.publishDesignDocument.bind(vmgr),
        ddocKey,
        (err) => {
          if (err) {
            return done(err)
          }
          H.tryNTimesWithCallback(
            5,
            1000,
            vmgr.getDesignDocument.bind(vmgr),
            ddocKey,
            /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
            (err, res) => {
              if (err) {
                return done(err)
              }
              done()
            }
          )
        }
      )
    }).timeout(12500)

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
      const vmgr = H.b.viewIndexes()
      await vmgr.publishDesignDocument(ddocKey)
      await H.tryNTimes(
        5,
        1000,
        vmgr.getDesignDocument.bind(vmgr),
        ddocKey,
        DesignDocumentNamespace.Production
      )
    }).timeout(7500)

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
      const vmgr = H.b.viewIndexes()
      H.tryNTimesWithCallback(
        5,
        1000,
        vmgr.publishDesignDocument.bind(vmgr),
        ddocKey,
        (err) => {
          if (err) {
            return done(err)
          }

          H.tryNTimesWithCallback(
            5,
            1000,
            vmgr.getDesignDocument.bind(vmgr),
            ddocKey,
            DesignDocumentNamespace.Production,
            {},
            /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
            (err, res) => {
              if (err) {
                return done(err)
              }
              done()
            }
          )
        }
      )
    }).timeout(12500)

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
      await H.b
        .viewIndexes()
        .upsertDesignDocument(ddoc, DesignDocumentNamespace.Development)
      await H.consistencyUtils.waitUntilDesignDocumentPresent(
        H.bucketName,
        `dev_${ddocKey}`
      )
    }).timeout(60000)

    it('should see test data correctly', async function () {
      /* eslint-disable-next-line no-constant-condition */
      while (true) {
        var res = null

        // We wrap this in a try-catch block since its possible that the
        // view won't be available to the query engine yet...
        try {
          res = await H.b.viewQuery(ddocKey, 'simple', {
            namespace: DesignDocumentNamespace.Development,
            fullSet: true,
          })
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

      const res = await bucket.viewQuery(ddocKey, 'simple', {
        namespace: DesignDocumentNamespace.Development,
      })
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

    it('should receive results in ASC order', async function () {
      /* eslint-disable-next-line no-constant-condition */
      while (true) {
        var res = null

        // We wrap this in a try-catch block since its possible that the
        // view won't be available to the query engine yet...
        try {
          res = await H.b.viewQuery(ddocKey, 'simple', {
            namespace: DesignDocumentNamespace.Development,
            order: ViewOrdering.Ascending,
          })
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

        const expected = getSortedDocIds(testDocs)
        assert.deepStrictEqual(
          res.rows.map((r) => r.id),
          expected
        )
        break
      }
    }).timeout(20000)

    it('should receive results in DESC order', async function () {
      /* eslint-disable-next-line no-constant-condition */
      while (true) {
        var res = null

        // We wrap this in a try-catch block since its possible that the
        // view won't be available to the query engine yet...
        try {
          res = await H.b.viewQuery(ddocKey, 'simple', {
            namespace: DesignDocumentNamespace.Development,
            order: ViewOrdering.Descending,
          })
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

        const expected = getSortedDocIds(testDocs, true)
        assert.deepStrictEqual(
          res.rows.map((r) => r.id),
          expected
        )
        break
      }
    }).timeout(20000)

    it('should receive results using endkey and endkey_docids', async function () {
      const testUidKeys = [...getTestUidKeys(testUid, 2)]
      const sortedTestUidKeys = [...testUidKeys].sort()
      // get the 1st and 2nd smallest keys
      const smallestKeyIdx = testUidKeys.indexOf(sortedTestUidKeys[0])
      const keyIdx = testUidKeys.indexOf(sortedTestUidKeys[1])
      const key = testUidKeys[keyIdx]
      const keysAndDocIds = getkeysAndDocIds(testDocs)
      const endKeyDocId = keysAndDocIds[key][keysAndDocIds[key].length - 1]
      const expectedCount =
        keysAndDocIds[testUidKeys[smallestKeyIdx]].length +
        keysAndDocIds[key].length
      /* eslint-disable-next-line no-constant-condition */
      while (true) {
        var res = null

        // We wrap this in a try-catch block since its possible that the
        // view won't be available to the query engine yet...
        try {
          res = await H.b.viewQuery(ddocKey, 'simple', {
            namespace: DesignDocumentNamespace.Development,
            idRange: { end: endKeyDocId },
            range: { end: key },
          })
        } catch (err) {
          if (!(err instanceof H.lib.ViewNotFoundError)) {
            throw err
          }
        }

        if (!res || res.rows.length !== expectedCount) {
          await H.sleep(100)
          continue
        }

        assert.isArray(res.rows)
        assert.lengthOf(res.rows, expectedCount)
        assert.isObject(res.meta)

        assert.strictEqual(res.rows[res.rows.length - 1].key, key)
        assert.strictEqual(res.rows[res.rows.length - 1].id, endKeyDocId)
        break
      }
    }).timeout(20000)

    it('should receive results using startkey and startkey_docids', async function () {
      const testUidKeys = [...getTestUidKeys(testUid, 2)]
      const sortedTestUidKeys = [...testUidKeys].sort()
      // get the largest key
      const keyIdx = testUidKeys.indexOf(
        sortedTestUidKeys[sortedTestUidKeys.length - 1]
      )
      const key = testUidKeys[keyIdx]
      const keysAndDocIds = getkeysAndDocIds(testDocs)
      const startKeyDocId = keysAndDocIds[key][keysAndDocIds[key].length - 1]
      const expectedCount = 1

      // run a query so we can have pagination
      await H.b.viewQuery(ddocKey, 'simple', {
        namespace: DesignDocumentNamespace.Development,
        limit: 2,
      })
      /* eslint-disable-next-line no-constant-condition */
      while (true) {
        var res = null

        // We wrap this in a try-catch block since its possible that the
        // view won't be available to the query engine yet...
        try {
          res = await H.b.viewQuery(ddocKey, 'simple', {
            namespace: DesignDocumentNamespace.Development,
            limit: 2,
            idRange: { start: startKeyDocId },
            range: { start: key },
          })
        } catch (err) {
          if (!(err instanceof H.lib.ViewNotFoundError)) {
            throw err
          }
        }

        if (!res || res.rows.length !== expectedCount) {
          await H.sleep(100)
          continue
        }

        assert.isArray(res.rows)
        assert.lengthOf(res.rows, expectedCount)
        assert.isObject(res.meta)

        assert.strictEqual(res.rows[0].key, key)
        assert.strictEqual(res.rows[0].id, startKeyDocId)
        break
      }
    }).timeout(20000)

    it('should receive results using a specific key', async function () {
      const testUidKeys = [...getTestUidKeys(testUid, 2)]
      const key = testUidKeys[0]
      const keysAndDocIds = getkeysAndDocIds(testDocs)
      const expectedDocIds = keysAndDocIds[key]
      const expectedCount = expectedDocIds.length
      /* eslint-disable-next-line no-constant-condition */
      while (true) {
        var res = null

        // We wrap this in a try-catch block since its possible that the
        // view won't be available to the query engine yet...
        try {
          res = await H.b.viewQuery(ddocKey, 'simple', {
            namespace: DesignDocumentNamespace.Development,
            key: key,
          })
        } catch (err) {
          if (!(err instanceof H.lib.ViewNotFoundError)) {
            throw err
          }
        }

        if (!res || res.rows.length !== expectedCount) {
          await H.sleep(100)
          continue
        }

        assert.isArray(res.rows)
        assert.lengthOf(res.rows, expectedCount)
        assert.isObject(res.meta)
        for (const row of res.rows) {
          assert.instanceOf(row, ViewRow)
          assert.isString(row.id)
          assert.isString(row.key)
          assert.isObject(row.value)
          assert.strictEqual(row.key, key)
          assert.isTrue(expectedDocIds.includes(row.value.id))
        }

        break
      }
    }).timeout(20000)

    it('should receive results using a specific keys', async function () {
      const testUidKeys = [...getTestUidKeys(testUid, 2)]
      const expectedKeys = testUidKeys.slice(0, 2)
      const keysAndDocIds = getkeysAndDocIds(testDocs)
      const expectedDocIds = keysAndDocIds[expectedKeys[0]].concat(
        keysAndDocIds[expectedKeys[1]]
      )
      const expectedCount = expectedDocIds.length
      /* eslint-disable-next-line no-constant-condition */
      while (true) {
        var res = null

        // We wrap this in a try-catch block since its possible that the
        // view won't be available to the query engine yet...
        try {
          res = await H.b.viewQuery(ddocKey, 'simple', {
            namespace: DesignDocumentNamespace.Development,
            keys: expectedKeys,
          })
        } catch (err) {
          if (!(err instanceof H.lib.ViewNotFoundError)) {
            throw err
          }
        }

        if (!res || res.rows.length !== expectedCount) {
          await H.sleep(100)
          continue
        }

        assert.isArray(res.rows)
        assert.lengthOf(res.rows, expectedCount)
        assert.isObject(res.meta)
        for (const row of res.rows) {
          assert.instanceOf(row, ViewRow)
          assert.isString(row.id)
          assert.isString(row.key)
          assert.isObject(row.value)
          assert.isTrue(expectedKeys.includes(row.key))
          assert.isTrue(expectedDocIds.includes(row.value.id))
        }
        break
      }
    }).timeout(20000)

    it('should receive results using raw option', async function () {
      const testUidKeys = [...getTestUidKeys(testUid, 2)]
      const sortedTestUidKeys = [...testUidKeys].sort()
      // get the largest key
      const keyIdx = testUidKeys.indexOf(
        sortedTestUidKeys[sortedTestUidKeys.length - 1]
      )
      const key = testUidKeys[keyIdx]
      const keysAndDocIds = getkeysAndDocIds(testDocs)
      const startKeyDocId = keysAndDocIds[key][keysAndDocIds[key].length - 1]
      const expectedCount = 1

      // run a query so we can have pagination
      await H.b.viewQuery(ddocKey, 'simple', {
        namespace: DesignDocumentNamespace.Development,
        limit: 2,
      })

      /* eslint-disable-next-line no-constant-condition */
      while (true) {
        var res = null

        // We wrap this in a try-catch block since its possible that the
        // view won't be available to the query engine yet...
        try {
          res = await H.b.viewQuery(ddocKey, 'simple', {
            namespace: DesignDocumentNamespace.Development,
            raw: {
              limit: '2',
              startkey: JSON.stringify(key),
              startkey_docid: startKeyDocId,
              full_set: 'true',
            },
          })
        } catch (err) {
          if (!(err instanceof H.lib.ViewNotFoundError)) {
            throw err
          }
        }

        if (!res || res.rows.length !== expectedCount) {
          await H.sleep(100)
          continue
        }

        assert.isArray(res.rows)
        assert.lengthOf(res.rows, expectedCount)
        assert.isObject(res.meta)

        assert.strictEqual(res.rows[0].key, key)
        assert.strictEqual(res.rows[0].id, startKeyDocId)
        break
      }
    }).timeout(20000)

    it('should correctly raise error when using incorrect raw option', async function () {
      /* eslint-disable-next-line no-constant-condition */
      const testUidKeys = [...getTestUidKeys(testUid, 2)]
      const sortedTestUidKeys = [...testUidKeys].sort()
      // get the largest key
      const keyIdx = testUidKeys.indexOf(
        sortedTestUidKeys[sortedTestUidKeys.length - 1]
      )
      const key = testUidKeys[keyIdx]
      const keysAndDocIds = getkeysAndDocIds(testDocs)
      const startKeyDocId = keysAndDocIds[key][keysAndDocIds[key].length - 1]

      await H.throwsHelper(async () => {
        await H.b.viewQuery(ddocKey, 'simple', {
          namespace: DesignDocumentNamespace.Development,
          raw: {
            limit: '2',
            // this key should be a JSON string
            startkey: key,
            startkey_docid: startKeyDocId,
            full_set: 'true',
          },
        })
      }, H.lib.InvalidArgumentError)
    })

    it('should successfully drop an index', async function () {
      await H.b
        .viewIndexes()
        .dropDesignDocument(ddocKey, DesignDocumentNamespace.Development)
      await H.consistencyUtils.waitUntilDesignDocumentDropped(
        H.bucketName,
        `dev_${ddocKey}`
      )
    })
  })
})
