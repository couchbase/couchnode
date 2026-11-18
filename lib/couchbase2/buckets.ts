import type { BackendRequest, BucketManagementBackend } from '../backends'
import {
  BucketSettings,
  BucketType,
  CompressionMode,
  ConflictResolutionType,
  EvictionPolicy,
  IBucketSettings,
  ICreateBucketSettings,
  StorageBackend,
} from '../bucketmanager'
import {
  BucketNotFoundError,
  FeatureNotAvailableError,
  InvalidArgumentError,
  InvalidDurabilityLevel,
} from '../errors'
import { DurabilityLevel } from '../generaltypes'
import { durabilityLevelOf, nsServerStrToDuraLevel } from '../utilities'
import type { BucketAdminServiceClient } from './generated/couchbase/admin/bucket/v1/BucketAdminService'
import type { BucketType__Output as BucketTypePb } from './generated/couchbase/admin/bucket/v1/BucketType'
import type { CompressionMode__Output as CompressionModePb } from './generated/couchbase/admin/bucket/v1/CompressionMode'
import type { ConflictResolutionType__Output as ConflictResolutionTypePb } from './generated/couchbase/admin/bucket/v1/ConflictResolutionType'
import type { CreateBucketRequest as CreateBucketRequestPb } from './generated/couchbase/admin/bucket/v1/CreateBucketRequest'
import type { CreateBucketResponse__Output as CreateBucketResponsePb } from './generated/couchbase/admin/bucket/v1/CreateBucketResponse'
import type { DeleteBucketResponse__Output as DeleteBucketResponsePb } from './generated/couchbase/admin/bucket/v1/DeleteBucketResponse'
import type { EvictionMode__Output as EvictionModePb } from './generated/couchbase/admin/bucket/v1/EvictionMode'
import type { FlushBucketResponse__Output as FlushBucketResponsePb } from './generated/couchbase/admin/bucket/v1/FlushBucketResponse'
import type {
  _couchbase_admin_bucket_v1_ListBucketsResponse_Bucket__Output as ListedBucketPb,
  ListBucketsResponse__Output as ListBucketsResponsePb,
} from './generated/couchbase/admin/bucket/v1/ListBucketsResponse'
import type { StorageBackend__Output as StorageBackendPb } from './generated/couchbase/admin/bucket/v1/StorageBackend'
import type { UpdateBucketRequest as UpdateBucketRequestPb } from './generated/couchbase/admin/bucket/v1/UpdateBucketRequest'
import type { UpdateBucketResponse__Output as UpdateBucketResponsePb } from './generated/couchbase/admin/bucket/v1/UpdateBucketResponse'
import type { DurabilityLevel__Output as DurabilityLevelPb } from './generated/couchbase/kv/v1/DurabilityLevel'
import type { Couchbase2Channel, Couchbase2Op } from './requestcontext'
import { unary } from './retry'

/**
 * @internal
 */
export const BUCKET_GET_ALL: Couchbase2Op = {
  name: 'bucket_get_all',
  readOnly: true,
}

/**
 * @internal
 */
export const BUCKET_GET: Couchbase2Op = {
  name: 'bucket_get',
  readOnly: true,
}

/**
 * @internal
 */
export const BUCKET_CREATE: Couchbase2Op = {
  name: 'bucket_create',
  readOnly: false,
}

/**
 * @internal
 */
export const BUCKET_UPDATE: Couchbase2Op = {
  name: 'bucket_update',
  readOnly: false,
}

/**
 * @internal
 */
export const BUCKET_DROP: Couchbase2Op = {
  name: 'bucket_drop',
  readOnly: false,
}

/**
 * @internal
 */
export const BUCKET_FLUSH: Couchbase2Op = {
  name: 'bucket_flush',
  readOnly: false,
}

/**
 * The RAM quota a bucket created without one is given, in megabytes, as on a
 * classic connection.
 */
const DEFAULT_RAM_QUOTA_MB = 100

// The gateway's spelling of each setting. Memcached and a minimum durability
// level of none have no spelling.

const BUCKET_TYPES = new Map<BucketType, BucketTypePb>([
  [BucketType.Couchbase, 'BUCKET_TYPE_COUCHBASE'],
  [BucketType.Ephemeral, 'BUCKET_TYPE_EPHEMERAL'],
])

const COMPRESSION_MODES = new Map<CompressionMode, CompressionModePb>([
  [CompressionMode.Off, 'COMPRESSION_MODE_OFF'],
  [CompressionMode.Passive, 'COMPRESSION_MODE_PASSIVE'],
  [CompressionMode.Active, 'COMPRESSION_MODE_ACTIVE'],
])

const CONFLICT_RESOLUTION_TYPES = new Map<
  ConflictResolutionType,
  ConflictResolutionTypePb
>([
  [ConflictResolutionType.Timestamp, 'CONFLICT_RESOLUTION_TYPE_TIMESTAMP'],
  [
    ConflictResolutionType.SequenceNumber,
    'CONFLICT_RESOLUTION_TYPE_SEQUENCE_NUMBER',
  ],
  [ConflictResolutionType.Custom, 'CONFLICT_RESOLUTION_TYPE_CUSTOM'],
])

const EVICTION_POLICIES = new Map<EvictionPolicy, EvictionModePb>([
  [EvictionPolicy.FullEviction, 'EVICTION_MODE_FULL'],
  [EvictionPolicy.ValueOnly, 'EVICTION_MODE_VALUE_ONLY'],
  [EvictionPolicy.NotRecentlyUsed, 'EVICTION_MODE_NOT_RECENTLY_USED'],
  [EvictionPolicy.NoEviction, 'EVICTION_MODE_NONE'],
])

const STORAGE_BACKENDS = new Map<StorageBackend, StorageBackendPb>([
  [StorageBackend.Couchstore, 'STORAGE_BACKEND_COUCHSTORE'],
  [StorageBackend.Magma, 'STORAGE_BACKEND_MAGMA'],
])

const DURABILITY_LEVELS = new Map<DurabilityLevel, DurabilityLevelPb>([
  [DurabilityLevel.Majority, 'DURABILITY_LEVEL_MAJORITY'],
  [
    DurabilityLevel.MajorityAndPersistOnMaster,
    'DURABILITY_LEVEL_MAJORITY_AND_PERSIST_TO_ACTIVE',
  ],
  [DurabilityLevel.PersistToMajority, 'DURABILITY_LEVEL_PERSIST_TO_MAJORITY'],
])

/**
 * The gateway's spelling of `value`. One it has no spelling for is an
 * invalid argument, as on a classic connection.
 */
function toProto<K extends string, W>(
  members: ReadonlyMap<K, W>,
  value: string,
  setting: string
): W {
  const wire = members.get(value as K)
  if (wire === undefined) {
    throw new InvalidArgumentError(
      new Error(`'${value}' is not a ${setting} that can be sent.`)
    )
  }
  return wire
}

/**
 * The SDK's member for a value the gateway sent, or undefined for one newer
 * than the SDK.
 */
function fromProto<K, W>(
  members: ReadonlyMap<K, W>,
  wire: W | undefined
): K | undefined {
  for (const [member, value] of members) {
    if (value === wire) {
      return member
    }
  }
  return undefined
}

/**
 * The minimum durability level `settings` asks for. The deprecated
 * `durabilityMinLevel` wins, as on a classic connection.
 */
function minimumDurabilityOf(
  settings: Partial<IBucketSettings>
): DurabilityLevel | undefined {
  if (settings.durabilityMinLevel !== undefined) {
    return nsServerStrToDuraLevel(settings.durabilityMinLevel)
  }
  return durabilityLevelOf(settings.minimumDurabilityLevel)
}

/**
 * The settings both a create and an update carry. A RAM quota of zero is
 * unset, as on a classic connection.
 */
function commonSettingsToProto(
  settings: Partial<IBucketSettings> & Pick<IBucketSettings, 'name'>
): UpdateBucketRequestPb {
  const message: UpdateBucketRequestPb = { bucket_name: settings.name }
  if (settings.ramQuotaMB) {
    message.ram_quota_mb = settings.ramQuotaMB
  }
  if (settings.numReplicas !== undefined) {
    message.num_replicas = settings.numReplicas
  }
  if (settings.flushEnabled !== undefined) {
    message.flush_enabled = settings.flushEnabled
  }
  const maxExpiry = settings.maxTTL || settings.maxExpiry
  if (maxExpiry !== undefined) {
    message.max_expiry_secs = maxExpiry
  }
  if (settings.evictionPolicy !== undefined) {
    message.eviction_mode = toProto(
      EVICTION_POLICIES,
      settings.evictionPolicy,
      'eviction policy'
    )
  }
  if (settings.compressionMode !== undefined) {
    message.compression_mode = toProto(
      COMPRESSION_MODES,
      settings.compressionMode,
      'compression mode'
    )
  }
  const durability = minimumDurabilityOf(settings)
  if (durability !== undefined && durability !== DurabilityLevel.None) {
    const wire = DURABILITY_LEVELS.get(durability)
    if (wire === undefined) {
      throw new InvalidDurabilityLevel()
    }
    message.minimum_durability_level = wire
  }
  if (settings.historyRetentionCollectionDefault !== undefined) {
    message.history_retention_collection_default =
      settings.historyRetentionCollectionDefault
  }
  if (settings.historyRetentionBytes !== undefined) {
    message.history_retention_bytes = settings.historyRetentionBytes
  }
  if (settings.historyRetentionDuration !== undefined) {
    message.history_retention_duration_secs = settings.historyRetentionDuration
  }
  return message
}

/**
 * Throws `FeatureNotAvailableError` for a memcached bucket and for a number
 * of vBuckets, which the gateway's request has no field for.
 *
 * @internal
 */
export function createBucketRequestToProto(
  settings: ICreateBucketSettings
): CreateBucketRequestPb {
  if (settings.bucketType === BucketType.Memcached) {
    throw new FeatureNotAvailableError(
      new Error('A memcached bucket cannot be created over couchbase2.')
    )
  }
  if (settings.numVBuckets !== undefined) {
    throw new FeatureNotAvailableError(
      new Error("A bucket's number of vBuckets cannot be set over couchbase2.")
    )
  }
  const message: CreateBucketRequestPb = commonSettingsToProto(settings)
  if (message.ram_quota_mb === undefined) {
    message.ram_quota_mb = DEFAULT_RAM_QUOTA_MB
  }
  if (settings.bucketType !== undefined) {
    message.bucket_type = toProto(
      BUCKET_TYPES,
      settings.bucketType,
      'bucket type'
    )
  }
  if (settings.replicaIndexes !== undefined) {
    message.replica_indexes = settings.replicaIndexes
  }
  if (settings.storageBackend !== undefined) {
    message.storage_backend = toProto(
      STORAGE_BACKENDS,
      settings.storageBackend,
      'storage backend'
    )
  }
  if (settings.conflictResolutionType !== undefined) {
    message.conflict_resolution_type = toProto(
      CONFLICT_RESOLUTION_TYPES,
      settings.conflictResolutionType,
      'conflict resolution type'
    )
  }
  return message
}

/**
 * The settings fixed at creation are left out rather than refused, because
 * the settings `getBucket` returns carry them and updating those is the
 * usual way to change one setting.
 *
 * @internal
 */
export function updateBucketRequestToProto(
  settings: Partial<IBucketSettings> & Pick<IBucketSettings, 'name'>
): UpdateBucketRequestPb {
  return commonSettingsToProto(settings)
}

/**
 * One listed bucket's settings, read as a classic connection reads them. No
 * minimum durability level means none. History settings are read for magma
 * only: the gateway lists zeros for couchstore, which the server refuses if
 * an update sends them back. A magma bucket has no replica indexes setting,
 * though the gateway lists it as off.
 *
 * @internal
 */
export function bucketSettingsFromProto(
  bucket: ListedBucketPb
): BucketSettings {
  const magma = bucket.storage_backend === 'STORAGE_BACKEND_MAGMA'
  return new BucketSettings({
    name: bucket.bucket_name,
    flushEnabled: bucket.flush_enabled,
    ramQuotaMB: Number(bucket.ram_quota_mb),
    numReplicas: bucket.num_replicas,
    replicaIndexes: magma ? undefined : bucket.replica_indexes,
    bucketType: fromProto(BUCKET_TYPES, bucket.bucket_type),
    storageBackend: fromProto(STORAGE_BACKENDS, bucket.storage_backend),
    evictionPolicy: fromProto(EVICTION_POLICIES, bucket.eviction_mode),
    maxExpiry: bucket.max_expiry_secs,
    compressionMode: fromProto(COMPRESSION_MODES, bucket.compression_mode),
    minimumDurabilityLevel:
      bucket.minimum_durability_level === undefined
        ? DurabilityLevel.None
        : fromProto(DURABILITY_LEVELS, bucket.minimum_durability_level),
    historyRetentionCollectionDefault: magma
      ? bucket.history_retention_collection_default
      : undefined,
    historyRetentionBytes:
      !magma || bucket.history_retention_bytes === undefined
        ? undefined
        : Number(bucket.history_retention_bytes),
    historyRetentionDuration: magma
      ? bucket.history_retention_duration_secs
      : undefined,
    numVBuckets: undefined,
    maxTTL: 0,
    durabilityMinLevel: '',
    ejectionMethod: '',
  })
}

/**
 * Bucket management over the gateway's `BucketAdminService`. The gateway
 * has no request for one bucket, so `getBucket` reads it from the listing.
 *
 * @internal
 */
export class Couchbase2Buckets implements BucketManagementBackend {
  private readonly _channel: Couchbase2Channel
  private readonly _client: BucketAdminServiceClient

  constructor(channel: Couchbase2Channel, client: BucketAdminServiceClient) {
    this._channel = channel
    this._client = client
  }

  /**
   * Creates a bucket with `BucketAdminService.CreateBucket`.
   */
  async createBucket(
    settings: ICreateBucketSettings,
    req: BackendRequest
  ): Promise<void> {
    const message = createBucketRequestToProto(settings)
    const ctx = this._channel.context(BUCKET_CREATE, req.timeout, req.obs)
    await unary<CreateBucketResponsePb>(ctx, (options, callback) =>
      this._client.CreateBucket(
        message,
        this._channel.metadata,
        options,
        callback
      )
    )
  }

  /**
   * Updates a bucket with `BucketAdminService.UpdateBucket`.
   */
  async updateBucket(
    settings: Partial<IBucketSettings> & Pick<IBucketSettings, 'name'>,
    req: BackendRequest
  ): Promise<void> {
    const message = updateBucketRequestToProto(settings)
    const ctx = this._channel.context(BUCKET_UPDATE, req.timeout, req.obs)
    await unary<UpdateBucketResponsePb>(ctx, (options, callback) =>
      this._client.UpdateBucket(
        message,
        this._channel.metadata,
        options,
        callback
      )
    )
  }

  /**
   * Drops a bucket with `BucketAdminService.DeleteBucket`.
   */
  async dropBucket(bucketName: string, req: BackendRequest): Promise<void> {
    const message = { bucket_name: bucketName }
    const ctx = this._channel.context(BUCKET_DROP, req.timeout, req.obs)
    await unary<DeleteBucketResponsePb>(ctx, (options, callback) =>
      this._client.DeleteBucket(
        message,
        this._channel.metadata,
        options,
        callback
      )
    )
  }

  /**
   * Reads one bucket's settings from `BucketAdminService.ListBuckets`. A
   * bucket missing from the listing raises `BucketNotFoundError`.
   */
  async getBucket(
    bucketName: string,
    req: BackendRequest
  ): Promise<BucketSettings> {
    const resp = await this._list(BUCKET_GET, req)
    const bucket = resp.buckets.find((b) => b.bucket_name === bucketName)
    if (!bucket) {
      throw new BucketNotFoundError(
        new Error(`Bucket '${bucketName}' does not exist.`)
      )
    }
    return bucketSettingsFromProto(bucket)
  }

  /**
   * Lists every bucket's settings with `BucketAdminService.ListBuckets`.
   */
  async getAllBuckets(req: BackendRequest): Promise<BucketSettings[]> {
    const resp = await this._list(BUCKET_GET_ALL, req)
    return resp.buckets.map(bucketSettingsFromProto)
  }

  /**
   * Flushes a bucket with `BucketAdminService.FlushBucket`.
   */
  async flushBucket(bucketName: string, req: BackendRequest): Promise<void> {
    const message = { bucket_name: bucketName }
    const ctx = this._channel.context(BUCKET_FLUSH, req.timeout, req.obs)
    await unary<FlushBucketResponsePb>(ctx, (options, callback) =>
      this._client.FlushBucket(
        message,
        this._channel.metadata,
        options,
        callback
      )
    )
  }

  /**
   * Lists every bucket with `BucketAdminService.ListBuckets`, as `op`.
   */
  private _list(
    op: Couchbase2Op,
    req: BackendRequest
  ): Promise<ListBucketsResponsePb> {
    const ctx = this._channel.context(op, req.timeout, req.obs)
    return unary<ListBucketsResponsePb>(ctx, (options, callback) =>
      this._client.ListBuckets({}, this._channel.metadata, options, callback)
    )
  }
}
