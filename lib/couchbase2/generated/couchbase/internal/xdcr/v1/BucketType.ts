// Original file: couchbase/internal/xdcr/v1/xdcr.proto

/**
 * BucketType specifies the bucket storage type.
 */
export const BucketType = {
  BUCKET_TYPE_COUCHBASE: 'BUCKET_TYPE_COUCHBASE',
  BUCKET_TYPE_EPHEMERAL: 'BUCKET_TYPE_EPHEMERAL',
} as const;

/**
 * BucketType specifies the bucket storage type.
 */
export type BucketType =
  | 'BUCKET_TYPE_COUCHBASE'
  | 0
  | 'BUCKET_TYPE_EPHEMERAL'
  | 1

/**
 * BucketType specifies the bucket storage type.
 */
export type BucketType__Output = typeof BucketType[keyof typeof BucketType]
