// Original file: couchbase/admin/bucket/v1/bucket.proto

import type { BucketType as _couchbase_admin_bucket_v1_BucketType, BucketType__Output as _couchbase_admin_bucket_v1_BucketType__Output } from '../../../../couchbase/admin/bucket/v1/BucketType';
import type { EvictionMode as _couchbase_admin_bucket_v1_EvictionMode, EvictionMode__Output as _couchbase_admin_bucket_v1_EvictionMode__Output } from '../../../../couchbase/admin/bucket/v1/EvictionMode';
import type { CompressionMode as _couchbase_admin_bucket_v1_CompressionMode, CompressionMode__Output as _couchbase_admin_bucket_v1_CompressionMode__Output } from '../../../../couchbase/admin/bucket/v1/CompressionMode';
import type { DurabilityLevel as _couchbase_kv_v1_DurabilityLevel, DurabilityLevel__Output as _couchbase_kv_v1_DurabilityLevel__Output } from '../../../../couchbase/kv/v1/DurabilityLevel';
import type { StorageBackend as _couchbase_admin_bucket_v1_StorageBackend, StorageBackend__Output as _couchbase_admin_bucket_v1_StorageBackend__Output } from '../../../../couchbase/admin/bucket/v1/StorageBackend';
import type { ConflictResolutionType as _couchbase_admin_bucket_v1_ConflictResolutionType, ConflictResolutionType__Output as _couchbase_admin_bucket_v1_ConflictResolutionType__Output } from '../../../../couchbase/admin/bucket/v1/ConflictResolutionType';
import type { Long } from '@grpc/proto-loader';

/**
 * Bucket describes a single bucket's configuration.
 */
export interface _couchbase_admin_bucket_v1_ListBucketsResponse_Bucket {
  'bucket_name'?: (string);
  'flush_enabled'?: (boolean);
  'ram_quota_mb'?: (number | string | Long);
  'num_replicas'?: (number);
  'replica_indexes'?: (boolean);
  'bucket_type'?: (_couchbase_admin_bucket_v1_BucketType);
  'eviction_mode'?: (_couchbase_admin_bucket_v1_EvictionMode);
  'max_expiry_secs'?: (number);
  'compression_mode'?: (_couchbase_admin_bucket_v1_CompressionMode);
  'minimum_durability_level'?: (_couchbase_kv_v1_DurabilityLevel);
  'storage_backend'?: (_couchbase_admin_bucket_v1_StorageBackend);
  'conflict_resolution_type'?: (_couchbase_admin_bucket_v1_ConflictResolutionType);
  /**
   * Whether new collections default to having history retention enabled.
   */
  'history_retention_collection_default'?: (boolean);
  /**
   * Maximum size in bytes for retained history.
   */
  'history_retention_bytes'?: (number | string | Long);
  /**
   * Maximum duration in seconds for history retention.
   */
  'history_retention_duration_secs'?: (number);
  '_minimum_durability_level'?: "minimum_durability_level";
  '_storage_backend'?: "storage_backend";
  '_history_retention_collection_default'?: "history_retention_collection_default";
  '_history_retention_bytes'?: "history_retention_bytes";
  '_history_retention_duration_secs'?: "history_retention_duration_secs";
}

/**
 * Bucket describes a single bucket's configuration.
 */
export interface _couchbase_admin_bucket_v1_ListBucketsResponse_Bucket__Output {
  'bucket_name': (string);
  'flush_enabled': (boolean);
  'ram_quota_mb': (string);
  'num_replicas': (number);
  'replica_indexes': (boolean);
  'bucket_type': (_couchbase_admin_bucket_v1_BucketType__Output);
  'eviction_mode': (_couchbase_admin_bucket_v1_EvictionMode__Output);
  'max_expiry_secs': (number);
  'compression_mode': (_couchbase_admin_bucket_v1_CompressionMode__Output);
  'minimum_durability_level'?: (_couchbase_kv_v1_DurabilityLevel__Output);
  'storage_backend'?: (_couchbase_admin_bucket_v1_StorageBackend__Output);
  'conflict_resolution_type': (_couchbase_admin_bucket_v1_ConflictResolutionType__Output);
  /**
   * Whether new collections default to having history retention enabled.
   */
  'history_retention_collection_default'?: (boolean);
  /**
   * Maximum size in bytes for retained history.
   */
  'history_retention_bytes'?: (string);
  /**
   * Maximum duration in seconds for history retention.
   */
  'history_retention_duration_secs'?: (number);
  '_minimum_durability_level'?: "minimum_durability_level";
  '_storage_backend'?: "storage_backend";
  '_history_retention_collection_default'?: "history_retention_collection_default";
  '_history_retention_bytes'?: "history_retention_bytes";
  '_history_retention_duration_secs'?: "history_retention_duration_secs";
}

/**
 * ListBucketsResponse contains the list of all buckets and their
 * configurations.
 */
export interface ListBucketsResponse {
  'buckets'?: (_couchbase_admin_bucket_v1_ListBucketsResponse_Bucket)[];
}

/**
 * ListBucketsResponse contains the list of all buckets and their
 * configurations.
 */
export interface ListBucketsResponse__Output {
  'buckets': (_couchbase_admin_bucket_v1_ListBucketsResponse_Bucket__Output)[];
}
