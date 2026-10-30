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
