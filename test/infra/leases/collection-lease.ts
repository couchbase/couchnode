// A new collection is empty by construction, which is how a suite gets a clean
// slate without flushing the shared bucket.
//
// - `DefaultCollection` provisions nothing; suites isolate by key prefix.
// - `Named` is a new scope and collection, empty because the name is new.
// - `CleanDefault` leases a whole bucket for an empty `_default._default`.
//
// Names are minted per acquisition (see `newLeaseNames`), so workers and files
// sharing a suite name never collide.

import type { Cluster } from '../../../lib/cluster'
import type { Collection } from '../../../lib/collection'
import type { CollectionManager } from '../../../lib/collectionmanager'
import {
  CollectionExistsError,
  ScopeExistsError,
  ScopeNotFoundError,
} from '../../../lib/errors'
import { ServerFeature } from '../capabilities'
import { leaseStampMs, newLeaseNames } from '../naming'
import { CollectionStrategy } from '../requirements'
import type { ResolvedRequirements } from '../requirements'
import { recordProvisioning } from '../runlog'
import { BucketLease } from './bucket-lease'
import type { LeaseHost } from './host'
import { awaitKeyValueReady } from './readiness'

const DEFAULT_SCOPE = '_default'
const DEFAULT_COLLECTION = '_default'

const CREATE_DEADLINE_MS = 30_000
const DROP_DEADLINE_MS = 30_000

/**
 * How old a lease's scope must be before a later acquisition drops it as
 * abandoned: far longer than any file holds a lease, short enough that a dead
 * run's scopes are gone by the next nightly.
 */
const STALE_AFTER_MS = 6 * 60 * 60 * 1000

export interface CollectionLeaseOptions {
  /**
   * The connection the returned handle is bound to. Management calls always go
   * over the host's connection.
   */
  readonly cluster?: Cluster
  readonly signal?: AbortSignal
}

/**
 * Reported, because `bucket-fallback` is not what the suite asked for.
 */
export type LeaseRoute =
  | 'default-collection'
  | 'collection'
  | 'clean-default-bucket'
  | 'bucket-fallback'

export class CollectionLease {
  private released = false

  private constructor(
    readonly route: LeaseRoute,
    readonly bucketName: string,
    readonly scopeName: string,
    readonly collectionName: string,
    readonly collection: Collection,
    private readonly releaseImpl: () => Promise<void>
  ) {}

  /** `_default._default`, or any collection this lease did not create. */
  static existing(
    bucketName: string,
    scopeName: string,
    collectionName: string,
    collection: Collection
  ): CollectionLease {
    return new CollectionLease(
      'default-collection',
      bucketName,
      scopeName,
      collectionName,
      collection,
      async () => undefined
    )
  }

  static provisioned(
    bucketName: string,
    scopeName: string,
    collectionName: string,
    collection: Collection,
    release: () => Promise<void>
  ): CollectionLease {
    return new CollectionLease(
      'collection',
      bucketName,
      scopeName,
      collectionName,
      collection,
      release
    )
  }

  /**
   * A whole bucket standing in for a collection on a server without
   * collections. It reports the default scope and collection, the only place
   * documents can live there.
   */
  static fromBucket(lease: BucketLease): CollectionLease {
    return new CollectionLease(
      'bucket-fallback',
      lease.bucketName,
      DEFAULT_SCOPE,
      DEFAULT_COLLECTION,
      lease.defaultCollection,
      () => lease.release()
    )
  }

  /**
   * For `CollectionStrategy.CleanDefault`. Structurally `fromBucket`, but a
   * different route: `bucket-fallback` is a coverage notice, and this is what
   * the suite asked for.
   */
  static cleanDefaultBucket(lease: BucketLease): CollectionLease {
    return new CollectionLease(
      'clean-default-bucket',
      lease.bucketName,
      DEFAULT_SCOPE,
      DEFAULT_COLLECTION,
      lease.defaultCollection,
      () => lease.release()
    )
  }

  async release(): Promise<void> {
    if (this.released) {
      return
    }
    this.released = true
    await this.releaseImpl()
  }
}

/**
 * Resolves a suite's declared strategy into an actual collection. The pre-7.0
 * substitution of a bucket for a collection happens here and only here, so
 * suites never see it.
 */
export async function acquireCollection(
  host: LeaseHost,
  requirements: ResolvedRequirements,
  opts: CollectionLeaseOptions = {}
): Promise<CollectionLease> {
  const cluster = opts.cluster ?? host.cluster
  const bucketName = host.config.bucket

  if (requirements.collection === CollectionStrategy.DefaultCollection) {
    const collection = cluster.bucket(bucketName).defaultCollection()
    // Nothing to provision, but the bucket opens lazily on the first
    // `cluster.bucket()`, and an operation issued before that finishes is never
    // dispatched: on a loaded agent the first `get` times out with no retries.
    // So wait for key-value, as the other routes do after provisioning.
    if (host.supports(ServerFeature.KeyValue)) {
      await awaitKeyValueReady(
        collection,
        `bucket ${bucketName} to answer key-value requests`,
        { deadlineMs: CREATE_DEADLINE_MS, signal: opts.signal }
      )
    }
    return CollectionLease.existing(
      bucketName,
      DEFAULT_SCOPE,
      DEFAULT_COLLECTION,
      collection
    )
  }

  // Before the collections check: this route works the same without them.
  if (requirements.collection === CollectionStrategy.CleanDefault) {
    return cleanDefaultBucket(host, requirements, opts)
  }

  if (!host.supports(ServerFeature.Collections)) {
    return bucketFallback(host, requirements, opts)
  }

  return provision(host, cluster, bucketName, opts)
}

/**
 * A bucket of this suite's own, used for its default collection. `clean`,
 * because a leftover bucket from a dead run would not be empty. No provisioning
 * notice: this is the route the suite asked for.
 */
async function cleanDefaultBucket(
  host: LeaseHost,
  requirements: ResolvedRequirements,
  opts: CollectionLeaseOptions
): Promise<CollectionLease> {
  const bucket = await BucketLease.acquire(host, requirements.suiteName, {
    clean: true,
    signal: opts.signal,
  })
  return CollectionLease.cleanDefaultBucket(bucket)
}

async function bucketFallback(
  host: LeaseHost,
  requirements: ResolvedRequirements,
  opts: CollectionLeaseOptions
): Promise<CollectionLease> {
  // `clean`, because `Named` promises an empty collection. Without it a
  // leftover bucket from a run that died before releasing is reused, with
  // that run's documents in it.
  const bucket = await BucketLease.acquire(host, requirements.suiteName, {
    clean: true,
    signal: opts.signal,
  })

  // Logged, never silent: a green run here has not exercised collections.
  recordProvisioning(host.runLog, {
    suite: requirements.suiteName,
    kind: 'bucket-fallback',
    reason:
      `Strategy '${requirements.collection}' needs collections, which this ` +
      'server does not have. A dedicated bucket was leased instead: it is ' +
      'guaranteed empty, but collections go unexercised.',
  })

  return CollectionLease.fromBucket(bucket)
}

async function provision(
  host: LeaseHost,
  cluster: Cluster,
  bucketName: string,
  opts: CollectionLeaseOptions
): Promise<CollectionLease> {
  const { scope: scopeName, collection: collectionName } = newLeaseNames()
  const manager = host.cluster.bucket(bucketName).collections()
  const waitOpts = { deadlineMs: CREATE_DEADLINE_MS, signal: opts.signal }

  await sweepStaleScopes(manager)

  const release = async () => {
    // Checked first rather than inferred from the drop's error: GoCAVES's
    // scope-not-found body is malformed JSON, so the core reports
    // `unsupported_operation`. The catch stays because another run's sweep can
    // drop the scope between the read and the drop.
    const existing = await manager.getAllScopes()
    if (!existing.some((scope) => scope.name === scopeName)) {
      return
    }
    try {
      await manager.dropScope(scopeName)
    } catch (err) {
      if (!(err instanceof ScopeNotFoundError)) {
        throw err
      }
      return
    }
    await host.protocol.waitUntilScopeDropped(bucketName, scopeName, {
      deadlineMs: DROP_DEADLINE_MS,
      signal: opts.signal,
    })
  }

  const collection = cluster
    .bucket(bucketName)
    .scope(scopeName)
    .collection(collectionName)

  const lease = CollectionLease.provisioned(
    bucketName,
    scopeName,
    collectionName,
    collection,
    release
  )
  // Registered before the first management call, not after the last: a create
  // that half-succeeded still leaves a scope to drop.
  host.registerCleanup(() => lease.release())

  // Nothing to drop first: the name is new. An exists error can only be this
  // create's own retry answering, and is success.
  try {
    await manager.createScope(scopeName)
  } catch (err) {
    if (!(err instanceof ScopeExistsError)) {
      throw err
    }
  }
  await host.protocol.waitUntilScopePresent(bucketName, scopeName, waitOpts)

  try {
    await manager.createCollection(collectionName, scopeName)
  } catch (err) {
    if (!(err instanceof CollectionExistsError)) {
      throw err
    }
  }
  await host.protocol.waitUntilCollectionPresent(
    bucketName,
    scopeName,
    collectionName,
    waitOpts
  )

  await awaitKeyValueReady(
    collection,
    `collection ${scopeName}.${collectionName} on ${bucketName} to answer ` +
      'key-value requests',
    waitOpts
  )

  return lease
}

/**
 * Drops the scopes leases minted more than `STALE_AFTER_MS` ago, which only a
 * dead process leaves behind. Scopes this tree did not name are never touched:
 * `leaseStampMs` answers null for them.
 */
async function sweepStaleScopes(manager: CollectionManager): Promise<void> {
  const cutoff = Date.now() - STALE_AFTER_MS
  const stale = (await manager.getAllScopes()).filter((scope) => {
    const minted = leaseStampMs(scope.name)
    return minted !== null && minted < cutoff
  })
  for (const scope of stale) {
    try {
      await manager.dropScope(scope.name)
    } catch (err) {
      // Another worker's sweep reached it first.
      if (!(err instanceof ScopeNotFoundError)) {
        throw err
      }
    }
  }
}
