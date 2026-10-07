// Shared by `metricsmgmt.exclusive.test.ts` and
// `tracingmgmt.exclusive.test.ts`, which create and wait on the same resources
// and differ only in what they assert.

import {
  AnalyticsLinkType,
  IS3ExternalAnalyticsLink,
} from '../../../lib/analyticsindexmanager'
import { IndexNotFoundError } from '../../../lib/errors'
import type { CollectionQueryIndexManager } from '../../../lib/queryindexmanager'
import type {
  ISearchIndex,
  SearchIndexManager,
} from '../../../lib/searchindexmanager'
import type { ErrorClass } from '../asserts/errors'
import { TestEnv } from '../infra/env'
import type { CollectionLease } from '../infra/leases/collection-lease'
import { limits } from '../infra/limitations'
import { pollUntil, PollTimeoutError } from '../infra/retry'

export const RAM_QUOTA_MB = 256
export const DEFERRED_INDEX_COUNT = 3
export const WATCH_TIMEOUT_MS = 6_000
export const QUERY_INDEX_TIMEOUT_MS = 90_000
/**
 * The index service holds a refusal for several seconds before answering, so
 * this allows a few of them.
 */
export const QUERYABLE_DEADLINE_MS = 45_000
const READINESS_PROBE_INDEX = 'readiness_probe'
/**
 * How long a search index change may take to reach every search node. Older
 * clusters can take over half a minute to spread a new definition.
 */
export const SEARCH_SPREAD_DEADLINE_MS = 60_000
/** The search lifecycle test waits on `SEARCH_SPREAD_DEADLINE_MS` twice. */
export const SEARCH_LIFECYCLE_TIMEOUT_MS = 150_000
export const MISSING_BUCKET = 'invalid-bucket'
export const USER_PASSWORD = 's3cret!'
export const VIEW_MAP =
  'function(doc, meta) { if (doc.testUid) { emit(meta.id, null); } }'

/**
 * Registers a teardown drop of something the test is also expected to drop,
 * for the run that fails before getting there.
 *
 * `absent` is the error raised when it has already gone, the ordinary outcome.
 * Anything else is raised, so a drop that failed for a real reason is reported.
 *
 * The `absent` check is skipped on GoCAVES, which reports a missing scope in a
 * body that is not JSON, so the core raises `unsupported_operation` instead.
 * That throw lands outside any test and fails the whole file, so on that
 * backend teardown discards whatever comes back. This applies only to cleanup,
 * never to what a test accepts.
 */
export function dropOnTeardown(
  env: TestEnv,
  drop: () => Promise<unknown>,
  absent: ErrorClass<Error>
): void {
  const unclassifiable = limits(
    env.capabilities,
    'gocaves-scope-error-classification'
  )
  env.registerCleanup(async () => {
    try {
      await drop()
    } catch (err) {
      if (!unclassifiable && !(err instanceof absent)) {
        throw err
      }
    }
  })
}

/**
 * Resolves once the query and index services will both act on the leased
 * collection. A collection lease waits only for key-value, which answers
 * before either service has heard of the collection.
 *
 * The index service keeps its own copy of the manifest, so an index list can
 * answer while an index create straight after it is refused with "Scope Not
 * Found ... Possibly dropped, else please retry later". The probe is therefore
 * a deferred index create (nothing is built), retried through errors, and
 * dropped before returning so the caller's index counts are its own.
 */
export async function waitUntilQueryable(
  manager: CollectionQueryIndexManager,
  keyspace: string,
  signal: AbortSignal
): Promise<void> {
  await pollUntil(
    `the query service to answer for '${keyspace}'`,
    async () => {
      await manager.createIndex(READINESS_PROBE_INDEX, ['readiness'], {
        deferred: true,
        ignoreIfExists: true,
      })
      await manager.dropIndex(READINESS_PROBE_INDEX)
      return true
    },
    {
      deadlineMs: QUERYABLE_DEADLINE_MS,
      intervalMs: 500,
      retryErrors: true,
      signal,
    }
  )
}

/**
 * Resolves once a read of the search index agrees it exists, or is gone.
 *
 * A search index manager call returns once the node it reached has applied
 * it, so a read sent to another node can still answer as though it had not
 * happened. The reads run between measured steps, so none is recorded. On a
 * timeout the error also says whether `getAllIndexes()` lists the index, which
 * tells a slow spread from a change that never landed.
 */
export async function waitForSearchIndex(
  manager: SearchIndexManager,
  indexName: string,
  exists: boolean,
  signal: AbortSignal
): Promise<void> {
  try {
    await pollUntil(
      `search index '${indexName}' to be ${exists ? 'readable' : 'gone'}`,
      async (ctx) => {
        try {
          await manager.getIndex(indexName)
        } catch (err) {
          if (!(err instanceof IndexNotFoundError)) {
            throw err
          }
          ctx.note('a read answered not found')
          return exists ? undefined : true
        }
        ctx.note('a read found it')
        return exists ? true : undefined
      },
      { deadlineMs: SEARCH_SPREAD_DEADLINE_MS, intervalMs: 1000, signal }
    )
  } catch (err) {
    if (!(err instanceof PollTimeoutError)) {
      throw err
    }
    err.message = `${err.message}; ${await searchListing(manager, indexName)}`
    throw err
  }
}

async function searchListing(
  manager: SearchIndexManager,
  indexName: string
): Promise<string> {
  try {
    const all = await manager.getAllIndexes()
    return all.some((idx) => idx.name === indexName)
      ? 'getAllIndexes() lists it'
      : 'getAllIndexes() does not list it'
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err)
    return `getAllIndexes() failed too: ${why}`
  }
}

export function keyspaceOf(lease: CollectionLease): string {
  return `${lease.bucketName}.${lease.scopeName}.${lease.collectionName}`
}

export function s3Link(
  name: string,
  dataverse: string,
  region: string
): IS3ExternalAnalyticsLink {
  return {
    linkType: AnalyticsLinkType.S3External,
    name,
    dataverse,
    accessKeyId: 'accesskey',
    region,
    secretAccessKey: 'supersecretkey',
  }
}

export function searchIndexDefinition(
  name: string,
  bucket: string
): ISearchIndex {
  return {
    name,
    sourceName: bucket,
    sourceType: 'couchbase',
    type: 'fulltext-index',
    params: {},
    sourceUuid: '',
    sourceParams: {},
    planParams: {},
  }
}
