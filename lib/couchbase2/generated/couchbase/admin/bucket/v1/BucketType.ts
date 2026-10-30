// Original file: couchbase/admin/bucket/v1/bucket.proto

/**
 * BucketType specifies the storage type of the bucket.
 */
export const BucketType = {
  /**
   * Couchbase bucket — persistent, supports replicas and DCP.
   */
  BUCKET_TYPE_COUCHBASE: 'BUCKET_TYPE_COUCHBASE',
  /**
   * Ephemeral bucket — in-memory only, no persistence.
   */
  BUCKET_TYPE_EPHEMERAL: 'BUCKET_TYPE_EPHEMERAL',
} as const;

/**
 * BucketType specifies the storage type of the bucket.
 */
export type BucketType =
  /**
   * Couchbase bucket — persistent, supports replicas and DCP.
   */
  | 'BUCKET_TYPE_COUCHBASE'
  | 0
  /**
   * Ephemeral bucket — in-memory only, no persistence.
   */
  | 'BUCKET_TYPE_EPHEMERAL'
  | 1

/**
 * BucketType specifies the storage type of the bucket.
 */
export type BucketType__Output = typeof BucketType[keyof typeof BucketType]
