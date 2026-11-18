import * as grpc from '@grpc/grpc-js'
import { describe, expect, it } from 'vitest'

import {
  BucketType,
  CompressionMode,
  ConflictResolutionType,
  EvictionPolicy,
  StorageBackend,
} from '../../../../lib/bucketmanager'
import {
  bucketSettingsFromProto,
  Couchbase2Buckets,
  createBucketRequestToProto,
  updateBucketRequestToProto,
} from '../../../../lib/couchbase2/buckets'
import type { BucketAdminServiceClient } from '../../../../lib/couchbase2/generated/couchbase/admin/bucket/v1/BucketAdminService'
import type { _couchbase_admin_bucket_v1_ListBucketsResponse_Bucket__Output as ListedBucketPb } from '../../../../lib/couchbase2/generated/couchbase/admin/bucket/v1/ListBucketsResponse'
import {
  Couchbase2Op,
  RequestContext,
} from '../../../../lib/couchbase2/requestcontext'
import {
  BucketNotFoundError,
  FeatureNotAvailableError,
  InvalidArgumentError,
  UnambiguousTimeoutError,
} from '../../../../lib/errors'
import { DurabilityLevel } from '../../../../lib/generaltypes'

// The bucket management requests and results, mapped without a gateway.

const LISTED: ListedBucketPb = {
  bucket_name: 'b',
  flush_enabled: true,
  ram_quota_mb: '256',
  num_replicas: 1,
  replica_indexes: false,
  bucket_type: 'BUCKET_TYPE_COUCHBASE',
  eviction_mode: 'EVICTION_MODE_VALUE_ONLY',
  max_expiry_secs: 60,
  compression_mode: 'COMPRESSION_MODE_PASSIVE',
  minimum_durability_level: 'DURABILITY_LEVEL_MAJORITY',
  storage_backend: 'STORAGE_BACKEND_MAGMA',
  conflict_resolution_type: 'CONFLICT_RESOLUTION_TYPE_SEQUENCE_NUMBER',
  history_retention_collection_default: true,
  history_retention_bytes: '2147483648',
  history_retention_duration_secs: 600,
}

describe('#couchbase2 buckets create request', () => {
  it('should give a bucket created without a RAM quota 100 MiB', () => {
    expect(createBucketRequestToProto({ name: 'b', ramQuotaMB: 0 })).toEqual({
      bucket_name: 'b',
      ram_quota_mb: 100,
    })
  })

  it('should send every setting', () => {
    expect(
      createBucketRequestToProto({
        name: 'b',
        ramQuotaMB: 256,
        numReplicas: 2,
        flushEnabled: true,
        replicaIndexes: true,
        bucketType: BucketType.Ephemeral,
        storageBackend: StorageBackend.Couchstore,
        evictionPolicy: EvictionPolicy.NotRecentlyUsed,
        maxExpiry: 30,
        compressionMode: CompressionMode.Active,
        minimumDurabilityLevel: DurabilityLevel.PersistToMajority,
        conflictResolutionType: ConflictResolutionType.Timestamp,
        historyRetentionCollectionDefault: false,
        historyRetentionBytes: 1024,
        historyRetentionDuration: 120,
      })
    ).toEqual({
      bucket_name: 'b',
      ram_quota_mb: 256,
      num_replicas: 2,
      flush_enabled: true,
      replica_indexes: true,
      bucket_type: 'BUCKET_TYPE_EPHEMERAL',
      storage_backend: 'STORAGE_BACKEND_COUCHSTORE',
      eviction_mode: 'EVICTION_MODE_NOT_RECENTLY_USED',
      max_expiry_secs: 30,
      compression_mode: 'COMPRESSION_MODE_ACTIVE',
      minimum_durability_level: 'DURABILITY_LEVEL_PERSIST_TO_MAJORITY',
      conflict_resolution_type: 'CONFLICT_RESOLUTION_TYPE_TIMESTAMP',
      history_retention_collection_default: false,
      history_retention_bytes: 1024,
      history_retention_duration_secs: 120,
    })
  })

  it('should leave out a minimum durability level of none', () => {
    const message = createBucketRequestToProto({
      name: 'b',
      ramQuotaMB: 100,
      minimumDurabilityLevel: DurabilityLevel.None,
    })
    expect(message.minimum_durability_level).toBeUndefined()
  })

  it('should take the deprecated settings as a classic connection does', () => {
    const message = createBucketRequestToProto({
      name: 'b',
      ramQuotaMB: 100,
      maxTTL: 45,
      durabilityMinLevel: 'majorityAndPersistActive',
      minimumDurabilityLevel: DurabilityLevel.Majority,
    })
    expect(message.max_expiry_secs).toBe(45)
    expect(message.minimum_durability_level).toBe(
      'DURABILITY_LEVEL_MAJORITY_AND_PERSIST_TO_ACTIVE'
    )
  })

  it('should refuse a memcached bucket as not supported', () => {
    expect(() =>
      createBucketRequestToProto({
        name: 'b',
        ramQuotaMB: 100,
        bucketType: BucketType.Memcached,
      })
    ).toThrow(FeatureNotAvailableError)
  })

  it('should refuse a number of vBuckets as not supported', () => {
    expect(() =>
      createBucketRequestToProto({
        name: 'b',
        ramQuotaMB: 100,
        numVBuckets: 128,
      })
    ).toThrow(FeatureNotAvailableError)
  })

  it.each([
    ['bucket type', { bucketType: 'couchbase' }],
    ['eviction policy', { evictionPolicy: 'full' }],
    ['compression mode', { compressionMode: 'on' }],
    ['storage backend', { storageBackend: 'rocksdb' }],
    ['conflict resolution type', { conflictResolutionType: 'lamport' }],
  ])('should refuse an unknown %s', (_name, setting) => {
    expect(() =>
      createBucketRequestToProto({ name: 'b', ramQuotaMB: 100, ...setting })
    ).toThrow(InvalidArgumentError)
  })
})

describe('#couchbase2 buckets update request', () => {
  it('should leave out the settings that were not given', () => {
    expect(updateBucketRequestToProto({ name: 'b' })).toEqual({
      bucket_name: 'b',
    })
  })

  it('should leave out the settings fixed when the bucket was created', () => {
    const message = updateBucketRequestToProto({
      name: 'b',
      ramQuotaMB: 512,
      bucketType: BucketType.Couchbase,
      storageBackend: StorageBackend.Magma,
      replicaIndexes: true,
      numVBuckets: 128,
    })
    expect(message).toEqual({ bucket_name: 'b', ram_quota_mb: 512 })
  })

  it('should send back what the listing read, less the fixed settings', () => {
    expect(updateBucketRequestToProto(bucketSettingsFromProto(LISTED))).toEqual(
      {
        bucket_name: 'b',
        ram_quota_mb: 256,
        num_replicas: 1,
        flush_enabled: true,
        eviction_mode: 'EVICTION_MODE_VALUE_ONLY',
        max_expiry_secs: 60,
        compression_mode: 'COMPRESSION_MODE_PASSIVE',
        minimum_durability_level: 'DURABILITY_LEVEL_MAJORITY',
        history_retention_collection_default: true,
        history_retention_bytes: 2147483648,
        history_retention_duration_secs: 600,
      }
    )
  })
})

describe('#couchbase2 buckets listing', () => {
  it('should read each setting as the SDK spells it', () => {
    const settings = bucketSettingsFromProto(LISTED)
    expect(settings).toMatchObject({
      name: 'b',
      flushEnabled: true,
      ramQuotaMB: 256,
      numReplicas: 1,
      replicaIndexes: undefined,
      bucketType: BucketType.Couchbase,
      storageBackend: StorageBackend.Magma,
      evictionPolicy: EvictionPolicy.ValueOnly,
      maxExpiry: 60,
      compressionMode: CompressionMode.Passive,
      minimumDurabilityLevel: DurabilityLevel.Majority,
      historyRetentionCollectionDefault: true,
      historyRetentionBytes: 2147483648,
      historyRetentionDuration: 600,
      numVBuckets: undefined,
    })
  })

  it('should read the settings the gateway left out', () => {
    const settings = bucketSettingsFromProto({
      ...LISTED,
      minimum_durability_level: undefined,
      storage_backend: undefined,
      history_retention_collection_default: undefined,
      history_retention_bytes: undefined,
      history_retention_duration_secs: undefined,
    })
    expect(settings.minimumDurabilityLevel).toBe(DurabilityLevel.None)
    expect(settings.storageBackend).toBeUndefined()
    expect(settings.historyRetentionCollectionDefault).toBeUndefined()
    expect(settings.historyRetentionBytes).toBeUndefined()
    expect(settings.historyRetentionDuration).toBeUndefined()
  })

  it("should not read a couchstore bucket's history settings", () => {
    const settings = bucketSettingsFromProto({
      ...LISTED,
      storage_backend: 'STORAGE_BACKEND_COUCHSTORE',
      history_retention_collection_default: undefined,
      history_retention_bytes: '0',
      history_retention_duration_secs: 0,
    })
    expect(settings.historyRetentionCollectionDefault).toBeUndefined()
    expect(settings.historyRetentionBytes).toBeUndefined()
    expect(settings.historyRetentionDuration).toBeUndefined()
    const update = updateBucketRequestToProto(settings)
    expect(update).not.toHaveProperty('history_retention_bytes')
    expect(update).not.toHaveProperty('history_retention_duration_secs')
  })

  it("should read a couchstore bucket's replica indexes", () => {
    for (const replicaIndexes of [true, false]) {
      const settings = bucketSettingsFromProto({
        ...LISTED,
        storage_backend: 'STORAGE_BACKEND_COUCHSTORE',
        replica_indexes: replicaIndexes,
      })
      expect(settings.replicaIndexes).toBe(replicaIndexes)
    }
  })
})

describe('#couchbase2 buckets client', () => {
  const channel = {
    metadata: new grpc.Metadata(),
    context: (op: Couchbase2Op, timeoutMs: number) =>
      new RequestContext(op, timeoutMs),
  }
  const req = { timeout: 2500, obs: null }

  function answering(
    err: grpc.ServiceError | null,
    resp?: unknown
  ): BucketAdminServiceClient {
    const answer = (...args: unknown[]) => {
      const callback = args[args.length - 1] as grpc.requestCallback<unknown>
      callback(err, resp)
    }
    return {
      CreateBucket: answer,
      UpdateBucket: answer,
      ListBuckets: answer,
    } as unknown as BucketAdminServiceClient
  }

  function invalidArgument(details: string): grpc.ServiceError {
    return Object.assign(new Error(details), {
      code: grpc.status.INVALID_ARGUMENT,
      details,
      metadata: new grpc.Metadata(),
    })
  }

  it('should read one bucket from the listing', async () => {
    const buckets = new Couchbase2Buckets(
      channel,
      answering(null, { buckets: [{ ...LISTED, bucket_name: 'a' }, LISTED] })
    )
    const settings = await buckets.getBucket('b', req)
    expect(settings.name).toBe('b')
  })

  it('should raise BucketNotFoundError for a bucket missing from the listing', async () => {
    const buckets = new Couchbase2Buckets(
      channel,
      answering(null, { buckets: [LISTED] })
    )
    await expect(buckets.getBucket('missing', req)).rejects.toBeInstanceOf(
      BucketNotFoundError
    )
  })

  /**
   * A client that answers `ListBuckets` with `listed` and `UpdateBucket`
   * with nothing, and records the calls made.
   */
  function recording(listed: ListedBucketPb[]) {
    const calls: { method: string; message: unknown }[] = []
    const answer =
      (method: string, resp: unknown) =>
      (...args: unknown[]) => {
        calls.push({ method, message: args[0] })
        const callback = args[args.length - 1] as grpc.requestCallback<unknown>
        callback(null, resp)
      }
    const client = {
      ListBuckets: answer('ListBuckets', { buckets: listed }),
      UpdateBucket: answer('UpdateBucket', {}),
    } as unknown as BucketAdminServiceClient
    return { client, calls }
  }

  it.each([
    [
      'minimumDurabilityLevel',
      { minimumDurabilityLevel: DurabilityLevel.None },
    ],
    ['the deprecated durabilityMinLevel', { durabilityMinLevel: 'none' }],
  ])(
    'should refuse clearing a minimum durability level with %s',
    async (_name, durability) => {
      const { client, calls } = recording([
        { ...LISTED, bucket_name: 'a', minimum_durability_level: undefined },
        LISTED,
      ])
      const buckets = new Couchbase2Buckets(channel, client)
      await expect(
        buckets.updateBucket({ name: 'b', ...durability }, req)
      ).rejects.toBeInstanceOf(FeatureNotAvailableError)
      expect(calls.map((c) => c.method)).toEqual(['ListBuckets'])
    }
  )

  it.each([
    ['has none', [{ ...LISTED, minimum_durability_level: undefined }]],
    ['is not listed', [{ ...LISTED, bucket_name: 'a' }]],
  ])(
    'should update to no minimum durability level a bucket that %s',
    async (_name, listed) => {
      const { client, calls } = recording(listed)
      const buckets = new Couchbase2Buckets(channel, client)
      await buckets.updateBucket(
        { name: 'b', minimumDurabilityLevel: DurabilityLevel.None },
        req
      )
      expect(calls).toEqual([
        { method: 'ListBuckets', message: {} },
        { method: 'UpdateBucket', message: { bucket_name: 'b' } },
      ])
    }
  )

  it.each([
    ['no minimum durability level given', {}],
    [
      'a minimum durability level',
      { minimumDurabilityLevel: DurabilityLevel.Majority },
    ],
  ])('should not list the buckets for %s', async (_name, durability) => {
    const { client, calls } = recording([LISTED])
    const buckets = new Couchbase2Buckets(channel, client)
    await buckets.updateBucket({ name: 'b', ...durability }, req)
    expect(calls.map((c) => c.method)).toEqual(['UpdateBucket'])
  })

  /**
   * A channel on a fake clock that records each context it makes, and a
   * client whose `ListBuckets` takes `listMs` on that clock and then answers
   * with `listErr`, or with `LISTED` when it is null.
   */
  function timed(listMs: number, listErr: grpc.ServiceError | null) {
    let clock = 0
    const contexts: { op: string; timeoutMs: number }[] = []
    const timedChannel = {
      metadata: new grpc.Metadata(),
      context: (op: Couchbase2Op, timeoutMs: number) => {
        contexts.push({ op: op.name, timeoutMs })
        return new RequestContext(op, timeoutMs, { now: () => clock })
      },
    }
    const calls: string[] = []
    const client = {
      ListBuckets: (...args: unknown[]) => {
        calls.push('ListBuckets')
        clock += listMs
        const callback = args[args.length - 1] as grpc.requestCallback<unknown>
        callback(listErr, { buckets: [LISTED] })
      },
      UpdateBucket: (...args: unknown[]) => {
        calls.push('UpdateBucket')
        const callback = args[args.length - 1] as grpc.requestCallback<unknown>
        callback(null, {})
      },
    } as unknown as BucketAdminServiceClient
    return {
      buckets: new Couchbase2Buckets(timedChannel, client),
      contexts,
      calls,
    }
  }

  const clearing = { name: 'a', minimumDurabilityLevel: DurabilityLevel.None }

  it('should list the buckets as a read, and update in the time left', async () => {
    const { buckets, contexts, calls } = timed(1000, null)
    await buckets.updateBucket(clearing, req)
    expect(contexts).toEqual([
      { op: 'bucket_get', timeoutMs: 2500 },
      { op: 'bucket_update', timeoutMs: 1500 },
    ])
    expect(calls).toEqual(['ListBuckets', 'UpdateBucket'])
  })

  it('should raise UnambiguousTimeoutError when the listing times out', async () => {
    const deadline = Object.assign(new Error('deadline exceeded'), {
      code: grpc.status.DEADLINE_EXCEEDED,
      details: 'deadline exceeded',
      metadata: new grpc.Metadata(),
    })
    const { buckets, calls } = timed(2500, deadline)
    await expect(buckets.updateBucket(clearing, req)).rejects.toBeInstanceOf(
      UnambiguousTimeoutError
    )
    expect(calls).toEqual(['ListBuckets'])
  })

  it('should raise UnambiguousTimeoutError without updating when the listing takes all the time', async () => {
    const { buckets, calls } = timed(2500, null)
    await expect(buckets.updateBucket(clearing, req)).rejects.toBeInstanceOf(
      UnambiguousTimeoutError
    )
    expect(calls).toEqual(['ListBuckets'])
  })

  it('should leave an invalid argument as it is', async () => {
    const buckets = new Couchbase2Buckets(
      channel,
      answering(invalidArgument('ram quota is too small'))
    )
    await expect(
      buckets.createBucket({ name: 'b', ramQuotaMB: 1 }, req)
    ).rejects.toBeInstanceOf(InvalidArgumentError)
  })
})
