// Release is registered with the env on acquire, not in an `after` hook, so it
// runs on the failure path too and no bucket is left for later runs.
//
// A presence check and a `getBucket` can both succeed while KV still answers
// with "no such bucket", so readiness here is settled by `awaitKeyValueReady`,
// which asks KV.

import type { Bucket } from '../../../../lib/bucket'
import type { Collection } from '../../../../lib/collection'
import { BucketExistsError, BucketNotFoundError } from '../../../../lib/errors'
import { StorageBackend } from '../../../../lib/bucketmanager'
import { assertLegalName, resourceName } from '../naming'
import { awaitKeyValueReady } from './readiness'
import type { LeaseHost } from './host'

/** Small enough to be cheap, large enough for a bucket to warm up. */
const DEFAULT_QUOTA_MB = 100

const CREATE_DEADLINE_MS = 60_000
const DROP_DEADLINE_MS = 30_000

export interface BucketLeaseOptions {
  /** Defaults to a hash of (suite, worker). Supply one only to test naming. */
  readonly name?: string
  readonly ramQuotaMB?: number
  readonly flushEnabled?: boolean
  readonly storageBackend?: StorageBackend
  readonly numReplicas?: number
  /**
   * Drop any bucket of this name before creating, so the caller gets an empty
   * one. Off by default, because a leftover from a dead run is ours to reuse.
   */
  readonly clean?: boolean
  readonly signal?: AbortSignal
}

export class BucketLease {
  private released = false

  private constructor(
    readonly bucketName: string,
    private readonly host: LeaseHost,
    private readonly signal?: AbortSignal
  ) {}

  static async acquire(
    host: LeaseHost,
    suite: string,
    opts: BucketLeaseOptions = {}
  ): Promise<BucketLease> {
    const bucketName = opts.name
      ? assertLegalName('bucket', opts.name)
      : resourceName('bucket', suite)

    const lease = new BucketLease(bucketName, host, opts.signal)
    // Registered before the first management call, not after the last: a
    // create that half-succeeded still leaves something to drop.
    host.registerCleanup(() => lease.release())

    const manager = host.cluster.buckets()

    if (opts.clean) {
      // `dropIfPresent`, not `lease.release()`: the latter would latch the
      // lease as released and turn the real teardown into a no-op, leaking the
      // bucket this call is about to create.
      await lease.dropIfPresent()
    }

    try {
      await manager.createBucket({
        name: bucketName,
        ramQuotaMB: opts.ramQuotaMB ?? DEFAULT_QUOTA_MB,
        flushEnabled: opts.flushEnabled ?? false,
        numReplicas: opts.numReplicas ?? 0,
        storageBackend: opts.storageBackend ?? StorageBackend.Couchstore,
      })
    } catch (err) {
      // A leftover from a run that died before its release is ours to reuse.
      // A caller needing it empty passed `clean`, which dropped it above.
      if (!(err instanceof BucketExistsError)) {
        throw err
      }
    }

    await host.protocol.waitUntilBucketPresent(bucketName, {
      deadlineMs: CREATE_DEADLINE_MS,
      signal: opts.signal,
    })
    await awaitKeyValueReady(
      host.cluster.bucket(bucketName).defaultCollection(),
      `bucket ${bucketName} to answer key-value requests`,
      { deadlineMs: CREATE_DEADLINE_MS, signal: opts.signal }
    )

    return lease
  }

  get bucket(): Bucket {
    return this.host.cluster.bucket(this.bucketName)
  }

  get defaultCollection(): Collection {
    return this.bucket.defaultCollection()
  }

  async release(): Promise<void> {
    if (this.released) {
      return
    }
    this.released = true
    await this.dropIfPresent()
  }

  /**
   * Separate from `release` because the clean-acquisition path drops before
   * creating, and must not mark the lease released while doing so.
   */
  private async dropIfPresent(): Promise<void> {
    try {
      await this.host.cluster.buckets().dropBucket(this.bucketName)
    } catch (err) {
      if (!(err instanceof BucketNotFoundError)) {
        throw err
      }
      return
    }

    await this.host.protocol.waitUntilBucketDropped(this.bucketName, {
      deadlineMs: DROP_DEADLINE_MS,
      signal: this.signal,
    })
  }
}
