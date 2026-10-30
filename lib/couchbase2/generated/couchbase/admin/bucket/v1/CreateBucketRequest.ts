// Original file: couchbase/admin/bucket/v1/bucket.proto

import type { BucketType as _couchbase_admin_bucket_v1_BucketType, BucketType__Output as _couchbase_admin_bucket_v1_BucketType__Output } from '../../../../couchbase/admin/bucket/v1/BucketType';
import type { EvictionMode as _couchbase_admin_bucket_v1_EvictionMode, EvictionMode__Output as _couchbase_admin_bucket_v1_EvictionMode__Output } from '../../../../couchbase/admin/bucket/v1/EvictionMode';
import type { CompressionMode as _couchbase_admin_bucket_v1_CompressionMode, CompressionMode__Output as _couchbase_admin_bucket_v1_CompressionMode__Output } from '../../../../couchbase/admin/bucket/v1/CompressionMode';
import type { DurabilityLevel as _couchbase_kv_v1_DurabilityLevel, DurabilityLevel__Output as _couchbase_kv_v1_DurabilityLevel__Output } from '../../../../couchbase/kv/v1/DurabilityLevel';
import type { StorageBackend as _couchbase_admin_bucket_v1_StorageBackend, StorageBackend__Output as _couchbase_admin_bucket_v1_StorageBackend__Output } from '../../../../couchbase/admin/bucket/v1/StorageBackend';
import type { ConflictResolutionType as _couchbase_admin_bucket_v1_ConflictResolutionType, ConflictResolutionType__Output as _couchbase_admin_bucket_v1_ConflictResolutionType__Output } from '../../../../couchbase/admin/bucket/v1/ConflictResolutionType';
import type { Long } from '@grpc/proto-loader';

/**
 * CreateBucketRequest creates a new bucket. Only bucket_name and bucket_type
 * are required; all other fields have server-side defaults.
 */
export interface CreateBucketRequest {
  'bucket_name'?: (string);
  'bucket_type'?: (_couchbase_admin_bucket_v1_BucketType);
  'ram_quota_mb'?: (number | string | Long);
  'num_replicas'?: (number);
  'flush_enabled'?: (boolean);
  'replica_indexes'?: (boolean);
  'eviction_mode'?: (_couchbase_admin_bucket_v1_EvictionMode);
  'max_expiry_secs'?: (number);
  'compression_mode'?: (_couchbase_admin_bucket_v1_CompressionMode);
  'minimum_durability_level'?: (_couchbase_kv_v1_DurabilityLevel);
  'storage_backend'?: (_couchbase_admin_bucket_v1_StorageBackend);
  'conflict_resolution_type'?: (_couchbase_admin_bucket_v1_ConflictResolutionType);
  'history_retention_collection_default'?: (boolean);
  'history_retention_bytes'?: (number | string | Long);
  'history_retention_duration_secs'?: (number);
  '_ram_quota_mb'?: "ram_quota_mb";
  '_num_replicas'?: "num_replicas";
  '_flush_enabled'?: "flush_enabled";
  '_replica_indexes'?: "replica_indexes";
  '_eviction_mode'?: "eviction_mode";
  '_max_expiry_secs'?: "max_expiry_secs";
  '_compression_mode'?: "compression_mode";
  '_minimum_durability_level'?: "minimum_durability_level";
  '_storage_backend'?: "storage_backend";
  '_conflict_resolution_type'?: "conflict_resolution_type";
  '_history_retention_collection_default'?: "history_retention_collection_default";
  '_history_retention_bytes'?: "history_retention_bytes";
  '_history_retention_duration_secs'?: "history_retention_duration_secs";
}

/**
 * CreateBucketRequest creates a new bucket. Only bucket_name and bucket_type
 * are required; all other fields have server-side defaults.
 */
export interface CreateBucketRequest__Output {
  'bucket_name': (string);
  'bucket_type': (_couchbase_admin_bucket_v1_BucketType__Output);
  'ram_quota_mb'?: (string);
  'num_replicas'?: (number);
  'flush_enabled'?: (boolean);
  'replica_indexes'?: (boolean);
  'eviction_mode'?: (_couchbase_admin_bucket_v1_EvictionMode__Output);
  'max_expiry_secs'?: (number);
  'compression_mode'?: (_couchbase_admin_bucket_v1_CompressionMode__Output);
  'minimum_durability_level'?: (_couchbase_kv_v1_DurabilityLevel__Output);
  'storage_backend'?: (_couchbase_admin_bucket_v1_StorageBackend__Output);
  'conflict_resolution_type'?: (_couchbase_admin_bucket_v1_ConflictResolutionType__Output);
  'history_retention_collection_default'?: (boolean);
  'history_retention_bytes'?: (string);
  'history_retention_duration_secs'?: (number);
  '_ram_quota_mb'?: "ram_quota_mb";
  '_num_replicas'?: "num_replicas";
  '_flush_enabled'?: "flush_enabled";
  '_replica_indexes'?: "replica_indexes";
  '_eviction_mode'?: "eviction_mode";
  '_max_expiry_secs'?: "max_expiry_secs";
  '_compression_mode'?: "compression_mode";
  '_minimum_durability_level'?: "minimum_durability_level";
  '_storage_backend'?: "storage_backend";
  '_conflict_resolution_type'?: "conflict_resolution_type";
  '_history_retention_collection_default'?: "history_retention_collection_default";
  '_history_retention_bytes'?: "history_retention_bytes";
  '_history_retention_duration_secs'?: "history_retention_duration_secs";
}
