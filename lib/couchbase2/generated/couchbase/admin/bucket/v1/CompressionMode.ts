// Original file: couchbase/admin/bucket/v1/bucket.proto

/**
 * CompressionMode controls document compression behavior.
 */
export const CompressionMode = {
  /**
   * Compression is disabled.
   */
  COMPRESSION_MODE_OFF: 'COMPRESSION_MODE_OFF',
  /**
   * Accept compressed data but do not actively compress.
   */
  COMPRESSION_MODE_PASSIVE: 'COMPRESSION_MODE_PASSIVE',
  /**
   * Actively compress data during compaction.
   */
  COMPRESSION_MODE_ACTIVE: 'COMPRESSION_MODE_ACTIVE',
} as const;

/**
 * CompressionMode controls document compression behavior.
 */
export type CompressionMode =
  /**
   * Compression is disabled.
   */
  | 'COMPRESSION_MODE_OFF'
  | 0
  /**
   * Accept compressed data but do not actively compress.
   */
  | 'COMPRESSION_MODE_PASSIVE'
  | 1
  /**
   * Actively compress data during compaction.
   */
  | 'COMPRESSION_MODE_ACTIVE'
  | 2

/**
 * CompressionMode controls document compression behavior.
 */
export type CompressionMode__Output = typeof CompressionMode[keyof typeof CompressionMode]
