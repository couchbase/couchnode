import { expect } from 'vitest'

import type { AnalyticsMetaData } from '../../../../lib/analyticstypes'
import { AnalyticsStatus } from '../../../../lib/analyticstypes'
import type { Cluster } from '../../../../lib/cluster'
import {
  DatasetExistsError,
  DatasetNotFoundError,
  DataverseExistsError,
  DataverseNotFoundError,
  IndexExistsError,
  IndexNotFoundError,
} from '../../../../lib/errors'
import { AssertCtx, withCtx } from '../../asserts/ctx'
import { expectThrows } from '../../asserts/errors'
import { assertRowCount } from '../../asserts/rows'
import { ServerFeature } from '../../infra/capabilities'
import { DocBatch } from '../../infra/data/loader'
import { TestEnv } from '../../infra/env'
import { CollectionLease } from '../../infra/leases/collection-lease'
import { CollectionStrategy } from '../../infra/requirements'
import { pollUntil } from '../../infra/retry'
import { defineSuite } from '../../infra/suite'

// One ordered sequence: create a dataverse, dataset and index, connect the
// link, query, then drop all four and check each drop is idempotent and a
// second drop fails. Vitest runs a file's tests in declaration order.
//
// The dataverse drop is also registered with the env (`ignoreIfNotExists`), so
// a failure part way through leaves nothing for the next run to trip over.

const ANALYTICS_QUERY_DEADLINE_MS = 20_000

// Per-suite names, created on first use and memoized for the rest of the file.

interface AnalyticsNames {
  readonly dataverse: string
  readonly dataset: string
  readonly index: string
}

let names: AnalyticsNames | undefined

function namesFor(env: TestEnv, cluster: Cluster): AnalyticsNames {
  if (names) {
    return names
  }
  const created: AnalyticsNames = {
    dataverse: env.key(),
    dataset: env.key(),
    index: env.key(),
  }
  names = created

  // Registered before anything is created. Dropping the dataverse takes its
  // dataset and index with it.
  env.registerCleanup(async () => {
    await cluster
      .analyticsIndexes()
      .dropDataverse(created.dataverse, { ignoreIfNotExists: true })
  })

  return created
}

function target(created: AnalyticsNames): string {
  return `\`${created.dataverse}\`.\`${created.dataset}\``
}

/** The deprecated string form of a link name: `` `dataverse`.Local ``. */
function localLink(created: AnalyticsNames): string {
  return `\`${created.dataverse}\`.Local`
}

function analyticsCtx(
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

interface RowsAndMeta {
  readonly rows: readonly unknown[]
  readonly meta: AnalyticsMetaData
}

function assertQueryResult(
  res: RowsAndMeta,
  expected: number,
  c: AssertCtx = {}
): void {
  expect(
    Array.isArray(res.rows),
    withCtx('analytics query did not return an array of rows', c)
  ).toBe(true)
  assertRowCount(res.rows, expected, c)
  expect(
    res.meta,
    withCtx('analytics query returned no metadata', c)
  ).toBeTypeOf('object')
}

/**
 * Runs an analytics query until it returns what the test expects, or the
 * deadline passes. A new dataset is not queryable at once, and a connected one
 * has not yet ingested the bucket. The deadline message carries the last
 * observation, so slow ingestion and a broken query read differently.
 */
function analyticsUntilRows(
  run: () => Promise<RowsAndMeta>,
  expected: number,
  signal: AbortSignal
): Promise<RowsAndMeta> {
  return pollUntil<RowsAndMeta>(
    `the analytics service to return ${expected} row(s)`,
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
    { deadlineMs: ANALYTICS_QUERY_DEADLINE_MS, intervalMs: 100, signal }
  )
}

async function runSeeTestData(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  docs: DocBatch,
  signal: AbortSignal
): Promise<void> {
  const created = namesFor(env, cluster)
  const statement = `SELECT * FROM ${target(created)} WHERE testUid='${docs.uid}'`

  const res = await analyticsUntilRows(
    () => cluster.analyticsQuery(statement),
    docs.size,
    signal
  )
  assertQueryResult(
    res,
    docs.size,
    env.ctx(analyticsCtx(lease, 'analyticsQuery', statement))
  )
}

async function runPositionalParameters(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  docs: DocBatch,
  signal: AbortSignal
): Promise<void> {
  const created = namesFor(env, cluster)
  // `$2`, with a hole at `$1`: an undefined leading parameter does not
  // renumber the ones after it.
  const statement = `SELECT * FROM ${target(created)} WHERE testUid=$2`

  const res = await analyticsUntilRows(
    () =>
      cluster.analyticsQuery(statement, {
        parameters: [undefined, docs.uid],
      }),
    docs.size,
    signal
  )
  assertQueryResult(
    res,
    docs.size,
    env.ctx(analyticsCtx(lease, 'analyticsQuery', 'positional parameters'))
  )
}

async function runNamedParameters(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  docs: DocBatch,
  signal: AbortSignal
): Promise<void> {
  const created = namesFor(env, cluster)
  const statement = `SELECT * FROM ${target(created)} WHERE testUid=$tuid`

  const res = await analyticsUntilRows(
    () => cluster.analyticsQuery(statement, { parameters: { tuid: docs.uid } }),
    docs.size,
    signal
  )
  assertQueryResult(
    res,
    docs.size,
    env.ctx(analyticsCtx(lease, 'analyticsQuery', 'named parameters'))
  )
}

async function runFilteredNamedParameters(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  docs: DocBatch,
  signal: AbortSignal
): Promise<void> {
  const created = namesFor(env, cluster)
  const statement = `SELECT * FROM ${target(created)} WHERE testUid=$tuid`

  const res = await analyticsUntilRows(
    () =>
      cluster.analyticsQuery(statement, {
        parameters: { tuid: docs.uid, filterMe: undefined },
      }),
    docs.size,
    signal
  )
  assertQueryResult(
    res,
    docs.size,
    env.ctx(analyticsCtx(lease, 'analyticsQuery', 'undefined named parameter'))
  )
}

async function runLotsOfOptions(
  env: TestEnv,
  cluster: Cluster,
  lease: CollectionLease,
  docs: DocBatch,
  signal: AbortSignal
): Promise<void> {
  const created = namesFor(env, cluster)
  const statement = `SELECT * FROM ${target(created)} WHERE testUid='${docs.uid}'`

  const res = await analyticsUntilRows(
    () =>
      cluster.analyticsQuery(statement, {
        clientContextId: 'hello-world',
        readOnly: true,
      }),
    docs.size,
    signal
  )

  const c = env.ctx(analyticsCtx(lease, 'analyticsQuery', 'all options'))
  assertQueryResult(res, docs.size, c)

  const meta = res.meta
  expect(meta.requestId, withCtx('meta.requestId', c)).toBeTypeOf('string')
  expect(meta.clientContextId, withCtx('meta.clientContextId', c)).toEqual(
    'hello-world'
  )
  expect(meta.status, withCtx('meta.status', c)).toEqual(
    AnalyticsStatus.Success
  )
  expect(meta.signature, withCtx('meta.signature', c)).toBeTypeOf('object')
  expect(meta.metrics, withCtx('meta.metrics', c)).toBeTypeOf('object')
}

defineSuite(
  '#analytics',
  {
    features: [ServerFeature.Analytics],
    collection: CollectionStrategy.DefaultCollection,
    docs: {},
  },
  ({ test, lacking }) => {
    test('should successfully create a dataverse', async ({ cluster, env }) => {
      await cluster
        .analyticsIndexes()
        .createDataverse(namesFor(env, cluster).dataverse)
    })

    test('should successfully upsert a dataverse', async ({ cluster, env }) => {
      await cluster
        .analyticsIndexes()
        .createDataverse(namesFor(env, cluster).dataverse, {
          ignoreIfExists: true,
        })
    })

    test('should fail to overwrite an existing dataverse', async ({
      cluster,
      collectionLease,
      env,
    }) => {
      await expectThrows(
        () =>
          cluster
            .analyticsIndexes()
            .createDataverse(namesFor(env, cluster).dataverse),
        DataverseExistsError,
        undefined,
        env.ctx(analyticsCtx(collectionLease, 'createDataverse', 'duplicate'))
      )
    })

    test('should successfully create a dataset', async ({
      cluster,
      collectionLease,
      env,
    }) => {
      const created = namesFor(env, cluster)
      await cluster
        .analyticsIndexes()
        .createDataset(collectionLease.bucketName, created.dataset, {
          dataverseName: created.dataverse,
        })
    })

    test('should successfully upsert a dataset', async ({
      cluster,
      collectionLease,
      env,
    }) => {
      const created = namesFor(env, cluster)
      await cluster
        .analyticsIndexes()
        .createDataset(collectionLease.bucketName, created.dataset, {
          dataverseName: created.dataverse,
          ignoreIfExists: true,
        })
    })

    test('should fail to overwrite an existing dataset', async ({
      cluster,
      collectionLease,
      env,
    }) => {
      const created = namesFor(env, cluster)
      await expectThrows(
        () =>
          cluster
            .analyticsIndexes()
            .createDataset(collectionLease.bucketName, created.dataset, {
              dataverseName: created.dataverse,
            }),
        DatasetExistsError,
        undefined,
        env.ctx(analyticsCtx(collectionLease, 'createDataset', 'duplicate'))
      )
    })

    test('should successfully create an index', async ({ cluster, env }) => {
      const created = namesFor(env, cluster)
      await cluster
        .analyticsIndexes()
        .createIndex(
          created.dataset,
          created.index,
          { name: 'string' },
          { dataverseName: created.dataverse }
        )
    })

    test('should successfully upsert an index', async ({ cluster, env }) => {
      const created = namesFor(env, cluster)
      await cluster
        .analyticsIndexes()
        .createIndex(
          created.dataset,
          created.index,
          { name: 'string' },
          { dataverseName: created.dataverse, ignoreIfExists: true }
        )
    })

    test('should fail to overwrite an existing index', async ({
      cluster,
      collectionLease,
      env,
    }) => {
      const created = namesFor(env, cluster)
      await expectThrows(
        () =>
          cluster
            .analyticsIndexes()
            .createIndex(
              created.dataset,
              created.index,
              { name: 'string' },
              { dataverseName: created.dataverse }
            ),
        IndexExistsError,
        undefined,
        env.ctx(analyticsCtx(collectionLease, 'createIndex', 'duplicate'))
      )
    })

    // The string overload is deprecated in favor of the options one, and both
    // are tested because both still ship.
    test('should successfully connect a link via deprecated path', async ({
      cluster,
      env,
    }) => {
      await cluster
        .analyticsIndexes()
        .connectLink(localLink(namesFor(env, cluster)))
    })

    test('should successfully disconnect a link via deprecated path', async ({
      cluster,
      env,
    }) => {
      await cluster
        .analyticsIndexes()
        .disconnectLink(localLink(namesFor(env, cluster)))
    })

    test('should successfully connect a link', async ({ cluster, env }) => {
      await cluster
        .analyticsIndexes()
        .connectLink({ dataverseName: namesFor(env, cluster).dataverse })
    })

    test('should successfully list all datasets', async ({
      cluster,
      collectionLease,
      env,
    }) => {
      const datasets = await cluster.analyticsIndexes().getAllDatasets()
      expect(
        datasets.length,
        withCtx(
          'expected at least one dataset',
          env.ctx(analyticsCtx(collectionLease, 'getAllDatasets'))
        )
      ).toBeGreaterThanOrEqual(1)
    })

    test('should successfully list all indexes', async ({
      cluster,
      collectionLease,
      env,
    }) => {
      const indexes = await cluster.analyticsIndexes().getAllIndexes()
      expect(
        indexes.length,
        withCtx(
          'expected at least one index',
          env.ctx(analyticsCtx(collectionLease, 'getAllIndexes'))
        )
      ).toBeGreaterThanOrEqual(1)
    })

    test.skipIf(lacking(ServerFeature.AnalyticsPendingMutations))(
      'should successfully get pending mutations',
      async ({ cluster, collectionLease, env }) => {
        const pending = await cluster.analyticsIndexes().getPendingMutations()
        expect(
          pending,
          withCtx(
            'pending mutations',
            env.ctx(analyticsCtx(collectionLease, 'getPendingMutations'))
          )
        ).toBeTypeOf('object')
      }
    )

    test('should see test data correctly', async ({
      cluster,
      collectionLease,
      docs,
      env,
      signal,
    }) => {
      await runSeeTestData(env, cluster, collectionLease, docs, signal)
    })

    test('should work with parameters correctly', async ({
      cluster,
      collectionLease,
      docs,
      env,
      signal,
    }) => {
      await runPositionalParameters(env, cluster, collectionLease, docs, signal)
    })

    test('should work with named parameters correctly', async ({
      cluster,
      collectionLease,
      docs,
      env,
      signal,
    }) => {
      await runNamedParameters(env, cluster, collectionLease, docs, signal)
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
      await runLotsOfOptions(env, cluster, collectionLease, docs, signal)
    })

    test('should successfully disconnect a link', async ({ cluster, env }) => {
      await cluster
        .analyticsIndexes()
        .disconnectLink({ dataverseName: namesFor(env, cluster).dataverse })
    })

    test('should successfully drop an index', async ({ cluster, env }) => {
      const created = namesFor(env, cluster)
      await cluster
        .analyticsIndexes()
        .dropIndex(created.dataset, created.index, {
          dataverseName: created.dataverse,
        })
    })

    test('should successfully ignore a missing index when dropping', async ({
      cluster,
      env,
    }) => {
      const created = namesFor(env, cluster)
      await cluster
        .analyticsIndexes()
        .dropIndex(created.dataset, created.index, {
          dataverseName: created.dataverse,
          ignoreIfNotExists: true,
        })
    })

    test('should fail to drop a missing index', async ({
      cluster,
      collectionLease,
      env,
    }) => {
      const created = namesFor(env, cluster)
      // Regression guard (JSCBC-1467): asserts `IndexNotFoundError`, which the
      // core maps from the service's code 24047 on a drop.
      await expectThrows(
        () =>
          cluster.analyticsIndexes().dropIndex(created.dataset, created.index, {
            dataverseName: created.dataverse,
          }),
        IndexNotFoundError,
        undefined,
        env.ctx(analyticsCtx(collectionLease, 'dropIndex', 'already dropped'))
      )
    })

    test('should successfully drop a dataset', async ({ cluster, env }) => {
      const created = namesFor(env, cluster)
      await cluster.analyticsIndexes().dropDataset(created.dataset, {
        dataverseName: created.dataverse,
      })
    })

    test('should successfully ignore a missing dataset when dropping', async ({
      cluster,
      env,
    }) => {
      const created = namesFor(env, cluster)
      await cluster.analyticsIndexes().dropDataset(created.dataset, {
        dataverseName: created.dataverse,
        ignoreIfNotExists: true,
      })
    })

    test('should fail to drop a missing dataset', async ({
      cluster,
      collectionLease,
      env,
    }) => {
      const created = namesFor(env, cluster)
      await expectThrows(
        () =>
          cluster.analyticsIndexes().dropDataset(created.dataset, {
            dataverseName: created.dataverse,
          }),
        DatasetNotFoundError,
        undefined,
        env.ctx(analyticsCtx(collectionLease, 'dropDataset', 'already dropped'))
      )
    })

    test('should successfully drop a dataverse', async ({ cluster, env }) => {
      await cluster
        .analyticsIndexes()
        .dropDataverse(namesFor(env, cluster).dataverse)
    })

    test('should successfully ignore a missing dataverse when dropping', async ({
      cluster,
      env,
    }) => {
      await cluster
        .analyticsIndexes()
        .dropDataverse(namesFor(env, cluster).dataverse, {
          ignoreIfNotExists: true,
        })
    })

    test('should fail to drop a missing dataverse', async ({
      cluster,
      collectionLease,
      env,
    }) => {
      await expectThrows(
        () =>
          cluster
            .analyticsIndexes()
            .dropDataverse(namesFor(env, cluster).dataverse),
        DataverseNotFoundError,
        undefined,
        env.ctx(
          analyticsCtx(collectionLease, 'dropDataverse', 'already dropped')
        )
      )
    })
  }
)
