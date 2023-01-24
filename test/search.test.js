'use strict'

const assert = require('chai').assert
const testdata = require('./testdata')
const fs = require('fs')
const path = require('path')

const H = require('./harness')

describe('#search', function () {
  let testUid, idxName
  let testDocs
  let indexParams

  before(async function () {
    H.skipIfMissingFeature(this, H.Features.Search)

    testUid = H.genTestKey()
    idxName = 's_' + H.genTestKey() // prefix with a letter

    testDocs = await testdata.upsertData(H.dco, testUid)
    const indexPath = path.join(
      process.cwd(),
      'test',
      'data',
      'search_index.json'
    )
    const indexData = fs.readFileSync(indexPath)
    indexParams = JSON.parse(indexData)
    // need to swap out the type mapping to match the testUid
    indexParams.mapping.types[`${testUid.substring(0, 8)}`] =
      indexParams.mapping.types['testIndexUUID']
    delete indexParams.mapping.types['testIndexUUID']
  })

  after(async function () {
    await testdata.removeTestData(H.dco, testDocs)
  })

  it('should successfully create an index', async function () {
    await H.c.searchIndexes().upsertIndex({
      name: idxName,
      sourceName: H.b.name,
      sourceType: 'couchbase',
      type: 'fulltext-index',
      params: indexParams,
    })
  })

  it('should successfully get all indexes', async function () {
    const idxs = await H.c.searchIndexes().getAllIndexes()
    assert.isAtLeast(idxs.length, 1)
  })

  it('should successfully get an index', async function () {
    const idx = await H.c.searchIndexes().getIndex(idxName)
    assert.equal(idx.name, idxName)
  })

  it('should see test data correctly', async function () {
    /* eslint-disable-next-line no-constant-condition */
    while (true) {
      var res = null
      try {
        res = await H.c.searchQuery(
          idxName,
          H.lib.SearchQuery.term(testUid).field('testUid'),
          { explain: true, fields: ['name'] }
        )
      } catch (e) {} // eslint-disable-line no-empty

      if (!res || res.rows.length !== testdata.docCount()) {
        await H.sleep(100)
        continue
      }

      assert.isArray(res.rows)
      assert.lengthOf(res.rows, testdata.docCount())
      assert.isObject(res.meta)

      res.rows.forEach((row) => {
        assert.isString(row.index)
        assert.isString(row.id)
        assert.isNumber(row.score)
        if (row.locations) {
          assert.isArray(row.locations)
        }
        if (row.fragments) {
          assert.isObject(row.fragments)
        }
        if (row.fields) {
          assert.isObject(row.fields)
        }
        if (row.explanation) {
          assert.isObject(row.explanation)
        }
      })

      break
    }
  }).timeout(60000)

  it('should successfully drop an index', async function () {
    await H.c.searchIndexes().dropIndex(idxName)
  })

  it('should fail to drop a missing index', async function () {
    await H.throwsHelper(async () => {
      await H.c.searchIndexes().dropIndex(idxName)
    }, H.lib.SearchIndexNotFoundError)
  })
})
