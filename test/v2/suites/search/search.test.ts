import { readFileSync } from 'fs'
import { join } from 'path'

import { expect } from 'vitest'

import type {
  Cluster,
  Collection,
  ISearchIndex,
  Scope,
} from '../../../../lib/couchbase'
import {
  IndexNotFoundError,
  InvalidArgumentError,
} from '../../../../lib/errors'
import { MatchAllSearchQuery, SearchQuery } from '../../../../lib/searchquery'
import { HighlightStyle, SearchRequest } from '../../../../lib/searchtypes'
import type {
  SearchQueryOptions,
  SearchResult,
} from '../../../../lib/searchtypes'
import { VectorQuery, VectorSearch } from '../../../../lib/vectorsearch'
import { AssertCtx, withCtx } from '../../asserts/ctx'
import { expectThrows } from '../../asserts/errors'
import { assertRowCount, assertRowsAtLeast } from '../../asserts/rows'
import { ServerFeature } from '../../infra/capabilities'
import { DocBatch } from '../../infra/data/loader'
import { TestEnv } from '../../infra/env'
import { CollectionLease } from '../../infra/leases/collection-lease'
import { SearchIndexLease } from '../../infra/leases/index-lease'
import type { SearchIndexManagerLike } from '../../infra/leases/index-lease'
import {
  CollectionStrategy,
  ResolvedRequirements,
} from '../../infra/requirements'
import { pollUntil } from '../../infra/retry'
import { defineSuite } from '../../infra/suite'

// `#search` and `#scopesearch` run the same tests against the cluster
// (`searchQuery` takes a `SearchQuery`) and a scope (`search` takes a
// `SearchRequest` wrapping one), via a `SearchTarget`.
//
// The create test acquires a `SearchIndexLease`, which registers the drop with
// the env, so a failure before the drop test cannot leave a stale index for
// the next run. The lease's release is idempotent.

const SEARCH_DEADLINE_MS = 60_000
/** The second query, over an index that has already ingested. */
const DISABLE_SCORING_DEADLINE_MS = 10_000
/**
 * Above the poll deadline so the poll fires first: its message says what it
 * last saw, the runner's only that time ran out.
 */
const SEE_TEST_DATA_TIMEOUT_MS = SEARCH_DEADLINE_MS + 10_000

/** Relative to this file rather than the invoking cwd. */
const DATA_DIR = join(import.meta.dirname, '..', '..', '..', 'data')

/** Only the type mapping is rewritten; the rest passes through unmodeled. */
interface SearchIndexParams {
  readonly mapping: { readonly types: Record<string, unknown> }
  readonly [key: string]: unknown
}

/**
 * Both files ship a placeholder type mapping, `testIndexUUID`. The index takes
 * a document's type from its id before the first `_` (`docid_prefix`), so the
 * mapping is renamed to this batch's prefix or it matches nothing.
 */
function searchIndexParams(file: string, uid: string): SearchIndexParams {
  const params = JSON.parse(
    readFileSync(join(DATA_DIR, file), 'utf8')
  ) as SearchIndexParams
  const types = params.mapping.types
  types[uid.substring(0, 8)] = types.testIndexUUID
  delete types.testIndexUUID
  return params
}

function indexDefinition(
  name: string,
  sourceName: string,
  params: SearchIndexParams
): ISearchIndex {
  return {
    name,
    sourceName,
    sourceType: 'couchbase',
    type: 'fulltext-index',
    params,
  }
}

// Per-suite names, created on first use and memoized for the file.

const indexNames = new Map<string, string>()

/** Prefixed with a letter because the service requires one. */
function indexNameFor(env: TestEnv, suite: string, prefix: string): string {
  const existing = indexNames.get(suite)
  if (existing) {
    return existing
  }
  const created = `${prefix}${env.key()}`
  indexNames.set(suite, created)
  return created
}

interface SearchRowShape {
  readonly index: unknown
  readonly id: unknown
  readonly score: number
  readonly locations?: unknown[]
  readonly fragments?: unknown
  readonly fields?: unknown
  readonly explanation?: unknown
}

function rowsOf(res: SearchResult): SearchRowShape[] {
  return res.rows as SearchRowShape[]
}

/**
 * `explain`, `fields`, `includeLocations` and `highlight` are checked only
 * when present, because only some queries request them.
 */
function assertSearchRow(row: SearchRowShape, c: AssertCtx): void {
  expect(row.index, withCtx('row.index', c)).toBeTypeOf('string')
  expect(row.id, withCtx('row.id', c)).toBeTypeOf('string')
  expect(row.score, withCtx('row.score', c)).toBeTypeOf('number')
  if (row.locations) {
    for (const loc of row.locations) {
      expect(loc, withCtx('row.locations[]', c)).toBeTypeOf('object')
    }
    expect(Array.isArray(row.locations), withCtx('row.locations', c)).toBe(true)
  }
  if (row.fragments) {
    expect(row.fragments, withCtx('row.fragments', c)).toBeTypeOf('object')
  }
  if (row.fields) {
    expect(row.fields, withCtx('row.fields', c)).toBeTypeOf('object')
  }
  if (row.explanation) {
    expect(row.explanation, withCtx('row.explanation', c)).toBeTypeOf('object')
  }
}

function assertSearchResult(
  res: SearchResult,
  expected: number,
  c: AssertCtx
): void {
  expect(
    Array.isArray(res.rows),
    withCtx('search did not return an array of rows', c)
  ).toBe(true)
  assertRowCount(res.rows, expected, c)
  expect(res.meta, withCtx('search returned no metadata', c)).toBeTypeOf(
    'object'
  )
  for (const row of rowsOf(res)) {
    assertSearchRow(row, c)
  }
}

function assertScoringDisabled(
  res: SearchResult,
  expected: number,
  c: AssertCtx
): void {
  assertSearchResult(res, expected, c)
  for (const row of rowsOf(res)) {
    expect(row.score, withCtx('scoring is disabled, so row.score', c)).toBe(0)
  }
}

function assertVectorSearchResult(
  res: SearchResult,
  minimum: number,
  c: AssertCtx
): void {
  expect(
    Array.isArray(res.rows),
    withCtx('search did not return an array of rows', c)
  ).toBe(true)
  assertRowsAtLeast(res.rows, minimum, c)
  expect(res.meta, withCtx('search returned no metadata', c)).toBeTypeOf(
    'object'
  )
  for (const row of rowsOf(res)) {
    assertSearchRow(row, c)
  }
}

/**
 * Runs a search until it returns enough rows, or the deadline passes. An index
 * answers queries before it has indexed anything, hence the retry.
 *
 * Term queries wait for exactly the batch size, so a partial ingest keeps
 * polling; the vector query waits for at least its limit, since a
 * nearest-neighbor search returns no fixed number.
 */
function searchUntilRows(
  what: string,
  run: () => Promise<SearchResult>,
  enough: (rows: number) => boolean,
  deadlineMs: number,
  signal: AbortSignal
): Promise<SearchResult> {
  return pollUntil<SearchResult>(
    what,
    async (ctx) => {
      let res: SearchResult
      try {
        res = await run()
      } catch (err) {
        ctx.note(err instanceof Error ? err.message : String(err))
        return undefined
      }
      if (!enough(res.rows.length)) {
        ctx.note(`${res.rows.length} row(s)`)
        return undefined
      }
      return res
    },
    { deadlineMs, intervalMs: 100, signal }
  )
}

function searchCtx(
  lease: CollectionLease,
  op: string,
  extra?: string
): AssertCtx {
  return {
    op,
    bucket: lease.bucketName,
    collection: lease.collectionName,
    ...(extra === undefined ? {} : { extra }),
  }
}

interface SearchTarget {
  readonly manager: SearchIndexManagerLike
  query(
    indexName: string,
    query: SearchQuery,
    options: SearchQueryOptions
  ): Promise<SearchResult>
}

function clusterTarget(cluster: Cluster): SearchTarget {
  return {
    manager: cluster.searchIndexes(),
    query: (indexName, query, options) =>
      cluster.searchQuery(indexName, query, options),
  }
}

function scopeTarget(scope: Scope): SearchTarget {
  return {
    manager: scope.searchIndexes(),
    query: (indexName, query, options) =>
      scope.search(indexName, SearchRequest.create(query), options),
  }
}

async function runCreateIndex(
  env: TestEnv,
  target: SearchTarget,
  lease: CollectionLease,
  docs: DocBatch,
  suite: string,
  signal: AbortSignal
): Promise<void> {
  await SearchIndexLease.acquire(
    env,
    indexDefinition(
      indexNameFor(env, suite, 's_'),
      lease.bucketName,
      searchIndexParams('search_index.json', docs.uid)
    ),
    { manager: target.manager, signal }
  )
}

async function runGetAllIndexes(
  env: TestEnv,
  target: SearchTarget,
  lease: CollectionLease
): Promise<void> {
  const idxs = await target.manager.getAllIndexes()
  expect(
    idxs.length,
    withCtx(
      'at least the index this suite created should be listed',
      env.ctx(searchCtx(lease, 'getAllIndexes'))
    )
  ).toBeGreaterThanOrEqual(1)
}

async function runGetIndex(
  env: TestEnv,
  target: SearchTarget,
  lease: CollectionLease,
  suite: string
): Promise<void> {
  const name = indexNameFor(env, suite, 's_')
  const idx = await target.manager.getIndex(name)
  expect(
    idx.name,
    withCtx('index name', env.ctx(searchCtx(lease, 'getIndex', name)))
  ).toEqual(name)
}

async function runSeeTestData(
  env: TestEnv,
  target: SearchTarget,
  lease: CollectionLease,
  docs: DocBatch,
  suite: string,
  signal: AbortSignal
): Promise<void> {
  const name = indexNameFor(env, suite, 's_')
  const res = await searchUntilRows(
    `the search service to return ${docs.size} row(s)`,
    () =>
      target.query(name, SearchQuery.term(docs.uid).field('testUid'), {
        explain: true,
        fields: ['name'],
        includeLocations: true,
        highlight: { style: HighlightStyle.HTML },
      }),
    (rows) => rows === docs.size,
    SEARCH_DEADLINE_MS,
    signal
  )
  assertSearchResult(res, docs.size, env.ctx(searchCtx(lease, 'search', name)))
}

async function runDisableScoring(
  env: TestEnv,
  target: SearchTarget,
  lease: CollectionLease,
  docs: DocBatch,
  suite: string,
  signal: AbortSignal
): Promise<void> {
  const name = indexNameFor(env, suite, 's_')
  const res = await searchUntilRows(
    `the search service to return ${docs.size} unscored row(s)`,
    () =>
      target.query(name, SearchQuery.term(docs.uid).field('testUid'), {
        disableScoring: true,
      }),
    (rows) => rows === docs.size,
    DISABLE_SCORING_DEADLINE_MS,
    signal
  )
  assertScoringDisabled(
    res,
    docs.size,
    env.ctx(searchCtx(lease, 'search', 'disableScoring'))
  )
}

async function runDropIndex(
  env: TestEnv,
  target: SearchTarget,
  suite: string
): Promise<void> {
  await target.manager.dropIndex(indexNameFor(env, suite, 's_'))
}

async function runDropMissingIndex(
  env: TestEnv,
  target: SearchTarget,
  lease: CollectionLease,
  suite: string
): Promise<void> {
  const name = indexNameFor(env, suite, 's_')
  // Regression guard (JSCBC-1469): both the cluster and the scope endpoint
  // report a missing index as `IndexNotFoundError`.
  await expectThrows(
    () => target.manager.dropIndex(name),
    IndexNotFoundError,
    undefined,
    env.ctx(searchCtx(lease, 'dropIndex', 'already dropped'))
  )
}

const TARGETS: readonly {
  name: string
  features: readonly ServerFeature[]
  target: (env: TestEnv) => SearchTarget
}[] = [
  {
    name: '#search',
    features: [ServerFeature.Search],
    target: (env) => clusterTarget(env.cluster),
  },
  {
    name: '#scopesearch',
    features: [
      ServerFeature.Search,
      ServerFeature.Collections,
      ServerFeature.ScopeSearch,
      ServerFeature.ScopeSearchIndexManagement,
    ],
    target: (env) => scopeTarget(env.defaultScope),
  },
]

for (const { name, features, target } of TARGETS) {
  defineSuite(
    name,
    { features, collection: CollectionStrategy.DefaultCollection, docs: {} },
    ({ test }) => {
      test('should successfully create an index', async ({
        collectionLease,
        docs,
        env,
        signal,
      }) => {
        await runCreateIndex(
          env,
          target(env),
          collectionLease,
          docs,
          name,
          signal
        )
      })

      test('should successfully get all indexes', async ({
        collectionLease,
        env,
      }) => {
        await runGetAllIndexes(env, target(env), collectionLease)
      })

      test('should successfully get an index', async ({
        collectionLease,
        env,
      }) => {
        await runGetIndex(env, target(env), collectionLease, name)
      })

      test(
        'should see test data correctly',
        { timeout: SEE_TEST_DATA_TIMEOUT_MS },
        async ({ collectionLease, docs, env, signal }) => {
          await runSeeTestData(
            env,
            target(env),
            collectionLease,
            docs,
            name,
            signal
          )
        }
      )

      test('should disable scoring', async ({
        collectionLease,
        docs,
        env,
        signal,
      }) => {
        await runDisableScoring(
          env,
          target(env),
          collectionLease,
          docs,
          name,
          signal
        )
      })

      test('should successfully drop an index', async ({ env }) => {
        await runDropIndex(env, target(env), name)
      })

      test('should fail to drop a missing index', async ({
        collectionLease,
        env,
      }) => {
        await runDropMissingIndex(env, target(env), collectionLease, name)
      })
    }
  )
}

let vectorDocs: readonly Record<string, unknown>[] | undefined
let vector: number[] | undefined

/**
 * Read on first use, not at import: the file is 3.6MB, and a cluster without
 * vector search should not pay to parse it.
 */
function vectorSearchDocs(): readonly Record<string, unknown>[] {
  if (!vectorDocs) {
    vectorDocs = readFileSync(
      join(DATA_DIR, 'test_vector_search_docs.json'),
      'utf8'
    )
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>)
  }
  return vectorDocs
}

function testVector(): number[] {
  if (!vector) {
    vector = JSON.parse(
      readFileSync(join(DATA_DIR, 'test_vector.json'), 'utf8')
    ) as number[]
  }
  return vector
}

function vectorDocsFor(
  env: TestEnv,
  requirements: ResolvedRequirements,
  collection: Collection
): Promise<DocBatch> {
  return env.docsFor(requirements, collection, { docs: vectorSearchDocs() })
}

const VECTOR_SEARCH_LIMIT = 2

defineSuite(
  '#vectorsearch',
  {
    features: [ServerFeature.VectorSearch],
    collection: CollectionStrategy.DefaultCollection,
  },
  ({ test }) => {
    // These validation tests never reach the server but take `env` for the
    // assertion context; the suite is gated on vector search anyway.
    test('should handle invalid SearchRequest', async ({ env }) => {
      const c = env.ctx({ op: 'new SearchRequest' })
      expect(
        // @ts-expect-error null is not a SearchQuery or VectorSearch
        () => new SearchRequest(null),
        withCtx('null', c)
      ).toThrow(InvalidArgumentError)
      expect(
        // @ts-expect-error undefined is not a SearchQuery or VectorSearch
        () => new SearchRequest(undefined),
        withCtx('undefined', c)
      ).toThrow(InvalidArgumentError)
      expect(
        // @ts-expect-error a plain object is not a SearchQuery or VectorSearch
        () => new SearchRequest({}),
        withCtx('an empty object', c)
      ).toThrow(InvalidArgumentError)
      expect(
        // @ts-expect-error null is not a SearchQuery or VectorSearch
        () => SearchRequest.create(null),
        withCtx('create(null)', c)
      ).toThrow(InvalidArgumentError)
      expect(
        // @ts-expect-error undefined is not a SearchQuery or VectorSearch
        () => SearchRequest.create(undefined),
        withCtx('create(undefined)', c)
      ).toThrow(InvalidArgumentError)
      expect(
        // @ts-expect-error a plain object is not a SearchQuery or VectorSearch
        () => SearchRequest.create({}),
        withCtx('create({})', c)
      ).toThrow(InvalidArgumentError)

      const vectorSearch = VectorSearch.fromVectorQuery(
        new VectorQuery('vector_field', testVector())
      )
      const searchQuery = new MatchAllSearchQuery()

      expect(
        () => {
          const req = SearchRequest.create(vectorSearch)
          // @ts-expect-error a VectorSearch is not a SearchQuery
          req.withSearchQuery(vectorSearch)
        },
        withCtx('a vector search as the search query', c)
      ).toThrow(InvalidArgumentError)
      expect(
        () => {
          const req = SearchRequest.create(vectorSearch)
          // @ts-expect-error a SearchQuery is not a VectorSearch
          req.withVectorSearch(searchQuery)
        },
        withCtx('a search query as the vector search', c)
      ).toThrow(InvalidArgumentError)
      expect(
        () => {
          const req = SearchRequest.create(vectorSearch)
          req.withVectorSearch(vectorSearch)
        },
        withCtx('two vector searches', c)
      ).toThrow(InvalidArgumentError)

      expect(
        () => {
          const req = SearchRequest.create(searchQuery)
          // @ts-expect-error a SearchQuery is not a VectorSearch
          req.withVectorSearch(searchQuery)
        },
        withCtx('a search query as the vector search', c)
      ).toThrow(InvalidArgumentError)
      expect(
        () => {
          const req = SearchRequest.create(searchQuery)
          // @ts-expect-error a VectorSearch is not a SearchQuery
          req.withSearchQuery(vectorSearch)
        },
        withCtx('a vector search as the search query', c)
      ).toThrow(InvalidArgumentError)
      expect(
        () => {
          const req = SearchRequest.create(searchQuery)
          req.withSearchQuery(searchQuery)
        },
        withCtx('two search queries', c)
      ).toThrow(InvalidArgumentError)
    })

    test('should handle invalid VectorQuery', async ({ env }) => {
      const c = env.ctx({ op: 'new VectorQuery' })
      expect(
        // @ts-expect-error a null vector is not a number[] or string
        () => new VectorQuery('vector_field', null),
        withCtx('a null vector', c)
      ).toThrow(InvalidArgumentError)
      expect(
        // @ts-expect-error an undefined vector is not a number[] or string
        () => new VectorQuery('vector_field', undefined),
        withCtx('an undefined vector', c)
      ).toThrow(InvalidArgumentError)
      expect(
        // @ts-expect-error a plain object is not a number[] or string
        () => new VectorQuery('vector_field', {}),
        withCtx('an object', c)
      ).toThrow(InvalidArgumentError)
      expect(
        () => new VectorQuery('vector_field', []),
        withCtx('an empty vector', c)
      ).toThrow(InvalidArgumentError)
      expect(
        () => {
          const vQuery = new VectorQuery('vector_field', testVector())
          vQuery.numCandidates(0)
        },
        withCtx('numCandidates(0)', c)
      ).toThrow(InvalidArgumentError)
      expect(
        () => {
          const vQuery = new VectorQuery('vector_field', testVector())
          vQuery.numCandidates(-1)
        },
        withCtx('numCandidates(-1)', c)
      ).toThrow(InvalidArgumentError)
      expect(
        () => {
          const vQuery = new VectorQuery('vector_field', testVector())
          // @ts-expect-error a VectorQuery is not a SearchQuery
          vQuery.prefilter(new VectorQuery('vector_field1', testVector()))
        },
        withCtx('a vector query as a prefilter', c)
      ).toThrow(InvalidArgumentError)
      expect(
        () => new VectorQuery('', testVector()),
        withCtx('an empty field name', c)
      ).toThrow(InvalidArgumentError)
      expect(
        // @ts-expect-error null is not a field name
        () => new VectorQuery(null, testVector()),
        withCtx('a null field name', c)
      ).toThrow(InvalidArgumentError)
      expect(
        // @ts-expect-error undefined is not a field name
        () => new VectorQuery(undefined, testVector()),
        withCtx('an undefined field name', c)
      ).toThrow(InvalidArgumentError)
    })

    test('should successfully create an index', async ({
      cluster,
      collection,
      collectionLease,
      env,
      requirements,
      signal,
    }) => {
      const docs = await vectorDocsFor(env, requirements, collection)
      await SearchIndexLease.acquire(
        env,
        indexDefinition(
          indexNameFor(env, '#vectorsearch', 'vs_'),
          collectionLease.bucketName,
          searchIndexParams('vector_search_index.json', docs.uid)
        ),
        { manager: cluster.searchIndexes(), signal }
      )
    })

    test(
      'should see test data correctly',
      { timeout: SEE_TEST_DATA_TIMEOUT_MS },
      async ({
        cluster,
        collection,
        collectionLease,
        env,
        requirements,
        signal,
      }) => {
        const docs = await vectorDocsFor(env, requirements, collection)
        const name = indexNameFor(env, '#vectorsearch', 'vs_')

        const request = SearchRequest.create(
          VectorSearch.fromVectorQuery(
            new VectorQuery('vector_field', testVector())
          )
        )
        request.withSearchQuery(SearchQuery.term(docs.uid).field('testUid'))

        const res = await searchUntilRows(
          `the search service to return ${VECTOR_SEARCH_LIMIT} row(s)`,
          () =>
            cluster.search(name, request, {
              limit: VECTOR_SEARCH_LIMIT,
              explain: true,
              fields: ['text'],
              includeLocations: true,
              highlight: { style: HighlightStyle.HTML },
            }),
          (rows) => rows >= VECTOR_SEARCH_LIMIT,
          SEARCH_DEADLINE_MS,
          signal
        )

        assertVectorSearchResult(
          res,
          VECTOR_SEARCH_LIMIT,
          env.ctx(searchCtx(collectionLease, 'search', name))
        )
      }
    )

    test('should successfully drop an index', async ({ cluster, env }) => {
      await cluster
        .searchIndexes()
        .dropIndex(indexNameFor(env, '#vectorsearch', 'vs_'))
    })
  }
)
