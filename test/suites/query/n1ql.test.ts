import { describe, expect } from 'vitest'

import type { Cluster } from '../../../lib/cluster'
import {
  AmbiguousTimeoutError,
  IndexExistsError,
  IndexNotFoundError,
  InternalServerFailureError,
  InvalidArgumentError,
  RequestCanceledError,
  UnambiguousTimeoutError,
} from '../../../lib/errors'
import type {
  QueryMetaData,
  QueryOptions,
  QueryResult,
} from '../../../lib/querytypes'
import { QueryProfileMode, QueryStatus } from '../../../lib/querytypes'
import type { StreamableRowPromise } from '../../../lib/streamablepromises'
import { AssertCtx, withCtx } from '../../asserts/ctx'
import { expectThrows } from '../../asserts/errors'
import { assertRowCount } from '../../asserts/rows'
import { ServerFeature } from '../../infra/capabilities'
import { DocBatch } from '../../infra/data/loader'
import { TestEnv } from '../../infra/env'
import { CollectionLease } from '../../infra/leases/collection-lease'
import { QueryIndexLease } from '../../infra/leases/index-lease'
import { CollectionStrategy } from '../../infra/requirements'
import { pollUntil, sleep, tryNTimes } from '../../infra/retry'
import { defineSuite } from '../../infra/suite'

// Each query block leases a secondary index on `testUid`, so a query test can
// run alone or in any order without a primary index created by a sibling. The
// management tests are unaffected: a named primary index and a leased
// secondary index coexist, and every count they assert is `>= 1`.
//
// The `#CollectionQueryIndexManagement` blocks create, watch and drop indexes
// and read no documents, so they declare no `docs`.

// Poll deadlines, so a slow cluster reports what it last saw rather than a
// bare runner timeout.

const QUERY_DEADLINE_MS = 10_000
/**
 * On 7.0 and 7.1 a query service stall of about two minutes, cause unknown, can
 * time out a primary index create on a named collection. A create that times
 * out is made once more after the stall has had time to pass, and the runner
 * limit leaves room for both attempts and the wait.
 */
const PRIMARY_CREATE_OP_TIMEOUT_MS = 40_000
const PRIMARY_CREATE_STALL_WAIT_MS = 60_000
const PRIMARY_CREATE_TIMEOUT_MS = 150_000
const DEFERRED_BUILD_TIMEOUT_MS = 60_000

const DEFERRED_INDEX_COUNT = 3
const WATCH_TIMEOUT_MS = 2000
const DEFERRED_WATCH_TIMEOUT_MS = 6000

/** How long a repeated drop may answer in the form the core does not map. */
const REPEAT_DROP_DEADLINE_MS = 15_000
const REPEAT_DROP_INTERVAL_MS = 500

/**
 * Whether `err` is GSI error 5000 saying the index does not exist, which a
 * drop repeated while the previous drop is still applying can receive. The
 * core maps a 5000 to a missing index only when its message says "not found",
 * so this one surfaces as `InternalServerFailureError` (CXXCBC-1059).
 */
function isUnmappedIndexMissing(
  err: unknown
): err is InternalServerFailureError {
  return (
    err instanceof InternalServerFailureError &&
    /does not exist/i.test(JSON.stringify(err.context ?? {}))
  )
}

/**
 * Drops an index that is already gone, polling through the unmapped "does not
 * exist" form until the deadline. Resolves on success and rethrows anything
 * else, so the caller's `expectThrows` sees any other outcome for what it is.
 */
async function dropAlreadyDropped(drop: () => Promise<void>): Promise<void> {
  let failure: unknown
  await pollUntil(
    'a repeated drop to report the index missing',
    async (poll) => {
      try {
        await drop()
        return true
      } catch (err) {
        if (isUnmappedIndexMissing(err)) {
          const said = JSON.stringify(err.context)
          poll.note(`the index service said ${said}`)
          return undefined
        }
        failure = err
        return true
      }
    },
    {
      deadlineMs: REPEAT_DROP_DEADLINE_MS,
      intervalMs: REPEAT_DROP_INTERVAL_MS,
    }
  )
  if (failure !== undefined) {
    throw failure
  }
}

const READ_INDEX_KEYS = ['testUid'] as const

// What distinguishes the cluster-level block from the scope-level one; the
// runners below are shared.

interface QueryTarget {
  /** Names the keyspace for the cluster-level index manager, or nothing. */
  readonly indexOptions: {
    readonly collectionName?: string
    readonly scopeName?: string
  }
  /** The `FROM` target: the bucket at cluster level, the collection below it. */
  readonly keyspace: string
  query(
    statement: string,
    options?: QueryOptions
  ): StreamableRowPromise<QueryResult, unknown, QueryMetaData>
}

type TargetFactory = (cluster: Cluster, lease: CollectionLease) => QueryTarget

const clusterTarget: TargetFactory = (cluster, lease) => ({
  indexOptions: {},
  keyspace: lease.bucketName,
  query: (statement, options) => cluster.query(statement, options),
})

const scopeTarget: TargetFactory = (cluster, lease) => {
  const scope = cluster.bucket(lease.bucketName).scope(lease.scopeName)
  return {
    indexOptions: {
      collectionName: lease.collectionName,
      scopeName: lease.scopeName,
    },
    keyspace: lease.collectionName,
    query: (statement, options) => scope.query(statement, options),
  }
}

// Index names and `testUid` are memoized under a key naming the block and the
// keyspace: `#query - cluster level` and `#CollectionQueryIndexManager
// (default)` share a keyspace and must not share index names.

interface IndexNames {
  readonly primary: string
  readonly secondary: string
}

const indexNames = new Map<string, IndexNames>()

function namesFor(env: TestEnv, block: string, keyspace: string): IndexNames {
  const key = `${block}:${keyspace}`
  const existing = indexNames.get(key)
  if (existing) {
    return existing
  }
  const created: IndexNames = { primary: env.key(), secondary: env.key() }
  indexNames.set(key, created)
  return created
}

/**
 * The index the query tests read through, one per keyspace. Promises are
 * memoized, not leases: two tests starting together would otherwise create the
 * index twice, and the lease swallowing the second `IndexExistsError` would
 * own nothing.
 */
const readIndexes = new Map<string, Promise<QueryIndexLease>>()

function readIndexFor(
  env: TestEnv,
  lease: CollectionLease
): Promise<QueryIndexLease> {
  const key = `${lease.bucketName}.${lease.scopeName}.${lease.collectionName}`
  const existing = readIndexes.get(key)
  if (existing) {
    return existing
  }

  const pending = QueryIndexLease.acquire(env, lease.collection, env.key(), [
    ...READ_INDEX_KEYS,
  ])
  readIndexes.set(key, pending)
  return pending.catch((err) => {
    // Not cached, or every later query test fails with this rejection.
    readIndexes.delete(key)
    throw err
  })
}

function queryCtx(
  lease: CollectionLease,
  op: string,
  extra?: string
): AssertCtx {
  return {
    op,
    bucket: lease.bucketName,
    scope: lease.scopeName,
    collection: lease.collectionName,
    ...(extra === undefined ? {} : { extra }),
  }
}

interface RowsAndMeta {
  readonly rows: readonly unknown[]
  /** Undefined only when a stream ended without emitting `meta`. */
  readonly meta: QueryMetaData | undefined
}

function assertQueryResult(
  res: RowsAndMeta,
  expected: number,
  c: AssertCtx = {}
): void {
  expect(
    Array.isArray(res.rows),
    withCtx('query did not return an array of rows', c)
  ).toBe(true)
  assertRowCount(res.rows, expected, c)
  expect(res.meta, withCtx('query returned no metadata', c)).toBeTypeOf(
    'object'
  )
}

/**
 * Runs a query until it returns the expected rows, or the deadline passes. The
 * last error is kept with the last row count, so the deadline message says
 * whether the query was failing or returning too few rows.
 */
function queryUntilRows(
  run: () => Promise<RowsAndMeta>,
  expected: number,
  signal: AbortSignal
): Promise<RowsAndMeta> {
  return pollUntil<RowsAndMeta>(
    `the query service to return ${expected} row(s)`,
    async (ctx) => {
      let res: RowsAndMeta
      try {
        res = await run()
      } catch (err) {
        ctx.note(err instanceof Error ? err.message : String(err))
        return undefined
      }
      if (res.rows.length !== expected) {
        ctx.note(`${res.rows.length} row(s)`)
        return undefined
      }
      return res
    },
    { deadlineMs: QUERY_DEADLINE_MS, intervalMs: 100, signal }
  )
}

/** Collects a query's rows through its event emitter rather than awaiting it. */
function streamQuery(
  start: () => StreamableRowPromise<QueryResult, unknown, QueryMetaData>
): Promise<RowsAndMeta> {
  return new Promise<RowsAndMeta>((resolve, reject) => {
    const rows: unknown[] = []
    let meta: QueryMetaData | undefined
    start()
      .on('row', (row: unknown) => {
        rows.push(row)
      })
      .on('meta', (m: QueryMetaData) => {
        meta = m
      })
      .on('end', () => {
        resolve({ rows, meta })
      })
      .on('error', (err: Error) => {
        reject(err)
      })
  })
}

/**
 * Makes a primary index create, and once more if it times out (see
 * `PRIMARY_CREATE_OP_TIMEOUT_MS`). The retry finding the index already there
 * means the first landed late, which counts as success.
 */
async function createPrimaryRidingOutStall(
  create: (timeout: number) => Promise<void>,
  signal: AbortSignal
): Promise<void> {
  try {
    await create(PRIMARY_CREATE_OP_TIMEOUT_MS)
    return
  } catch (err) {
    if (
      !(err instanceof AmbiguousTimeoutError) &&
      !(err instanceof UnambiguousTimeoutError)
    ) {
      throw err
    }
  }
  await sleep(PRIMARY_CREATE_STALL_WAIT_MS, signal)
  try {
    await create(PRIMARY_CREATE_OP_TIMEOUT_MS)
  } catch (err) {
    if (!(err instanceof IndexExistsError)) {
      throw err
    }
  }
}

async function runCreatePrimaryIndex(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  makeTarget: TargetFactory,
  block: string,
  signal: AbortSignal
): Promise<void> {
  const target = makeTarget(cluster, lease)
  const name = namesFor(env, block, target.keyspace).primary
  // Registered before the create, so a create that lands after its timeout is
  // still dropped. The drop test normally removes it first.
  env.registerCleanup(() =>
    cluster.queryIndexes().dropPrimaryIndex(lease.bucketName, {
      name,
      ...target.indexOptions,
      ignoreIfNotExists: true,
    })
  )
  await createPrimaryRidingOutStall(
    (timeout) =>
      cluster.queryIndexes().createPrimaryIndex(lease.bucketName, {
        name,
        ...target.indexOptions,
        timeout,
      }),
    signal
  )
}

async function runDuplicatePrimaryIndex(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  makeTarget: TargetFactory,
  block: string
): Promise<void> {
  const target = makeTarget(cluster, lease)
  await expectThrows(
    () =>
      cluster.queryIndexes().createPrimaryIndex(lease.bucketName, {
        name: namesFor(env, block, target.keyspace).primary,
        ...target.indexOptions,
      }),
    IndexExistsError,
    undefined,
    env.ctx(queryCtx(lease, 'createPrimaryIndex', 'duplicate'))
  )
}

async function runCreateSecondaryIndex(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  makeTarget: TargetFactory,
  block: string
): Promise<void> {
  // Owned by the env, so an assertion failure below cannot leak it.
  const other = await env.openCluster()
  const target = makeTarget(cluster, lease)
  const name = namesFor(env, block, target.keyspace).secondary
  env.registerCleanup(() =>
    cluster.queryIndexes().dropIndex(lease.bucketName, name, {
      ...target.indexOptions,
      ignoreIfNotExists: true,
    })
  )
  await other
    .queryIndexes()
    .createIndex(lease.bucketName, name, ['name'], target.indexOptions)
}

async function runDuplicateSecondaryIndex(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  makeTarget: TargetFactory,
  block: string
): Promise<void> {
  const target = makeTarget(cluster, lease)
  await expectThrows(
    () =>
      cluster
        .queryIndexes()
        .createIndex(
          lease.bucketName,
          namesFor(env, block, target.keyspace).secondary,
          ['name'],
          target.indexOptions
        ),
    IndexExistsError,
    undefined,
    env.ctx(queryCtx(lease, 'createIndex', 'duplicate'))
  )
}

async function runGetAllIndexes(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  makeTarget: TargetFactory
): Promise<void> {
  const target = makeTarget(cluster, lease)
  const indexes = await cluster
    .queryIndexes()
    .getAllIndexes(lease.bucketName, target.indexOptions)

  expect(
    indexes.length,
    withCtx(
      'expected at least one index',
      env.ctx(queryCtx(lease, 'getAllIndexes'))
    )
  ).toBeGreaterThanOrEqual(1)
}

async function runSeeTestData(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  docs: DocBatch,
  makeTarget: TargetFactory,
  signal: AbortSignal
): Promise<void> {
  await readIndexFor(env, lease)
  const target = makeTarget(cluster, lease)
  const statement = `SELECT * FROM ${target.keyspace} WHERE testUid='${docs.uid}'`

  const res = await queryUntilRows(
    () => target.query(statement),
    docs.size,
    signal
  )
  assertQueryResult(
    res,
    docs.size,
    env.ctx(queryCtx(lease, 'query', statement))
  )
}

async function runSeeTestDataOnNewConnection(
  env: TestEnv,
  lease: CollectionLease,
  docs: DocBatch,
  makeTarget: TargetFactory,
  signal: AbortSignal
): Promise<void> {
  await readIndexFor(env, lease)
  const other = await env.openCluster()
  const target = makeTarget(other, lease)
  const statement = `SELECT * FROM ${target.keyspace} WHERE testUid='${docs.uid}'`

  const res = await queryUntilRows(
    () => target.query(statement),
    docs.size,
    signal
  )
  assertQueryResult(
    res,
    docs.size,
    env.ctx(queryCtx(lease, 'query', 'new connection'))
  )
}

async function runStreamTestData(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  docs: DocBatch,
  makeTarget: TargetFactory,
  signal: AbortSignal
): Promise<void> {
  await readIndexFor(env, lease)
  const target = makeTarget(cluster, lease)
  const statement = `SELECT * FROM ${target.keyspace} WHERE testUid='${docs.uid}'`

  const res = await queryUntilRows(
    () => streamQuery(() => target.query(statement)),
    docs.size,
    signal
  )
  assertQueryResult(
    res,
    docs.size,
    env.ctx(queryCtx(lease, 'query', 'streamed'))
  )
}

async function runPositionalParameters(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  docs: DocBatch,
  makeTarget: TargetFactory,
  signal: AbortSignal
): Promise<void> {
  await readIndexFor(env, lease)
  const target = makeTarget(cluster, lease)
  // `$2`, with `undefined` in the first slot: a hole in the positional list is
  // carried through rather than collapsing the numbering.
  const statement = `SELECT * FROM ${target.keyspace} WHERE testUid=$2`

  const res = await queryUntilRows(
    () => target.query(statement, { parameters: [undefined, docs.uid] }),
    docs.size,
    signal
  )
  assertQueryResult(
    res,
    docs.size,
    env.ctx(queryCtx(lease, 'query', 'positional parameters'))
  )
}

async function runNamedParameters(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  docs: DocBatch,
  makeTarget: TargetFactory,
  signal: AbortSignal
): Promise<void> {
  await readIndexFor(env, lease)
  const target = makeTarget(cluster, lease)
  const statement = `SELECT * FROM ${target.keyspace} WHERE testUid=$tuid`

  const res = await queryUntilRows(
    () => target.query(statement, { parameters: { tuid: docs.uid } }),
    docs.size,
    signal
  )
  assertQueryResult(
    res,
    docs.size,
    env.ctx(queryCtx(lease, 'query', 'named parameters'))
  )
}

async function runFilteredNamedParameters(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  docs: DocBatch,
  makeTarget: TargetFactory,
  signal: AbortSignal
): Promise<void> {
  await readIndexFor(env, lease)
  const target = makeTarget(cluster, lease)
  const statement = `SELECT * FROM ${target.keyspace} WHERE testUid=$tuid`

  const res = await queryUntilRows(
    () =>
      target.query(statement, {
        parameters: { tuid: docs.uid, filterMe: undefined },
      }),
    docs.size,
    signal
  )
  assertQueryResult(
    res,
    docs.size,
    env.ctx(queryCtx(lease, 'query', 'undefined named parameter'))
  )
}

async function runLotsOfOptions(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  docs: DocBatch,
  makeTarget: TargetFactory,
  signal: AbortSignal
): Promise<void> {
  await readIndexFor(env, lease)
  const target = makeTarget(cluster, lease)
  const statement = `SELECT * FROM ${target.keyspace} WHERE testUid="${docs.uid}"`

  const res = await queryUntilRows(
    () =>
      target.query(statement, {
        adhoc: true,
        clientContextId: 'hello-world',
        maxParallelism: 10,
        pipelineBatch: 10,
        pipelineCap: 10,
        scanCap: 10,
        readOnly: true,
        profile: QueryProfileMode.Timings,
        metrics: true,
      }),
    docs.size,
    signal
  )

  const c = env.ctx(queryCtx(lease, 'query', 'all options'))
  assertQueryResult(res, docs.size, c)

  // Asserted above; this only narrows.
  const meta = res.meta
  if (meta === undefined) {
    throw new Error(withCtx('query returned no metadata', c))
  }
  expect(meta.requestId, withCtx('meta.requestId', c)).toBeTypeOf('string')
  expect(meta.clientContextId, withCtx('meta.clientContextId', c)).toEqual(
    'hello-world'
  )
  expect(meta.status, withCtx('meta.status', c)).toEqual(QueryStatus.Success)
  expect(meta.signature, withCtx('meta.signature', c)).toBeTypeOf('object')
  expect(meta.metrics, withCtx('meta.metrics', c)).toBeTypeOf('object')
  expect(meta.profile, withCtx('meta.profile', c)).toBeTypeOf('object')
}

async function runWatchIndexes(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  makeTarget: TargetFactory,
  block: string
): Promise<void> {
  const target = makeTarget(cluster, lease)
  const names = namesFor(env, block, target.keyspace)
  await cluster
    .queryIndexes()
    .watchIndexes(
      lease.bucketName,
      [names.primary, names.secondary],
      WATCH_TIMEOUT_MS,
      target.indexOptions
    )
}

async function runWatchMissingIndex(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  makeTarget: TargetFactory
): Promise<void> {
  const target = makeTarget(cluster, lease)
  await expectThrows(
    () =>
      cluster
        .queryIndexes()
        .watchIndexes(
          lease.bucketName,
          ['invalid-index'],
          WATCH_TIMEOUT_MS,
          target.indexOptions
        ),
    IndexNotFoundError,
    undefined,
    env.ctx(queryCtx(lease, 'watchIndexes', 'invalid-index'))
  )
}

async function runDropSecondaryIndex(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  makeTarget: TargetFactory,
  block: string
): Promise<void> {
  const target = makeTarget(cluster, lease)
  await cluster
    .queryIndexes()
    .dropIndex(
      lease.bucketName,
      namesFor(env, block, target.keyspace).secondary,
      target.indexOptions
    )
}

async function runDropMissingSecondaryIndex(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  makeTarget: TargetFactory,
  block: string
): Promise<void> {
  const target = makeTarget(cluster, lease)
  await expectThrows(
    () =>
      dropAlreadyDropped(() =>
        cluster
          .queryIndexes()
          .dropIndex(
            lease.bucketName,
            namesFor(env, block, target.keyspace).secondary,
            target.indexOptions
          )
      ),
    IndexNotFoundError,
    undefined,
    env.ctx(queryCtx(lease, 'dropIndex', 'already dropped'))
  )
}

async function runDropPrimaryIndex(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  makeTarget: TargetFactory,
  block: string
): Promise<void> {
  const target = makeTarget(cluster, lease)
  await cluster.queryIndexes().dropPrimaryIndex(lease.bucketName, {
    name: namesFor(env, block, target.keyspace).primary,
    ...target.indexOptions,
  })
}

async function runDropMissingPrimaryIndex(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  makeTarget: TargetFactory,
  block: string
): Promise<void> {
  const target = makeTarget(cluster, lease)
  await expectThrows(
    () =>
      dropAlreadyDropped(() =>
        cluster.queryIndexes().dropPrimaryIndex(lease.bucketName, {
          name: namesFor(env, block, target.keyspace).primary,
          ...target.indexOptions,
        })
      ),
    IndexNotFoundError,
    undefined,
    env.ctx(queryCtx(lease, 'dropPrimaryIndex', 'already dropped'))
  )
}

// The deferred-index setup is memoized so a retried test re-runs
// `buildDeferredIndexes` and the watch without creating three more indexes.

const deferredIndexes = new Map<string, Promise<readonly string[]>>()

function deferredIndexesFor(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  target: QueryTarget,
  block: string
): Promise<readonly string[]> {
  const key = `${block}:${target.keyspace}`
  const existing = deferredIndexes.get(key)
  if (existing) {
    return existing
  }

  const pending = createDeferredIndexes(env, cluster, lease, target)
  deferredIndexes.set(key, pending)
  return pending.catch((err) => {
    deferredIndexes.delete(key)
    throw err
  })
}

async function createDeferredIndexes(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  target: QueryTarget
): Promise<readonly string[]> {
  const created: string[] = []
  // Registered before the first create, so a failure part way through still
  // drops what it made.
  env.registerCleanup(async () => {
    await Promise.allSettled(
      created.map((name) =>
        cluster
          .queryIndexes()
          .dropIndex(lease.bucketName, name, target.indexOptions)
      )
    )
  })

  for (let i = 0; i < DEFERRED_INDEX_COUNT; ++i) {
    const name = env.key()
    created.push(name)
    await cluster.queryIndexes().createIndex(lease.bucketName, name, ['name'], {
      ...target.indexOptions,
      deferred: true,
    })
  }

  // Every deferred index in the keyspace, not only the three above, because
  // that is what `buildDeferredIndexes` will build.
  const all = await cluster
    .queryIndexes()
    .getAllIndexes(lease.bucketName, target.indexOptions)
  return all.filter((idx) => idx.state === 'deferred').map((idx) => idx.name)
}

async function runBuildDeferredIndexes(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  makeTarget: TargetFactory,
  block: string,
  signal: AbortSignal
): Promise<void> {
  const target = makeTarget(cluster, lease)
  const names = await deferredIndexesFor(env, cluster, lease, target, block)

  const manager = cluster.queryIndexes()
  await manager.buildDeferredIndexes(lease.bucketName, target.indexOptions)
  await tryNTimes(
    5,
    2000,
    () =>
      manager.watchIndexes(
        lease.bucketName,
        [...names],
        DEFERRED_WATCH_TIMEOUT_MS,
        target.indexOptions
      ),
    signal
  )
}

const COLLECTION_BLOCK = 'collection-index-manager'

async function runCollectionCreatePrimaryIndex(
  env: TestEnv,
  lease: CollectionLease,
  signal: AbortSignal
): Promise<void> {
  const name = namesFor(env, COLLECTION_BLOCK, keyspaceOf(lease)).primary
  env.registerCleanup(() =>
    lease.collection
      .queryIndexes()
      .dropPrimaryIndex({ name, ignoreIfNotExists: true })
  )
  await createPrimaryRidingOutStall(
    (timeout) =>
      lease.collection.queryIndexes().createPrimaryIndex({ name, timeout }),
    signal
  )
}

async function runCollectionCreateSecondaryIndex(
  env: TestEnv,
  lease: CollectionLease
): Promise<void> {
  const name = namesFor(env, COLLECTION_BLOCK, keyspaceOf(lease)).secondary
  env.registerCleanup(() =>
    lease.collection.queryIndexes().dropIndex(name, { ignoreIfNotExists: true })
  )
  await lease.collection.queryIndexes().createIndex(name, ['name'])
}

async function runCollectionDuplicateSecondaryIndex(
  env: TestEnv,
  lease: CollectionLease
): Promise<void> {
  await expectThrows(
    () =>
      lease.collection
        .queryIndexes()
        .createIndex(
          namesFor(env, COLLECTION_BLOCK, keyspaceOf(lease)).secondary,
          ['name']
        ),
    IndexExistsError,
    undefined,
    env.ctx(queryCtx(lease, 'createIndex', 'duplicate'))
  )
}

async function runCollectionGetAllIndexes(
  env: TestEnv,
  lease: CollectionLease
): Promise<void> {
  const indexes = await lease.collection.queryIndexes().getAllIndexes()
  expect(
    indexes.length,
    withCtx(
      'expected at least one index',
      env.ctx(queryCtx(lease, 'getAllIndexes'))
    )
  ).toBeGreaterThanOrEqual(1)
}

async function runCollectionWatchIndexes(
  env: TestEnv,
  lease: CollectionLease
): Promise<void> {
  const names = namesFor(env, COLLECTION_BLOCK, keyspaceOf(lease))
  await lease.collection
    .queryIndexes()
    .watchIndexes([names.primary, names.secondary], WATCH_TIMEOUT_MS)
}

async function runCollectionWatchMissingIndex(
  env: TestEnv,
  lease: CollectionLease
): Promise<void> {
  await expectThrows(
    () =>
      lease.collection
        .queryIndexes()
        .watchIndexes(['invalid-index'], WATCH_TIMEOUT_MS),
    IndexNotFoundError,
    undefined,
    env.ctx(queryCtx(lease, 'watchIndexes', 'invalid-index'))
  )
}

async function runCollectionDropSecondaryIndex(
  env: TestEnv,
  lease: CollectionLease
): Promise<void> {
  await lease.collection
    .queryIndexes()
    .dropIndex(namesFor(env, COLLECTION_BLOCK, keyspaceOf(lease)).secondary)
}

async function runCollectionDropMissingSecondaryIndex(
  env: TestEnv,
  lease: CollectionLease
): Promise<void> {
  await expectThrows(
    () =>
      dropAlreadyDropped(() =>
        lease.collection
          .queryIndexes()
          .dropIndex(
            namesFor(env, COLLECTION_BLOCK, keyspaceOf(lease)).secondary
          )
      ),
    IndexNotFoundError,
    undefined,
    env.ctx(queryCtx(lease, 'dropIndex', 'already dropped'))
  )
}

async function runCollectionDropPrimaryIndex(
  env: TestEnv,
  lease: CollectionLease
): Promise<void> {
  await lease.collection.queryIndexes().dropPrimaryIndex({
    name: namesFor(env, COLLECTION_BLOCK, keyspaceOf(lease)).primary,
  })
}

async function runCollectionDropMissingPrimaryIndex(
  env: TestEnv,
  lease: CollectionLease
): Promise<void> {
  await expectThrows(
    () =>
      dropAlreadyDropped(() =>
        lease.collection.queryIndexes().dropPrimaryIndex({
          name: namesFor(env, COLLECTION_BLOCK, keyspaceOf(lease)).primary,
        })
      ),
    IndexNotFoundError,
    undefined,
    env.ctx(queryCtx(lease, 'dropPrimaryIndex', 'already dropped'))
  )
}

const collectionDeferredIndexes = new Map<string, Promise<readonly string[]>>()

function collectionDeferredIndexesFor(
  env: TestEnv,
  lease: CollectionLease
): Promise<readonly string[]> {
  const key = keyspaceOf(lease)
  const existing = collectionDeferredIndexes.get(key)
  if (existing) {
    return existing
  }

  const pending = createCollectionDeferredIndexes(env, lease)
  collectionDeferredIndexes.set(key, pending)
  return pending.catch((err) => {
    collectionDeferredIndexes.delete(key)
    throw err
  })
}

async function createCollectionDeferredIndexes(
  env: TestEnv,
  lease: CollectionLease
): Promise<readonly string[]> {
  const manager = lease.collection.queryIndexes()
  const created: string[] = []
  env.registerCleanup(async () => {
    await Promise.allSettled(created.map((name) => manager.dropIndex(name)))
  })

  for (let i = 0; i < DEFERRED_INDEX_COUNT; ++i) {
    const name = env.key()
    created.push(name)
    await manager.createIndex(name, ['name'], { deferred: true })
  }

  const all = await manager.getAllIndexes()
  return all.filter((idx) => idx.state === 'deferred').map((idx) => idx.name)
}

async function runCollectionBuildDeferredIndexes(
  env: TestEnv,
  lease: CollectionLease,
  signal: AbortSignal
): Promise<void> {
  const names = await collectionDeferredIndexesFor(env, lease)
  const manager = lease.collection.queryIndexes()

  await manager.buildDeferredIndexes()
  await tryNTimes(
    5,
    2000,
    () => manager.watchIndexes([...names], DEFERRED_WATCH_TIMEOUT_MS),
    signal
  )
}

async function runRejectsScopeNameOption(
  env: TestEnv,
  lease: CollectionLease
): Promise<void> {
  const manager = lease.collection.queryIndexes()
  const c = env.ctx(queryCtx(lease, 'query index management', 'scopeName'))

  await expectThrows(
    () => manager.dropPrimaryIndex({ scopeName: 'testScope' }),
    InvalidArgumentError,
    undefined,
    c
  )
  await expectThrows(
    () => manager.getAllIndexes({ scopeName: 'testScope' }),
    InvalidArgumentError,
    undefined,
    c
  )
  await expectThrows(
    () => manager.dropIndex('testIndex', { scopeName: 'testScope' }),
    InvalidArgumentError,
    undefined,
    c
  )
}

async function runRejectsCollectionNameOption(
  env: TestEnv,
  lease: CollectionLease
): Promise<void> {
  const manager = lease.collection.queryIndexes()
  const c = env.ctx(queryCtx(lease, 'query index management', 'collectionName'))

  await expectThrows(
    () => manager.createPrimaryIndex({ collectionName: 'testCollection' }),
    InvalidArgumentError,
    undefined,
    c
  )
  await expectThrows(
    () => manager.getAllIndexes({ collectionName: 'testCollection' }),
    InvalidArgumentError,
    undefined,
    c
  )
  await expectThrows(
    () => manager.dropIndex('testIndex', { collectionName: 'testCollection' }),
    InvalidArgumentError,
    undefined,
    c
  )
}

function keyspaceOf(lease: CollectionLease): string {
  return `${lease.bucketName}.${lease.scopeName}.${lease.collectionName}`
}

const CLUSTER_BLOCK = 'query-cluster-level'

defineSuite(
  'N1QL',
  {
    features: [ServerFeature.Query],
    collection: CollectionStrategy.DefaultCollection,
    docs: {},
    // Index creation is seconds, not milliseconds, and `createPrimaryIndex` is
    // allowed a full minute of its own.
    tier: 'slow',
  },
  ({ test }) => {
    describe('#query - cluster level', () => {
      test(
        'should successfully create a primary index',
        { timeout: PRIMARY_CREATE_TIMEOUT_MS },
        async ({ cluster, collectionLease, env, signal }) => {
          await runCreatePrimaryIndex(
            env,
            cluster,
            collectionLease,
            clusterTarget,
            CLUSTER_BLOCK,
            signal
          )
        }
      )

      test('should fail to create a duplicate primary index', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        await runDuplicatePrimaryIndex(
          env,
          cluster,
          collectionLease,
          clusterTarget,
          CLUSTER_BLOCK
        )
      })

      test('should successfully create a secondary index (using a new connection)', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        await runCreateSecondaryIndex(
          env,
          cluster,
          collectionLease,
          clusterTarget,
          CLUSTER_BLOCK
        )
      })

      test('should fail to create a duplicate secondary index', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        await runDuplicateSecondaryIndex(
          env,
          cluster,
          collectionLease,
          clusterTarget,
          CLUSTER_BLOCK
        )
      })

      test('should successfully get all indexes', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        await runGetAllIndexes(env, cluster, collectionLease, clusterTarget)
      })

      test('should see test data correctly', async ({
        cluster,
        collectionLease,
        docs,
        env,
        signal,
      }) => {
        await runSeeTestData(
          env,
          cluster,
          collectionLease,
          docs,
          clusterTarget,
          signal
        )
      })

      test('should see test data correctly with a new connection', async ({
        collectionLease,
        docs,
        env,
        signal,
      }) => {
        await runSeeTestDataOnNewConnection(
          env,
          collectionLease,
          docs,
          clusterTarget,
          signal
        )
      })

      test('should stream test data correctly', async ({
        cluster,
        collectionLease,
        docs,
        env,
        signal,
      }) => {
        await runStreamTestData(
          env,
          cluster,
          collectionLease,
          docs,
          clusterTarget,
          signal
        )
      })

      test('should work with parameters correctly', async ({
        cluster,
        collectionLease,
        docs,
        env,
        signal,
      }) => {
        await runPositionalParameters(
          env,
          cluster,
          collectionLease,
          docs,
          clusterTarget,
          signal
        )
      })

      test('should work with named parameters correctly', async ({
        cluster,
        collectionLease,
        docs,
        env,
        signal,
      }) => {
        await runNamedParameters(
          env,
          cluster,
          collectionLease,
          docs,
          clusterTarget,
          signal
        )
      })

      test('should filter undefined named parameters', async ({
        cluster,
        collectionLease,
        docs,
        env,
        signal,
      }) => {
        await runFilteredNamedParameters(
          env,
          cluster,
          collectionLease,
          docs,
          clusterTarget,
          signal
        )
      })

      test('should work with lots of options specified', async ({
        cluster,
        collectionLease,
        docs,
        env,
        signal,
      }) => {
        await runLotsOfOptions(
          env,
          cluster,
          collectionLease,
          docs,
          clusterTarget,
          signal
        )
      })

      test('should wait till all indexes are online', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        await runWatchIndexes(
          env,
          cluster,
          collectionLease,
          clusterTarget,
          CLUSTER_BLOCK
        )
      })

      test('should fail watching when some indexes are missing', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        await runWatchMissingIndex(env, cluster, collectionLease, clusterTarget)
      })

      test('should successfully drop a secondary index', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        await runDropSecondaryIndex(
          env,
          cluster,
          collectionLease,
          clusterTarget,
          CLUSTER_BLOCK
        )
      })

      test('should fail to drop a missing secondary index', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        await runDropMissingSecondaryIndex(
          env,
          cluster,
          collectionLease,
          clusterTarget,
          CLUSTER_BLOCK
        )
      })

      test('should successfully drop a primary index', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        await runDropPrimaryIndex(
          env,
          cluster,
          collectionLease,
          clusterTarget,
          CLUSTER_BLOCK
        )
      })

      test('should fail to drop a missing primary index', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        await runDropMissingPrimaryIndex(
          env,
          cluster,
          collectionLease,
          clusterTarget,
          CLUSTER_BLOCK
        )
      })

      describe('#deferred', () => {
        test(
          'should build deferred indexes',
          // The build is the one operation here whose failure is transient.
          { retry: 3, timeout: DEFERRED_BUILD_TIMEOUT_MS },
          async ({ cluster, collectionLease, env, signal }) => {
            await runBuildDeferredIndexes(
              env,
              cluster,
              collectionLease,
              clusterTarget,
              CLUSTER_BLOCK,
              signal
            )
          }
        )
      })
    })
  }
)

// The streaming suite reads no documents and needs no index, so it runs at
// the default tier rather than inside the slow, index-leasing suite above.

const STREAMING_ROW_COUNT = 100_000
const STREAMING_TIMEOUT_MS = 30_000

// The rows come from two small ranges joined, because older query services cap
// how many elements one ARRAY_RANGE may produce and refuse a single range this
// large with "Out of range evaluating ARRAY_RANGE()".
const STREAMING_RANGE_INNER = 1_000
const STREAMING_STATEMENT =
  `SELECT RAW o * ${STREAMING_RANGE_INNER} + i ` +
  `FROM ARRAY_RANGE(0, ${STREAMING_ROW_COUNT / STREAMING_RANGE_INNER}) AS o ` +
  `UNNEST ARRAY_RANGE(0, ${STREAMING_RANGE_INNER}) AS i`

type StreamEvent = 'row' | 'end' | Error

/**
 * Starts a large query on a connection of its own and closes that connection
 * part way through: once rows are arriving (`'streaming'`), or as soon as the
 * request has been sent (`'querying'`).
 */
async function shutdownDuringQuery(
  env: TestEnv,
  adhoc: boolean,
  shutdownOn: 'streaming' | 'querying'
): Promise<{ rows: number; error: unknown }> {
  const cluster = await env.openCluster()
  let rows = 0
  let error: unknown = null
  let signalStreaming: () => void = () => {}
  const streaming = new Promise<void>((resolve) => (signalStreaming = resolve))

  const ended = new Promise<void>((resolve) => {
    cluster
      .query(STREAMING_STATEMENT, { adhoc })
      .on('row', () => {
        if (rows++ === 0) {
          signalStreaming()
        }
      })
      .on('error', (err: unknown) => (error = err))
      .on('end', () => resolve())
  })

  if (shutdownOn === 'streaming') {
    // A query that ends before its first row never streams, so the wait also
    // ends there and the test reports what the query did instead of timing out.
    await Promise.race([streaming, ended])
  } else {
    await new Promise((resolve) => setImmediate(resolve))
  }
  await cluster.close()
  await ended

  return { rows, error }
}

/** Every event a query emits, in order, with errors recorded as themselves. */
function collectEvents(
  query: StreamableRowPromise<QueryResult, unknown, QueryMetaData>,
  onRow?: (row: unknown) => void
): Promise<StreamEvent[]> {
  return new Promise((resolve) => {
    const events: StreamEvent[] = []
    query
      .on('row', (row: unknown) => {
        events.push('row')
        if (onRow) {
          onRow(row)
        }
      })
      .on('error', (err: Error) => events.push(err))
      .on('end', () => {
        events.push('end')
        // Give a duplicate terminal event the chance to show up.
        setTimeout(() => resolve(events), 100)
      })
  })
}

defineSuite('N1QL', { features: [ServerFeature.Query] }, ({ test }) => {
  describe('#query - streaming', () => {
    test(
      'should cancel a streaming adhoc query when the cluster is closed',
      { timeout: STREAMING_TIMEOUT_MS },
      async ({ env }) => {
        const res = await shutdownDuringQuery(env, true, 'streaming')
        expect(res.error).toBeInstanceOf(RequestCanceledError)
        expect(res.rows).toBeGreaterThan(0)
        expect(res.rows).toBeLessThan(STREAMING_ROW_COUNT)
      }
    )

    // close() can cancel an in-flight prepared query or let it finish on a new
    // connection. Once the core includes CXXCBC-1032 it always cancels, and
    // the completed branch can go.
    test(
      'should end an in-flight prepared query when the cluster is closed',
      { timeout: STREAMING_TIMEOUT_MS },
      async ({ env }) => {
        const res = await shutdownDuringQuery(env, false, 'querying')
        if (res.error === null) {
          expect(res.rows).toBe(STREAMING_ROW_COUNT)
        } else {
          expect(res.error).toBeInstanceOf(RequestCanceledError)
          expect(res.rows).toBe(0)
        }
      }
    )

    for (const adhoc of [true, false]) {
      test(`should reject an unserializable parameter (adhoc: ${adhoc})`, async ({
        cluster,
      }) => {
        let res: Promise<QueryResult> | undefined
        expect(() => {
          res = cluster.query('SELECT $1', { parameters: [1n], adhoc })
        }).not.toThrow()
        await expectThrows(async () => {
          await res
        }, TypeError)
      })

      test(`should emit an unserializable parameter as an error (adhoc: ${adhoc})`, async ({
        cluster,
      }) => {
        const events = await collectEvents(
          cluster.query('SELECT $1', { parameters: [1n], adhoc })
        )
        expect(events).toHaveLength(2)
        expect(events[0]).toBeInstanceOf(TypeError)
        expect(events[1]).toBe('end')
      })

      test(`should fail the query when a row listener throws (adhoc: ${adhoc})`, async ({
        cluster,
      }) => {
        const boom = new Error('boom')
        const events = await collectEvents(
          cluster.query('SELECT RAW i FROM ARRAY_RANGE(0, 10) AS i', {
            adhoc,
          }),
          () => {
            throw boom
          }
        )
        expect(events).toStrictEqual(['row', boom, 'end'])
      })
    }
  })
})

const SCOPE_BLOCK = 'query-scope-level'

defineSuite(
  'N1QL',
  {
    features: [ServerFeature.Collections, ServerFeature.Query],
    collection: CollectionStrategy.Named,
    docs: {},
    tier: 'slow',
  },
  ({ test }) => {
    describe('#query - scope level', () => {
      test(
        'should successfully create a primary index',
        { timeout: PRIMARY_CREATE_TIMEOUT_MS },
        async ({ cluster, collectionLease, env, signal }) => {
          await runCreatePrimaryIndex(
            env,
            cluster,
            collectionLease,
            scopeTarget,
            SCOPE_BLOCK,
            signal
          )
        }
      )

      test('should fail to create a duplicate primary index', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        await runDuplicatePrimaryIndex(
          env,
          cluster,
          collectionLease,
          scopeTarget,
          SCOPE_BLOCK
        )
      })

      test('should successfully create a secondary index (using a new connection)', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        await runCreateSecondaryIndex(
          env,
          cluster,
          collectionLease,
          scopeTarget,
          SCOPE_BLOCK
        )
      })

      test('should fail to create a duplicate secondary index', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        await runDuplicateSecondaryIndex(
          env,
          cluster,
          collectionLease,
          scopeTarget,
          SCOPE_BLOCK
        )
      })

      test('should successfully get all indexes', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        await runGetAllIndexes(env, cluster, collectionLease, scopeTarget)
      })

      test('should see test data correctly', async ({
        cluster,
        collectionLease,
        docs,
        env,
        signal,
      }) => {
        await runSeeTestData(
          env,
          cluster,
          collectionLease,
          docs,
          scopeTarget,
          signal
        )
      })

      test('should see test data correctly with a new connection', async ({
        collectionLease,
        docs,
        env,
        signal,
      }) => {
        await runSeeTestDataOnNewConnection(
          env,
          collectionLease,
          docs,
          scopeTarget,
          signal
        )
      })

      test('should stream test data correctly', async ({
        cluster,
        collectionLease,
        docs,
        env,
        signal,
      }) => {
        await runStreamTestData(
          env,
          cluster,
          collectionLease,
          docs,
          scopeTarget,
          signal
        )
      })

      test('should work with parameters correctly', async ({
        cluster,
        collectionLease,
        docs,
        env,
        signal,
      }) => {
        await runPositionalParameters(
          env,
          cluster,
          collectionLease,
          docs,
          scopeTarget,
          signal
        )
      })

      test('should work with named parameters correctly', async ({
        cluster,
        collectionLease,
        docs,
        env,
        signal,
      }) => {
        await runNamedParameters(
          env,
          cluster,
          collectionLease,
          docs,
          scopeTarget,
          signal
        )
      })

      test('should filter undefined named parameters', async ({
        cluster,
        collectionLease,
        docs,
        env,
        signal,
      }) => {
        await runFilteredNamedParameters(
          env,
          cluster,
          collectionLease,
          docs,
          scopeTarget,
          signal
        )
      })

      test('should work with lots of options specified', async ({
        cluster,
        collectionLease,
        docs,
        env,
        signal,
      }) => {
        await runLotsOfOptions(
          env,
          cluster,
          collectionLease,
          docs,
          scopeTarget,
          signal
        )
      })

      test('should wait till all indexes are online', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        await runWatchIndexes(
          env,
          cluster,
          collectionLease,
          scopeTarget,
          SCOPE_BLOCK
        )
      })

      test('should fail watching when some indexes are missing', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        await runWatchMissingIndex(env, cluster, collectionLease, scopeTarget)
      })

      test('should successfully drop a secondary index', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        await runDropSecondaryIndex(
          env,
          cluster,
          collectionLease,
          scopeTarget,
          SCOPE_BLOCK
        )
      })

      test('should fail to drop a missing secondary index', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        await runDropMissingSecondaryIndex(
          env,
          cluster,
          collectionLease,
          scopeTarget,
          SCOPE_BLOCK
        )
      })

      test('should successfully drop a primary index', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        await runDropPrimaryIndex(
          env,
          cluster,
          collectionLease,
          scopeTarget,
          SCOPE_BLOCK
        )
      })

      test('should fail to drop a missing primary index', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        await runDropMissingPrimaryIndex(
          env,
          cluster,
          collectionLease,
          scopeTarget,
          SCOPE_BLOCK
        )
      })

      describe('#deferred', () => {
        test(
          'should build deferred indexes',
          { retry: 3, timeout: DEFERRED_BUILD_TIMEOUT_MS },
          async ({ cluster, collectionLease, env, signal }) => {
            await runBuildDeferredIndexes(
              env,
              cluster,
              collectionLease,
              scopeTarget,
              SCOPE_BLOCK,
              signal
            )
          }
        )
      })
    })
  }
)

// `#CollectionQueryIndexManagement` needs the query service and collections,
// so `group()` gates it. The argument-validation block sits outside that gate:
// the manager rejects every one of its calls before a request is made.

defineSuite(
  '#CollectionQueryIndexManager',
  { collection: CollectionStrategy.Both, tier: 'slow' },
  ({ test, group }) => {
    group(
      '#CollectionQueryIndexManagement',
      [ServerFeature.Query, ServerFeature.Collections],
      () => {
        test(
          'should successfully create a primary index',
          { timeout: PRIMARY_CREATE_TIMEOUT_MS },
          async ({ collectionLease, env, signal }) => {
            await runCollectionCreatePrimaryIndex(env, collectionLease, signal)
          }
        )

        test('should successfully create a secondary index', async ({
          collectionLease,
          env,
        }) => {
          await runCollectionCreateSecondaryIndex(env, collectionLease)
        })

        test('should fail to create a duplicate secondary index', async ({
          collectionLease,
          env,
        }) => {
          await runCollectionDuplicateSecondaryIndex(env, collectionLease)
        })

        test('should successfully get all indexes', async ({
          collectionLease,
          env,
        }) => {
          await runCollectionGetAllIndexes(env, collectionLease)
        })

        test('should wait till all indexes are online', async ({
          collectionLease,
          env,
        }) => {
          await runCollectionWatchIndexes(env, collectionLease)
        })

        test('should fail watching when some indexes are missing', async ({
          collectionLease,
          env,
        }) => {
          await runCollectionWatchMissingIndex(env, collectionLease)
        })

        test('should successfully drop a secondary index', async ({
          collectionLease,
          env,
        }) => {
          await runCollectionDropSecondaryIndex(env, collectionLease)
        })

        test('should fail to drop a missing secondary index', async ({
          collectionLease,
          env,
        }) => {
          await runCollectionDropMissingSecondaryIndex(env, collectionLease)
        })

        test('should successfully drop a primary index', async ({
          collectionLease,
          env,
        }) => {
          await runCollectionDropPrimaryIndex(env, collectionLease)
        })

        test('should fail to drop a missing primary index', async ({
          collectionLease,
          env,
        }) => {
          await runCollectionDropMissingPrimaryIndex(env, collectionLease)
        })

        describe('#deferred', () => {
          test(
            'should build deferred indexes',
            { retry: 3, timeout: DEFERRED_BUILD_TIMEOUT_MS },
            async ({ collectionLease, env, signal }) => {
              await runCollectionBuildDeferredIndexes(
                env,
                collectionLease,
                signal
              )
            }
          )
        })
      }
    )

    describe('#CollectionQueryIndexManagement - invalid argument validation', () => {
      test('should throw InvalidArgumentError when scopeName is provided in options', async ({
        collectionLease,
        env,
      }) => {
        await runRejectsScopeNameOption(env, collectionLease)
      })

      test('should throw InvalidArgumentError when collectionName is provided in options', async ({
        collectionLease,
        env,
      }) => {
        await runRejectsCollectionNameOption(env, collectionLease)
      })
    })
  }
)
