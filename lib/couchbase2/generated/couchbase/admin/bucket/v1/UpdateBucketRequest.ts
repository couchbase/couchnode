// Original file: couchbase/admin/bucket/v1/bucket.proto

import type { EvictionMode as _couchbase_admin_bucket_v1_EvictionMode, EvictionMode__Output as _couchbase_admin_bucket_v1_EvictionMode__Output } from '../../../../couchbase/admin/bucket/v1/EvictionMode';
import type { CompressionMode as _couchbase_admin_bucket_v1_CompressionMode, CompressionMode__Output as _couchbase_admin_bucket_v1_CompressionMode__Output } from '../../../../couchbase/admin/bucket/v1/CompressionMode';
import type { DurabilityLevel as _couchbase_kv_v1_DurabilityLevel, DurabilityLevel__Output as _couchbase_kv_v1_DurabilityLevel__Output } from '../../../../couchbase/kv/v1/DurabilityLevel';
import type { Long } from '@grpc/proto-loader';

/**
 * UpdateBucketRequest modifies mutable properties of an existing bucket.
 * Immutable properties (bucket_type, storage_backend, conflict_resolution_type)
 * cannot be changed after creation.
 */
export interface UpdateBucketRequest {
  'bucket_name'?: (string);
  'ram_quota_mb'?: (number | string | Long);
  'num_replicas'?: (number);
  'flush_enabled'?: (boolean);
  'eviction_mode'?: (_couchbase_admin_bucket_v1_EvictionMode);
  'max_expiry_secs'?: (number);
  'compression_mode'?: (_couchbase_admin_bucket_v1_CompressionMode);
  'minimum_durability_level'?: (_couchbase_kv_v1_DurabilityLevel);
  'history_retention_collection_default'?: (boolean);
  'history_retention_bytes'?: (number | string | Long);
  'history_retention_duration_secs'?: (number);
  '_ram_quota_mb'?: "ram_quota_mb";
  '_num_replicas'?: "num_replicas";
  '_flush_enabled'?: "flush_enabled";
  '_eviction_mode'?: "eviction_mode";
  '_max_expiry_secs'?: "max_expiry_secs";
  '_compression_mode'?: "compression_mode";
  '_minimum_durability_level'?: "minimum_durability_level";
  '_history_retention_collection_default'?: "history_retention_collection_default";
  '_history_retention_bytes'?: "history_retention_bytes";
  '_history_retention_duration_secs'?: "history_retention_duration_secs";
}

/**
 * UpdateBucketRequest modifies mutable properties of an existing bucket.
 * Immutable properties (bucket_type, storage_backend, conflict_resolution_type)
 * cannot be changed after creation.
 */
export interface UpdateBucketRequest__Output {
  'bucket_name': (string);
  'ram_quota_mb'?: (string);
  'num_replicas'?: (number);
  'flush_enabled'?: (boolean);
  'eviction_mode'?: (_couchbase_admin_bucket_v1_EvictionMode__Output);
  'max_expiry_secs'?: (number);
  'compression_mode'?: (_couchbase_admin_bucket_v1_CompressionMode__Output);
  'minimum_durability_level'?: (_couchbase_kv_v1_DurabilityLevel__Output);
  'history_retention_collection_default'?: (boolean);
  'history_retention_bytes'?: (string);
  'history_retention_duration_secs'?: (number);
  '_ram_quota_mb'?: "ram_quota_mb";
  '_num_replicas'?: "num_replicas";
  '_flush_enabled'?: "flush_enabled";
  '_eviction_mode'?: "eviction_mode";
  '_max_expiry_secs'?: "max_expiry_secs";
  '_compression_mode'?: "compression_mode";
  '_minimum_durability_level'?: "minimum_durability_level";
  '_history_retention_collection_default'?: "history_retention_collection_default";
  '_history_retention_bytes'?: "history_retention_bytes";
  '_history_retention_duration_secs'?: "history_retention_duration_secs";
}
