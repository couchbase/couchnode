// An index is not usable when the management API says it exists: a query
// index is `deferred` or `building` before `online`. Each lease waits on the
// readiness signal its own service publishes.

import type { Collection } from '../../../../lib/collection'
import {
  IndexExistsError,
  IndexNotFoundError,
  InternalServerFailureError,
} from '../../../../lib/errors'
import type {
  ISearchIndex,
  SearchIndex,
} from '../../../../lib/searchindexmanager'
import { pollUntil, sleep } from '../retry'
import type { LeaseHost } from './host'

const CREATE_DEADLINE_MS = 120_000

const SEARCH_CREATE_ATTEMPTS = 3
const SEARCH_CREATE_DELAY_MS = 3_000

export interface IndexLeaseOptions {
  readonly signal?: AbortSignal
  /** How long to wait for the index to become usable, not merely present. */
  readonly deadlineMs?: number
}

/**
 * The calls a search index lease makes, typed structurally because the
 * `Cluster` and `Scope` search index managers are unrelated classes with the
 * same methods.
 */
export interface SearchIndexManagerLike {
  upsertIndex(definition: ISearchIndex): Promise<void>
  getIndex(name: string): Promise<SearchIndex>
  getAllIndexes(): Promise<SearchIndex[]>
  dropIndex(name: string): Promise<void>
  getIndexedDocumentsCount(name: string): Promise<number>
}

export interface SearchIndexLeaseOptions extends IndexLeaseOptions {
  /** Defaults to `host.cluster.searchIndexes()`. */
  readonly manager?: SearchIndexManagerLike
}

/** One shape, so a suite releases without knowing which kind it holds. */
export interface IndexLease {
  readonly name: string
  release(): Promise<void>
}

export class SearchIndexLease implements IndexLease {
  private released = false

  private constructor(
    readonly name: string,
    private readonly manager: SearchIndexManagerLike,
    private readonly signal?: AbortSignal
  ) {}

  /**
   * Upserts the definition and waits until it can be read back. Waiting for
   * documents to be indexed is the suite's job (`indexedDocumentCount`).
   */
  static async acquire(
    host: LeaseHost,
    definition: ISearchIndex,
    opts: SearchIndexLeaseOptions = {}
  ): Promise<SearchIndexLease> {
    const manager = opts.manager ?? host.cluster.searchIndexes()
    const lease = new SearchIndexLease(definition.name, manager, opts.signal)
    host.registerCleanup(() => lease.release())

    await upsertSearchIndex(manager, definition, opts.signal)

    await pollUntil<true>(
      `search index ${definition.name} to be readable`,
      async (ctx) => {
        try {
          await manager.getIndex(definition.name)
          return true
        } catch (err) {
          ctx.note(err instanceof Error ? err.message : String(err))
          return undefined
        }
      },
      {
        deadlineMs: opts.deadlineMs ?? CREATE_DEADLINE_MS,
        intervalMs: 500,
        signal: opts.signal,
      }
    )

    return lease
  }

  /** Documents the index has actually covered, for a suite that waits on it. */
  async indexedDocumentCount(): Promise<number> {
    return this.manager.getIndexedDocumentsCount(this.name)
  }

  async release(): Promise<void> {
    if (this.released) {
      return
    }
    this.released = true
    try {
      await this.manager.dropIndex(this.name)
    } catch (err) {
      if (!(err instanceof IndexNotFoundError)) {
        throw err
      }
    }
  }
}

/**
 * Creates a search index, retrying `InternalServerFailureError`: the search
 * service looks the bucket up through the cluster manager, which can answer
 * a transient 500. An exists error on a retry means the earlier attempt
 * landed.
 */
async function upsertSearchIndex(
  manager: SearchIndexManagerLike,
  definition: ISearchIndex,
  signal?: AbortSignal
): Promise<void> {
  for (let attempt = 1; ; ++attempt) {
    try {
      await manager.upsertIndex(definition)
      return
    } catch (err) {
      if (attempt > 1 && err instanceof IndexExistsError) {
        return
      }
      if (
        !(err instanceof InternalServerFailureError) ||
        attempt >= SEARCH_CREATE_ATTEMPTS
      ) {
        throw err
      }
    }
    await sleep(SEARCH_CREATE_DELAY_MS, signal)
  }
}

/**
 * GSI answers some drops with a 5000, "Fail to Drop Index due to internal
 * errors. Cleanup may happen in the background", and the index stays listed
 * until it does, so that answer means "not yet". A 5000 saying the index
 * "does not exist" is a drop that already happened, in a form the core does
 * not map to a missing index (CXXCBC-1059). Anything else is raised.
 */
const QUERY_DROP_DEADLINE_MS = 60_000
const QUERY_DROP_INTERVAL_MS = 2_000

export class QueryIndexLease implements IndexLease {
  private released = false

  private constructor(
    readonly name: string,
    private readonly collection: Collection,
    private readonly signal?: AbortSignal
  ) {}

  /**
   * Creates the index and waits until it is online, through the SDK's own
   * `watchIndexes` so a bug in it fails the tests rather than being routed
   * around.
   */
  static async acquire(
    host: LeaseHost,
    collection: Collection,
    indexName: string,
    keys: readonly string[],
    opts: IndexLeaseOptions = {}
  ): Promise<QueryIndexLease> {
    const lease = new QueryIndexLease(indexName, collection, opts.signal)
    host.registerCleanup(() => lease.release())

    const manager = collection.queryIndexes()
    try {
      await manager.createIndex(indexName, [...keys])
    } catch (err) {
      if (!(err instanceof IndexExistsError)) {
        throw err
      }
    }

    await manager.watchIndexes(
      [indexName],
      opts.deadlineMs ?? CREATE_DEADLINE_MS
    )
    return lease
  }

  async release(): Promise<void> {
    if (this.released) {
      return
    }
    this.released = true
    const manager = this.collection.queryIndexes()
    await pollUntil<true>(
      `query index ${this.name} to be dropped`,
      async (ctx) => {
        try {
          await manager.dropIndex(this.name)
          return true
        } catch (err) {
          if (err instanceof IndexNotFoundError) {
            return true
          }
          if (!(err instanceof InternalServerFailureError)) {
            throw err
          }
          const said = JSON.stringify(err.context ?? {})
          if (/does not exist/i.test(said)) {
            return true
          }
          if (!/Cleanup may happen in the background/i.test(said)) {
            throw err
          }
          ctx.note(`the index service said ${said}`)
          return undefined
        }
      },
      { deadlineMs: QUERY_DROP_DEADLINE_MS, intervalMs: QUERY_DROP_INTERVAL_MS }
    )
  }
}
