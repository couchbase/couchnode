'use strict'

const assert = require('chai').assert
const testdata = require('./testdata')
const fs = require('fs')
const path = require('path')

const { HighlightStyle, SearchRequest } = require('../lib/searchtypes')
const { VectorQuery, VectorSearch } = require('../lib/vectorsearch')

const H = require('./harness')

function genericTests(connFn, collFn) {
  let testUid, idxName
  let testDocs
  let indexParams

  /* eslint-disable-next-line mocha/no-top-level-hooks */
  before(async function () {
    H.skipIfMissingFeature(this, H.Features.Search)
    this.timeout(60000)

    testUid = H.genTestKey()
    idxName = 's_' + H.genTestKey() // prefix with a letter

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
        await testdata.removeTestData(H.dco, testDocs)
        throw err
      }
    })
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

  /* eslint-disable-next-line mocha/no-top-level-hooks */
  after(async function () {
    try {
      await testdata.removeTestData(collFn(), testDocs)
    } catch (e) {
      // ignore
    }
  })

  it('should successfully create an index', async function () {
    await connFn().searchIndexes().upsertIndex({
      name: idxName,
      sourceName: H.b.name,
      sourceType: 'couchbase',
      type: 'fulltext-index',
      params: indexParams,
    })
  })

  it('should successfully get all indexes', async function () {
    const idxs = await connFn().searchIndexes().getAllIndexes()
    assert.isAtLeast(idxs.length, 1)
  })

  it('should successfully get an index', async function () {
    const idx = await connFn().searchIndexes().getIndex(idxName)
    assert.equal(idx.name, idxName)
  })

  it('should see test data correctly', async function () {
    /* eslint-disable-next-line no-constant-condition */
    while (true) {
      var res = null
      try {
        res =
          connFn() instanceof H.lib.Scope
            ? await connFn().search(
                idxName,
                SearchRequest.create(
                  H.lib.SearchQuery.term(testUid).field('testUid')
                ),
                {
                  explain: true,
                  fields: ['name'],
                  includeLocations: true,
                  highlight: { style: HighlightStyle.HTML },
                }
              )
            : await connFn().searchQuery(
                idxName,
                H.lib.SearchQuery.term(testUid).field('testUid'),
                {
                  explain: true,
                  fields: ['name'],
                  includeLocations: true,
                  highlight: { style: HighlightStyle.HTML },
                }
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
          for (const loc of row.locations) {
            assert.isObject(loc)
          }
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

  it('should disable scoring', async function () {
    /* eslint-disable-next-line no-constant-condition */
    while (true) {
      var res = null
      try {
        res =
          connFn() instanceof H.lib.Scope
            ? await connFn().search(
                idxName,
                SearchRequest.create(
                  H.lib.SearchQuery.term(testUid).field('testUid')
                ),
                {
                  disableScoring: true,
                }
              )
            : await connFn().searchQuery(
                idxName,
                H.lib.SearchQuery.term(testUid).field('testUid'),
                {
                  disableScoring: true,
                }
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
        assert.isTrue(row.score == 0)
        if (row.locations) {
          for (const loc of row.locations) {
            assert.isObject(loc)
          }
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
  }).timeout(10000)

  it('should successfully drop an index', async function () {
    await connFn().searchIndexes().dropIndex(idxName)
  })

  it('should fail to drop a missing index', async function () {
    await H.throwsHelper(async () => {
      await connFn().searchIndexes().dropIndex(idxName)
    }, H.lib.SearchIndexNotFoundError)
  })
}

describe('#search', function () {
  /* eslint-disable-next-line mocha/no-setup-in-describe */
  genericTests(
    () => H.c,
    () => H.dco
  )
})

describe('#scopesearch', function () {
  /* eslint-disable-next-line mocha/no-hooks-for-single-case */
  before(function () {
    H.skipIfMissingFeature(this, H.Features.Collections)
    H.skipIfMissingFeature(this, H.Features.ScopeSearch)
    H.skipIfMissingFeature(this, H.Features.ScopeSearchIndexManagement)
  })
  /* eslint-disable-next-line mocha/no-setup-in-describe */
  genericTests(
    () => H.s,
    () => H.dco
  )
})

describe('#vectorsearch', function () {
  let testUid, idxName
  let testDocs
  let testVector
  let indexParams

  before(async function () {
    H.skipIfMissingFeature(this, H.Features.VectorSearch)
    this.timeout(7500)

    testUid = H.genTestKey()
    idxName = 'vs_' + H.genTestKey() // prefix with a letter

    const testVectorSearchDocsPath = path.join(
      process.cwd(),
      'test',
      'data',
      'test_vector_search_docs.json'
    )
    const testVectorDocs = fs
      .readFileSync(testVectorSearchDocsPath, 'utf8')
      .split('\n')
      .map((l) => JSON.parse(l))

    await H.tryNTimes(3, 1000, async () => {
      try {
        const result = await testdata.upserDataFromList(
          H.dco,
          testUid,
          testVectorDocs
        )
        if (!result.every((r) => r.status === 'fulfilled')) {
          throw new Error('Failed to upsert all test data')
        }
        testDocs = result.map((r) => r.value)
      } catch (err) {
        await testdata.removeTestData(H.dco, testDocs)
        throw err
      }
    })

    const testVectorPath = path.join(
      process.cwd(),
      'test',
      'data',
      'test_vector.json'
    )
    testVector = JSON.parse(fs.readFileSync(testVectorPath, 'utf8'))

    const indexPath = path.join(
      process.cwd(),
      'test',
      'data',
      'vector_search_index.json'
    )

    indexParams = JSON.parse(fs.readFileSync(indexPath))
    // need to swap out the type mapping to match the testUid
    indexParams.mapping.types[`${testUid.substring(0, 8)}`] =
      indexParams.mapping.types['testIndexUUID']
    delete indexParams.mapping.types['testIndexUUID']
  })

  after(async function () {
    try {
      await testdata.removeTestData(H.dco, testDocs)
    } catch (e) {
      // ignore
    }
  })

  it('should handle invalid SearchRequest', function () {
    assert.throws(() => {
      new SearchRequest(null)
    }, H.lib.InvalidArgumentError)
    assert.throws(() => {
      new SearchRequest(undefined)
    }, H.lib.InvalidArgumentError)
    assert.throws(() => {
      new SearchRequest({})
    }, H.lib.InvalidArgumentError)
    assert.throws(() => {
      SearchRequest.create(null)
    }, H.lib.InvalidArgumentError)
    assert.throws(() => {
      SearchRequest.create(undefined)
    }, H.lib.InvalidArgumentError)
    assert.throws(() => {
      SearchRequest.create({})
    }, H.lib.InvalidArgumentError)

    const vectorSearch = VectorSearch.fromVectorQuery(
      new VectorQuery('vector_field', testVector)
    )
    const searchQuery = new H.lib.MatchAllSearchQuery()

    assert.throws(() => {
      const req = SearchRequest.create(vectorSearch)
      req.withSearchQuery(vectorSearch)
    }, H.lib.InvalidArgumentError)
    assert.throws(() => {
      const req = SearchRequest.create(vectorSearch)
      req.withVectorSearch(searchQuery)
    }, H.lib.InvalidArgumentError)
    assert.throws(() => {
      const req = SearchRequest.create(vectorSearch)
      req.withVectorSearch(vectorSearch)
    }, H.lib.InvalidArgumentError)

    assert.throws(() => {
      const req = SearchRequest.create(searchQuery)
      req.withVectorSearch(searchQuery)
    }, H.lib.InvalidArgumentError)
    assert.throws(() => {
      const req = SearchRequest.create(searchQuery)
      req.withSearchQuery(vectorSearch)
    }, H.lib.InvalidArgumentError)
    assert.throws(() => {
      const req = SearchRequest.create(searchQuery)
      req.withSearchQuery(searchQuery)
    }, H.lib.InvalidArgumentError)
  })

  it('should handle invalid VectorQuery', function () {
    assert.throws(() => {
      new VectorQuery('vector_field', null)
    }, H.lib.InvalidArgumentError)
    assert.throws(() => {
      new VectorQuery('vector_field', undefined)
    }, H.lib.InvalidArgumentError)
    assert.throws(() => {
      new VectorQuery('vector_field', {})
    }, H.lib.InvalidArgumentError)
    assert.throws(() => {
      new VectorQuery('vector_field', [])
    }, H.lib.InvalidArgumentError)
    assert.throws(() => {
      const vQuery = new VectorQuery('vector_field', testVector)
      vQuery.numCandidates(0)
    }, H.lib.InvalidArgumentError)
    assert.throws(() => {
      const vQuery = new VectorQuery('vector_field', testVector)
      vQuery.numCandidates(-1)
    }, H.lib.InvalidArgumentError)
    assert.throws(() => {
      const vQuery = new VectorQuery('vector_field', testVector)
      vQuery.prefilter(new VectorQuery('vector_field1', testVector))
    }, H.lib.InvalidArgumentError)
    assert.throws(() => {
      new VectorQuery('', testVector)
    }, H.lib.InvalidArgumentError)
    assert.throws(() => {
      new VectorQuery(null, testVector)
    }, H.lib.InvalidArgumentError)
    assert.throws(() => {
      new VectorQuery(undefined, testVector)
    }, H.lib.InvalidArgumentError)
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

  it('should see test data correctly', async function () {
    const vectorSearch = VectorSearch.fromVectorQuery(
      new VectorQuery('vector_field', testVector)
    )
    const request = SearchRequest.create(vectorSearch)
    request.withSearchQuery(H.lib.SearchQuery.term(testUid).field('testUid'))
    const limit = 2
    /* eslint-disable-next-line no-constant-condition */
    while (true) {
      var res = null
      try {
        res = await H.c.search(idxName, request, {
          limit: limit,
          explain: true,
          fields: ['text'],
          includeLocations: true,
          highlight: { style: HighlightStyle.HTML },
        })
      } catch (e) {} // eslint-disable-line no-empty

      if (!res || res.rows.length < limit) {
        await H.sleep(100)
        continue
      }

      assert.isArray(res.rows)
      assert.isAtLeast(res.rows.length, limit)
      assert.isObject(res.meta)

      res.rows.forEach((row) => {
        assert.isString(row.index)
        assert.isString(row.id)
        assert.isNumber(row.score)
        if (row.locations) {
          for (const loc of row.locations) {
            assert.isObject(loc)
          }
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
})
