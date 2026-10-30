// Original file: couchbase/internal/xdcr/v1/xdcr.proto

import type { ConflictResolutionType as _couchbase_internal_xdcr_v1_ConflictResolutionType, ConflictResolutionType__Output as _couchbase_internal_xdcr_v1_ConflictResolutionType__Output } from '../../../../couchbase/internal/xdcr/v1/ConflictResolutionType';
import type { BucketType as _couchbase_internal_xdcr_v1_BucketType, BucketType__Output as _couchbase_internal_xdcr_v1_BucketType__Output } from '../../../../couchbase/internal/xdcr/v1/BucketType';

/**
 * GetBucketInfoResponse returns bucket metadata for XDCR configuration.
 */
export interface GetBucketInfoResponse {
  /**
   * The bucket UUID.
   */
  'bucket_uuid'?: (string);
  /**
   * Total number of vbuckets in the bucket.
   */
  'num_vbuckets'?: (number);
  /**
   * How conflicts are resolved during replication.
   */
  'conflict_resolution_type'?: (_couchbase_internal_xdcr_v1_ConflictResolutionType);
  /**
   * Whether cross-cluster versioning is enabled for this bucket.
   */
  'cross_cluster_versioning_enabled'?: (boolean);
  /**
   * The bucket type (Couchbase or Ephemeral).
   */
  'bucket_type'?: (_couchbase_internal_xdcr_v1_BucketType);
  '_bucket_type'?: "bucket_type";
}

/**
 * GetBucketInfoResponse returns bucket metadata for XDCR configuration.
 */
export interface GetBucketInfoResponse__Output {
  /**
   * The bucket UUID.
   */
  'bucket_uuid': (string);
  /**
   * Total number of vbuckets in the bucket.
   */
  'num_vbuckets': (number);
  /**
   * How conflicts are resolved during replication.
   */
  'conflict_resolution_type': (_couchbase_internal_xdcr_v1_ConflictResolutionType__Output);
  /**
   * Whether cross-cluster versioning is enabled for this bucket.
   */
  'cross_cluster_versioning_enabled': (boolean);
  /**
   * The bucket type (Couchbase or Ephemeral).
   */
  'bucket_type'?: (_couchbase_internal_xdcr_v1_BucketType__Output);
  '_bucket_type'?: "bucket_type";
}
