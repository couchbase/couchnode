'use strict'

const assert = require('chai').assert
const testdata = require('./testdata')
const fs = require('fs')
const path = require('path')

const {
  HighlightStyle,
  SearchRequest,
  SearchScoring,
  SearchScoringNone,
  SearchScoringReciprocalRankFusion,
  SearchScoringRelativeScoreFusion,
} = require('../lib/searchtypes')
const { searchScoringToCpp } = require('../lib/bindingutilities')
const { VectorQuery, VectorSearch } = require('../lib/vectorsearch')

const H = require('./harness')

function genericTests(connFn, collFn) {
  let testUid, idxName
  let testDocs
  let indexParams

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

  after(async function () {
    try {
      await testdata.removeTestData(collFn(), testDocs)
    } catch (_e) {
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
      } catch (_e) {} // eslint-disable-line no-empty

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
      } catch (_e) {} // eslint-disable-line no-empty

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
  genericTests(
    () => H.c,
    () => H.dco
  )
})

describe('#scopesearch', function () {
  before(function () {
    H.skipIfMissingFeature(this, H.Features.Collections)
    H.skipIfMissingFeature(this, H.Features.ScopeSearch)
    H.skipIfMissingFeature(this, H.Features.ScopeSearchIndexManagement)
  })

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
    } catch (_e) {
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
      } catch (_e) {} // eslint-disable-line no-empty

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

describe('#searchscoring', function () {
  it('should construct SearchScoringNone', function () {
    const scoring = new SearchScoringNone()
    assert.instanceOf(scoring, SearchScoring)
    assert.equal(SearchScoring.modeOf(scoring), 'none')
  })

  it('should construct SearchScoringNone via the static factory', function () {
    const scoring = SearchScoring.none()
    assert.instanceOf(scoring, SearchScoringNone)
    assert.equal(SearchScoring.modeOf(scoring), 'none')
  })

  it('should construct SearchScoringReciprocalRankFusion with defaults', function () {
    const scoring = new SearchScoringReciprocalRankFusion()
    assert.equal(SearchScoring.modeOf(scoring), 'rrf')
    assert.isUndefined(scoring.rankConstant)
    assert.isUndefined(scoring.windowSize)
  })

  it('should construct SearchScoringReciprocalRankFusion with options', function () {
    const scoring = new SearchScoringReciprocalRankFusion({
      rankConstant: 60,
      windowSize: 100,
    })
    assert.equal(SearchScoring.modeOf(scoring), 'rrf')
    assert.equal(scoring.rankConstant, 60)
    assert.equal(scoring.windowSize, 100)
  })

  it('should construct SearchScoringReciprocalRankFusion via the static factory', function () {
    const scoring = SearchScoring.reciprocalRankFusion({
      rankConstant: 60,
      windowSize: 100,
    })
    assert.instanceOf(scoring, SearchScoringReciprocalRankFusion)
    assert.equal(SearchScoring.modeOf(scoring), 'rrf')
    assert.equal(scoring.rankConstant, 60)
    assert.equal(scoring.windowSize, 100)
  })

  it('should construct SearchScoringRelativeScoreFusion with defaults', function () {
    const scoring = new SearchScoringRelativeScoreFusion()
    assert.equal(SearchScoring.modeOf(scoring), 'rsf')
    assert.isUndefined(scoring.windowSize)
  })

  it('should construct SearchScoringRelativeScoreFusion with options', function () {
    const scoring = new SearchScoringRelativeScoreFusion({ windowSize: 100 })
    assert.equal(SearchScoring.modeOf(scoring), 'rsf')
    assert.equal(scoring.windowSize, 100)
  })

  it('should construct SearchScoringRelativeScoreFusion via the static factory', function () {
    const scoring = SearchScoring.relativeScoreFusion({ windowSize: 100 })
    assert.instanceOf(scoring, SearchScoringRelativeScoreFusion)
    assert.equal(SearchScoring.modeOf(scoring), 'rsf')
    assert.equal(scoring.windowSize, 100)
  })

  it('should pass valid uint32 rankConstant/windowSize through to the cpp request', function () {
    const { scoring_value: scoringValue } = searchScoringToCpp(
      new SearchScoringReciprocalRankFusion({
        rankConstant: 60,
        windowSize: 4294967295,
      })
    )
    assert.equal(scoringValue.rank_constant, 60)
    assert.equal(scoringValue.window_size, 4294967295)
  })

  it('should leave undefined rankConstant/windowSize as undefined', function () {
    const { scoring_value: scoringValue } = searchScoringToCpp(
      new SearchScoringReciprocalRankFusion()
    )
    assert.isUndefined(scoringValue.rank_constant)
    assert.isUndefined(scoringValue.window_size)
  })

  it('should reject a negative rankConstant', function () {
    assert.throws(() => {
      searchScoringToCpp(
        new SearchScoringReciprocalRankFusion({ rankConstant: -1 })
      )
    }, H.lib.InvalidArgumentError)
  })

  it('should reject a non-integer windowSize', function () {
    assert.throws(() => {
      searchScoringToCpp(
        new SearchScoringRelativeScoreFusion({ windowSize: 1.5 })
      )
    }, H.lib.InvalidArgumentError)
  })

  it('should reject a windowSize larger than uint32 max', function () {
    assert.throws(() => {
      searchScoringToCpp(
        new SearchScoringRelativeScoreFusion({ windowSize: 4294967296 })
      )
    }, H.lib.InvalidArgumentError)
  })
})
