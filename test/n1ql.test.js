'use strict'

const assert = require('chai').assert
const testdata = require('./testdata')

const H = require('./harness')

describe('N1QL', function () {
  let testUid, idxName, sidxName
  let testDocs

  describe('#query - cluster level', function () {
    before(async function () {
      H.skipIfMissingFeature(this, H.Features.Query)
      this.timeout(60000)

      testUid = H.genTestKey()
      idxName = H.genTestKey()
      sidxName = H.genTestKey()

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
    })

    after(async function () {
      this.timeout(5000)
      try {
        await testdata.removeTestData(H.dco, testDocs)
      } catch (_e) {
        // ignore
      }
    })

    it('should successfully create a primary index', async function () {
      await H.c.queryIndexes().createPrimaryIndex(H.b.name, {
        name: idxName,
      })
    }).timeout(60000)

    it('should fail to create a duplicate primary index', async function () {
      await H.throwsHelper(async () => {
        await H.c.queryIndexes().createPrimaryIndex(H.b.name, {
          name: idxName,
        })
      }, H.lib.IndexExistsError)
    })

    it('should successfully create a secondary index (using a new connection)', async function () {
      var cluster = await H.lib.Cluster.connect(H.connStr, H.connOpts)

      await cluster.queryIndexes().createIndex(H.b.name, sidxName, ['name'])

      await cluster.close()
    }).timeout(20000)

    it('should fail to create a duplicate secondary index', async function () {
      await H.throwsHelper(async () => {
        await H.c.queryIndexes().createIndex(H.b.name, sidxName, ['name'])
      }, H.lib.IndexExistsError)
    })

    it('should successfully get all indexes', async function () {
      var idxs = await H.c.queryIndexes().getAllIndexes(H.b.name)
      assert.isAtLeast(idxs.length, 1)
    })

    it('should see test data correctly', async function () {
      while (true) {
        var res = null
        try {
          var qs = `SELECT * FROM ${H.b.name} WHERE testUid='${testUid}'`
          res = await H.c.query(qs)
        } catch (_e) {} // eslint-disable-line no-empty

        if (!res || res.rows.length !== testdata.docCount()) {
          await H.sleep(100)
          continue
        }

        assert.isArray(res.rows)
        assert.lengthOf(res.rows, testdata.docCount())
        assert.isObject(res.meta)

        break
      }
    }).timeout(10000)

    it('should see test data correctly with a new connection', async function () {
      var cluster = await H.lib.Cluster.connect(H.connStr, H.connOpts)

      const qs = `SELECT * FROM ${H.b.name} WHERE testUid='${testUid}'`
      const res = await cluster.query(qs)

      assert.isArray(res.rows)
      assert.lengthOf(res.rows, testdata.docCount())
      assert.isObject(res.meta)

      await cluster.close()
    }).timeout(10000)

    it('should stream test data correctly', async function () {
      const streamQuery = (qs) => {
        return new Promise((resolve, reject) => {
          let rowsOut = []
          let metaOut = null
          H.c
            .query(qs)
            .on('row', (row) => {
              rowsOut.push(row)
            })
            .on('meta', (meta) => {
              metaOut = meta
            })
            .on('end', () => {
              resolve({
                rows: rowsOut,
                meta: metaOut,
              })
            })
            .on('error', (err) => {
              reject(err)
            })
        })
      }

      while (true) {
        var res = null
        try {
          var qs = `SELECT * FROM ${H.b.name} WHERE testUid='${testUid}'`
          res = await streamQuery(qs)
        } catch (_e) {} // eslint-disable-line no-empty

        if (!res || res.rows.length !== testdata.docCount()) {
          await H.sleep(100)
          continue
        }

        assert.isArray(res.rows)
        assert.lengthOf(res.rows, testdata.docCount())
        assert.isObject(res.meta)

        break
      }
    }).timeout(10000)

    it('should work with parameters correctly', async function () {
      while (true) {
        var res = null
        try {
          var qs = `SELECT * FROM ${H.b.name} WHERE testUid=$2`
          res = await H.c.query(qs, {
            parameters: [undefined, testUid],
          })
        } catch (_e) {} // eslint-disable-line no-empty

        if (!res || res.rows.length !== testdata.docCount()) {
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
      while (true) {
        var res = null
        try {
          var qs = `SELECT * FROM ${H.b.name} WHERE testUid=$tuid`
          res = await H.c.query(qs, {
            parameters: {
              tuid: testUid,
            },
          })
        } catch (_e) {} // eslint-disable-line no-empty

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
      while (true) {
        var res = null
        try {
          var qs = `SELECT * FROM ${H.b.name} WHERE testUid=$tuid`
          res = await H.c.query(qs, {
            parameters: {
              tuid: testUid,
              filterMe: undefined,
            },
          })
        } catch (_e) {} // eslint-disable-line no-empty

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
      while (true) {
        var res = null
        try {
          var qs =
            'SELECT * FROM ' + H.b.name + ' WHERE testUid="' + testUid + '"'
          res = await H.c.query(qs, {
            adhoc: true,
            clientContextId: 'hello-world',
            maxParallelism: 10,
            pipelineBatch: 10,
            pipelineCap: 10,
            scanCap: 10,
            readOnly: true,
            profile: H.lib.QueryProfileMode.Timings,
            metrics: true,
          })
        } catch (_e) {} // eslint-disable-line no-empty

        if (res.rows.length !== testdata.docCount()) {
          await H.sleep(100)
          continue
        }

        assert.isArray(res.rows)
        assert.lengthOf(res.rows, testdata.docCount())
        assert.isObject(res.meta)
        assert.isString(res.meta.requestId)
        assert.equal(res.meta.clientContextId, 'hello-world')
        assert.equal(res.meta.status, H.lib.QueryStatus.Success)
        assert.isObject(res.meta.signature)
        assert.isObject(res.meta.metrics)
        assert.isObject(res.meta.profile)

        break
      }
    }).timeout(10000)

    it('should wait till all indexes are online', async function () {
      await H.c.queryIndexes().watchIndexes(H.b.name, [idxName, sidxName], 2000)
    }).timeout(3000)

    it('should fail watching when some indexes are missing', async function () {
      await H.throwsHelper(async () => {
        await H.c.queryIndexes().watchIndexes(H.b.name, ['invalid-index'], 2000)
      }, H.lib.IndexNotFoundError)
    }).timeout(3000)

    it('should successfully drop a secondary index', async function () {
      await H.c.queryIndexes().dropIndex(H.b.name, sidxName)
    })

    it('should fail to drop a missing secondary index', async function () {
      await H.throwsHelper(async () => {
        await H.c.queryIndexes().dropIndex(H.b.name, sidxName)
      }, H.lib.IndexNotFoundError)
    })

    it('should successfully drop a primary index', async function () {
      await H.c.queryIndexes().dropPrimaryIndex(H.b.name, {
        name: idxName,
      })
    })

    it('should fail to drop a missing primary index', async function () {
      await H.throwsHelper(async () => {
        await H.c.queryIndexes().dropPrimaryIndex(H.b.name, {
          name: idxName,
        })
      }, H.lib.IndexNotFoundError)
    })

    describe('#deferred', function () {
      this.retries(3)

      const numDeferredIndexes = 3
      let deferredIndexes = []
      let filteredIdexes = []

      before(async function () {
        this.timeout(5000)

        for (let i = 0; i < numDeferredIndexes; i++) {
          idxName = H.genTestKey()
          deferredIndexes.push(idxName)
          await H.c.queryIndexes().createIndex(H.b.name, idxName, ['name'], {
            deferred: true,
          })
        }
        var idxs = await H.c.queryIndexes().getAllIndexes(H.b.name)
        filteredIdexes = idxs.filter((idx) => idx.state === 'deferred')
      })

      after(async function () {
        this.timeout(5000)

        for (let i = 0; i < deferredIndexes.length; i++) {
          try {
            await H.c.queryIndexes().dropIndex(H.b.name, deferredIndexes[i])
          } catch (_e) {
            // ignore
          }
        }
      })

      it('should build deferred indexes', async function () {
        const imgr = H.c.queryIndexes()
        await imgr.buildDeferredIndexes(H.b.name)
        await H.tryNTimes(
          5,
          2000,
          imgr.watchIndexes.bind(imgr),
          H.b.name,
          filteredIdexes.map((f) => f.name),
          6000
        )
      }).timeout(60000)
    })
  })

  describe('#query - scope level', function () {
    before(async function () {
      H.skipIfMissingFeature(this, H.Features.Collections)
      H.skipIfMissingFeature(this, H.Features.Query)
      this.timeout(60000)

      testUid = H.genTestKey()
      idxName = H.genTestKey()
      sidxName = H.genTestKey()

      // 40.5s for all retries, excludes time for actual operations (specifically the batched remove)
      await H.tryNTimes(3, 1000, async () => {
        try {
          // w/ 3 retries for each doc (TEST_DOCS.length == 9) w/ 500ms delay, 1.5s * 9 = 22.5s
          const result = await testdata.upsertData(H.co, testUid)
          if (!result.every((r) => r.status === 'fulfilled')) {
            throw new Error('Failed to upsert all test data')
          }
          testDocs = result.map((r) => r.value)
        } catch (err) {
          await testdata.removeTestData(H.co, testDocs)
          throw err
        }
      })
    })

    after(async function () {
      this.timeout(5000)
      try {
        await testdata.removeTestData(H.co, testDocs)
      } catch (_e) {
        // ignore
      }
    })

    it('should successfully create a primary index', async function () {
      await H.c.queryIndexes().createPrimaryIndex(H.b.name, {
        name: idxName,
        collectionName: H.co.name,
        scopeName: H.s.name,
      })
    }).timeout(60000)

    it('should fail to create a duplicate primary index', async function () {
      await H.throwsHelper(async () => {
        await H.c.queryIndexes().createPrimaryIndex(H.b.name, {
          name: idxName,
          collectionName: H.co.name,
          scopeName: H.s.name,
        })
      }, H.lib.IndexExistsError)
    })

    it('should successfully create a secondary index (using a new connection)', async function () {
      var cluster = await H.lib.Cluster.connect(H.connStr, H.connOpts)

      await cluster.queryIndexes().createIndex(H.b.name, sidxName, ['name'], {
        collectionName: H.co.name,
        scopeName: H.s.name,
      })

      await cluster.close()
    }).timeout(20000)

    it('should fail to create a duplicate secondary index', async function () {
      await H.throwsHelper(async () => {
        await H.c.queryIndexes().createIndex(H.b.name, sidxName, ['name'], {
          collectionName: H.co.name,
          scopeName: H.s.name,
        })
      }, H.lib.IndexExistsError)
    })

    it('should successfully get all indexes', async function () {
      var idxs = await H.c.queryIndexes().getAllIndexes(H.b.name, {
        collectionName: H.co.name,
        scopeName: H.s.name,
      })
      assert.isAtLeast(idxs.length, 1)
    })

    it('should see test data correctly', async function () {
      while (true) {
        var res = null
        try {
          var qs = `SELECT * FROM ${H.co.name} WHERE testUid='${testUid}'`
          res = await H.s.query(qs)
        } catch (_e) {} // eslint-disable-line no-empty

        if (!res || res.rows.length !== testdata.docCount()) {
          await H.sleep(100)
          continue
        }

        assert.isArray(res.rows)
        assert.lengthOf(res.rows, testdata.docCount())
        assert.isObject(res.meta)

        break
      }
    }).timeout(10000)

    it('should see test data correctly with a new connection', async function () {
      const cluster = await H.lib.Cluster.connect(H.connStr, H.connOpts)
      const bucket = cluster.bucket(H.b.name)
      const scope = bucket.scope(H.s.name)

      const qs = `SELECT * FROM ${H.co.name} WHERE testUid='${testUid}'`
      const res = await scope.query(qs)

      assert.isArray(res.rows)
      assert.lengthOf(res.rows, testdata.docCount())
      assert.isObject(res.meta)

      await cluster.close()
    }).timeout(10000)

    it('should stream test data correctly', async function () {
      const streamQuery = (qs) => {
        return new Promise((resolve, reject) => {
          let rowsOut = []
          let metaOut = null
          H.s
            .query(qs)
            .on('row', (row) => {
              rowsOut.push(row)
            })
            .on('meta', (meta) => {
              metaOut = meta
            })
            .on('end', () => {
              resolve({
                rows: rowsOut,
                meta: metaOut,
              })
            })
            .on('error', (err) => {
              reject(err)
            })
        })
      }

      while (true) {
        var res = null
        try {
          var qs = `SELECT * FROM ${H.co.name} WHERE testUid='${testUid}'`
          res = await streamQuery(qs)
        } catch (_e) {} // eslint-disable-line no-empty

        if (!res || res.rows.length !== testdata.docCount()) {
          await H.sleep(100)
          continue
        }

        assert.isArray(res.rows)
        assert.lengthOf(res.rows, testdata.docCount())
        assert.isObject(res.meta)

        break
      }
    }).timeout(10000)

    it('should work with parameters correctly', async function () {
      while (true) {
        var res = null
        try {
          var qs = `SELECT * FROM ${H.co.name} WHERE testUid=$2`
          res = await H.s.query(qs, {
            parameters: [undefined, testUid],
          })
        } catch (_e) {} // eslint-disable-line no-empty

        if (!res || res.rows.length !== testdata.docCount()) {
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
      while (true) {
        var res = null
        try {
          var qs = `SELECT * FROM ${H.co.name} WHERE testUid=$tuid`
          res = await H.s.query(qs, {
            parameters: {
              tuid: testUid,
            },
          })
        } catch (_e) {} // eslint-disable-line no-empty

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
      while (true) {
        var res = null
        try {
          var qs = `SELECT * FROM ${H.co.name} WHERE testUid=$tuid`
          res = await H.s.query(qs, {
            parameters: {
              tuid: testUid,
              filterMe: undefined,
            },
          })
        } catch (_e) {} // eslint-disable-line no-empty

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
      while (true) {
        var res = null
        try {
          var qs =
            'SELECT * FROM ' + H.co.name + ' WHERE testUid="' + testUid + '"'
          res = await H.s.query(qs, {
            adhoc: true,
            clientContextId: 'hello-world',
            maxParallelism: 10,
            pipelineBatch: 10,
            pipelineCap: 10,
            scanCap: 10,
            readOnly: true,
            profile: H.lib.QueryProfileMode.Timings,
            metrics: true,
          })
        } catch (_e) {} // eslint-disable-line no-empty

        if (res.rows.length !== testdata.docCount()) {
          await H.sleep(100)
          continue
        }

        assert.isArray(res.rows)
        assert.lengthOf(res.rows, testdata.docCount())
        assert.isObject(res.meta)
        assert.isString(res.meta.requestId)
        assert.equal(res.meta.clientContextId, 'hello-world')
        assert.equal(res.meta.status, H.lib.QueryStatus.Success)
        assert.isObject(res.meta.signature)
        assert.isObject(res.meta.metrics)
        assert.isObject(res.meta.profile)

        break
      }
    }).timeout(10000)

    it('should wait till all indexes are online', async function () {
      await H.c
        .queryIndexes()
        .watchIndexes(H.b.name, [idxName, sidxName], 2000, {
          collectionName: H.co.name,
          scopeName: H.s.name,
        })
    }).timeout(3000)

    it('should fail watching when some indexes are missing', async function () {
      await H.throwsHelper(async () => {
        await H.c
          .queryIndexes()
          .watchIndexes(H.b.name, ['invalid-index'], 2000, {
            collectionName: H.co.name,
            scopeName: H.s.name,
          })
      }, H.lib.IndexNotFoundError)
    }).timeout(3000)

    it('should successfully drop a secondary index', async function () {
      await H.c.queryIndexes().dropIndex(H.b.name, sidxName, {
        collectionName: H.co.name,
        scopeName: H.s.name,
      })
    })

    it('should fail to drop a missing secondary index', async function () {
      await H.throwsHelper(async () => {
        await H.c.queryIndexes().dropIndex(H.b.name, sidxName, {
          collectionName: H.co.name,
          scopeName: H.s.name,
        })
      }, H.lib.IndexNotFoundError)
    })

    it('should successfully drop a primary index', async function () {
      await H.c.queryIndexes().dropPrimaryIndex(H.b.name, {
        name: idxName,
        collectionName: H.co.name,
        scopeName: H.s.name,
      })
    })

    it('should fail to drop a missing primary index', async function () {
      await H.throwsHelper(async () => {
        await H.c.queryIndexes().dropPrimaryIndex(H.b.name, {
          name: idxName,
          collectionName: H.co.name,
          scopeName: H.s.name,
        })
      }, H.lib.IndexNotFoundError)
    })

    describe('#deferred', function () {
      this.retries(3)

      const numDeferredIndexes = 3
      let deferredIndexes = []
      let filteredIdexes = []

      before(async function () {
        this.timeout(5000)

        for (let i = 0; i < numDeferredIndexes; i++) {
          idxName = H.genTestKey()
          deferredIndexes.push(idxName)
          await H.c.queryIndexes().createIndex(H.b.name, idxName, ['name'], {
            collectionName: H.co.name,
            scopeName: H.s.name,
            deferred: true,
          })
        }
        var idxs = await H.c.queryIndexes().getAllIndexes(H.b.name, {
          collectionName: H.co.name,
          scopeName: H.s.name,
        })
        filteredIdexes = idxs.filter((idx) => idx.state === 'deferred')
      })

      after(async function () {
        this.timeout(5000)

        for (let i = 0; i < deferredIndexes.length; i++) {
          try {
            await H.c.queryIndexes().dropIndex(H.b.name, deferredIndexes[i], {
              collectionName: H.co.name,
              scopeName: H.s.name,
            })
          } catch (_e) {
            // ignore
          }
        }
      })

      it('should build deferred indexes', async function () {
        const imgr = H.c.queryIndexes()
        await imgr.buildDeferredIndexes(H.b.name, {
          collectionName: H.co.name,
          scopeName: H.s.name,
        })
        const opts = {
          collectionName: H.co.name,
          scopeName: H.s.name,
        }
        await H.tryNTimes(
          5,
          2000,
          imgr.watchIndexes.bind(imgr),
          H.b.name,
          filteredIdexes.map((f) => f.name),
          6000,
          opts
        )
      }).timeout(60000)
    })
  })
})

function genericTests(collFn) {
  let testUid, idxName, sidxName
  let testDocs

  describe('#CollectionQueryIndexManagement', function () {
    before(async function () {
      H.skipIfMissingFeature(this, H.Features.Query)
      H.skipIfMissingFeature(this, H.Features.Collections)
      this.timeout(60000)

      testUid = H.genTestKey()
      idxName = H.genTestKey()
      sidxName = H.genTestKey()

      // 40.5s for all retries, excludes time for actual operations (specifically the batched remove)
      await H.tryNTimes(3, 1000, async () => {
        try {
          // w/ 3 retries for each doc (TEST_DOCS.length == 9) w/ 500ms delay, 1.5s * 9 = 22.5s
          const result = await testdata.upsertData(collFn(), testUid)
          if (!result.every((r) => r.status === 'fulfilled')) {
            throw new Error('Failed to upsert all test data')
          }
          testDocs = result.map((r) => r.value)
        } catch (err) {
          await testdata.removeTestData(collFn(), testDocs)
          throw err
        }
      })
    })

    after(async function () {
      this.timeout(5000)
      try {
        await testdata.removeTestData(collFn(), testDocs)
      } catch (_e) {
        // ignore
      }
    })

    it('should successfully create a primary index', async function () {
      await collFn().queryIndexes().createPrimaryIndex({
        name: idxName,
      })
    }).timeout(60000)

    it('should successfully create a secondary index', async function () {
      await collFn().queryIndexes().createIndex(sidxName, ['name'])
    }).timeout(20000)

    it('should fail to create a duplicate secondary index', async function () {
      await H.throwsHelper(async () => {
        await collFn().queryIndexes().createIndex(sidxName, ['name'])
      }, H.lib.IndexExistsError)
    })

    it('should successfully get all indexes', async function () {
      var idxs = await collFn().queryIndexes().getAllIndexes()
      assert.isAtLeast(idxs.length, 1)
    })

    it('should wait till all indexes are online', async function () {
      await collFn().queryIndexes().watchIndexes([idxName, sidxName], 2000)
    }).timeout(3000)

    it('should fail watching when some indexes are missing', async function () {
      await H.throwsHelper(async () => {
        await collFn().queryIndexes().watchIndexes(['invalid-index'], 2000)
      }, H.lib.IndexNotFoundError)
    }).timeout(3000)

    it('should successfully drop a secondary index', async function () {
      await collFn().queryIndexes().dropIndex(sidxName)
    })

    it('should fail to drop a missing secondary index', async function () {
      await H.throwsHelper(async () => {
        await collFn().queryIndexes().dropIndex(sidxName)
      }, H.lib.IndexNotFoundError)
    })

    it('should successfully drop a primary index', async function () {
      await collFn().queryIndexes().dropPrimaryIndex({
        name: idxName,
      })
    })

    it('should fail to drop a missing primary index', async function () {
      await H.throwsHelper(async () => {
        await collFn().queryIndexes().dropPrimaryIndex({
          name: idxName,
        })
      }, H.lib.IndexNotFoundError)
    })

    describe('#deferred', function () {
      this.retries(3)

      const numDeferredIndexes = 3
      let deferredIndexes = []
      let filteredIdexes = []

      before(async function () {
        this.timeout(5000)

        for (let i = 0; i < numDeferredIndexes; i++) {
          idxName = H.genTestKey()
          deferredIndexes.push(idxName)
          await collFn()
            .queryIndexes()
            .createIndex(idxName, ['name'], { deferred: true })
        }
        var idxs = await collFn().queryIndexes().getAllIndexes()
        filteredIdexes = idxs.filter((idx) => idx.state === 'deferred')
      })

      after(async function () {
        this.timeout(5000)

        for (let i = 0; i < deferredIndexes.length; i++) {
          try {
            await collFn().queryIndexes().dropIndex(deferredIndexes[i])
          } catch (_e) {
            // ignore
          }
        }
      })

      it('should build deferred indexes', async function () {
        const imgr = collFn().queryIndexes()
        await imgr.buildDeferredIndexes()
        await H.tryNTimes(
          5,
          2000,
          imgr.watchIndexes.bind(imgr),
          filteredIdexes.map((f) => f.name),
          6000
        )
      }).timeout(60000)
    })
  })
}

describe('#CollectionQueryIndexManager - default', function () {
  genericTests(() => H.dco)
})

describe('#CollectionQueryIndexManager - named', function () {
  genericTests(() => H.co)
})
