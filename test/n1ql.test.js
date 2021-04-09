'use strict'

const assert = require('chai').assert
const testdata = require('./testdata')

const H = require('./harness')

describe('#query', () => {
  H.requireFeature(H.Features.Query, () => {
    const testUid = H.genTestKey()
    const idxName = H.genTestKey()
    const sidxName = H.genTestKey()

    before(async () => {
      await testdata.upsertData(H.dco, testUid)
    })

    after(async () => {
      await testdata.removeTestData(H.dco, testUid)
    })

    it('should successfully create a primary index', async () => {
      await H.c.queryIndexes().createPrimaryIndex(H.b.name, {
        name: idxName,
      })
    }).timeout(60000)

    it('should fail to create a duplicate primary index', async () => {
      await H.throwsHelper(async () => {
        await H.c.queryIndexes().createPrimaryIndex(H.b.name, {
          name: idxName,
        })
      }, H.lib.IndexExistsError)
    })

    it('should successfully create a secondary index', async () => {
      await H.c.queryIndexes().createIndex(H.b.name, sidxName, ['name'])
    }).timeout(20000)

    it('should fail to create a duplicate secondary index', async () => {
      await H.throwsHelper(async () => {
        await H.c.queryIndexes().createIndex(H.b.name, sidxName, ['name'])
      }, H.lib.IndexExistsError)
    })

    it('should successfully get all indexes', async () => {
      var idxs = await H.c.queryIndexes().getAllIndexes(H.b.name)
      assert.isAtLeast(idxs.length, 1)
    })

    it('should see test data correctly', async () => {
      /* eslint-disable-next-line no-constant-condition */
      while (true) {
        var res = null
        try {
          var qs = `SELECT * FROM ${H.b.name} WHERE testUid='${testUid}'`
          res = await H.c.query(qs)
        } catch (e) {} // eslint-disable-line no-empty

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

    H.requireFeature(H.Features.Collections, () => {
      it('should see test data correctly at scope level', async () => {
        /* eslint-disable-next-line no-constant-condition */
        while (true) {
          var res = null
          try {
            var qs = `SELECT * FROM _default WHERE testUid='${testUid}'`
            res = await H.s.query(qs)
          } catch (e) {} // eslint-disable-line no-empty

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
    })

    it('should work with parameters correctly', async () => {
      /* eslint-disable-next-line no-constant-condition */
      while (true) {
        var res = null
        try {
          var qs = `SELECT * FROM ${H.b.name} WHERE testUid=$1`
          res = await H.c.query(qs, {
            parameters: [testUid],
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

    it('should work with named parameters correctly', async () => {
      /* eslint-disable-next-line no-constant-condition */
      while (true) {
        var res = null
        try {
          var qs = `SELECT * FROM ${H.b.name} WHERE testUid=$tuid`
          res = await H.c.query(qs, {
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

    it('should work with lots of options specified', async () => {
      /* eslint-disable-next-line no-constant-condition */
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
        } catch (e) {} // eslint-disable-line no-empty

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

    it('should wait till all indexes are online', async () => {
      await H.c.queryIndexes().watchIndexes(H.b.name, [idxName, sidxName], 2000)
    }).timeout(3000)

    it('should fail watching when some indexes are missing', async () => {
      await H.throwsHelper(async () => {
        await H.c.queryIndexes().watchIndexes(H.b.name, ['invalid-index'], 2000)
      }, H.lib.CouchbaseError)
    }).timeout(3000)

    it('should successfully drop a secondary index', async () => {
      await H.c.queryIndexes().dropIndex(H.b.name, sidxName)
    })

    it('should fail to drop a missing secondary index', async () => {
      await H.throwsHelper(async () => {
        await H.c.queryIndexes().dropIndex(H.b.name, sidxName)
      }, H.lib.QueryIndexNotFoundError)
    })

    it('should successfully drop a primary index', async () => {
      await H.c.queryIndexes().dropPrimaryIndex(H.b.name, {
        name: idxName,
      })
    })

    it('should fail to drop a missing primary index', async () => {
      await H.throwsHelper(async () => {
        await H.c.queryIndexes().dropPrimaryIndex(H.b.name, {
          name: idxName,
        })
      }, H.lib.QueryIndexNotFoundError)
    })
  })
})
