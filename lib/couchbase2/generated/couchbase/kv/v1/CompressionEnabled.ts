// Original file: couchbase/kv/v1/kv.proto

/**
 * CompressionEnabled controls whether the server may return compressed content.
 */
export const CompressionEnabled = {
  /**
   * The server may return either compressed or uncompressed content.
   */
  COMPRESSION_ENABLED_OPTIONAL: 'COMPRESSION_ENABLED_OPTIONAL',
  /**
   * The server should always return compressed content when possible.
   */
  COMPRESSION_ENABLED_ALWAYS: 'COMPRESSION_ENABLED_ALWAYS',
} as const;

/**
 * CompressionEnabled controls whether the server may return compressed content.
 */
export type CompressionEnabled =
  /**
   * The server may return either compressed or uncompressed content.
   */
  | 'COMPRESSION_ENABLED_OPTIONAL'
  | 0
  /**
   * The server should always return compressed content when possible.
   */
  | 'COMPRESSION_ENABLED_ALWAYS'
  | 1

/**
 * CompressionEnabled controls whether the server may return compressed content.
 */
export type CompressionEnabled__Output = typeof CompressionEnabled[keyof typeof CompressionEnabled]
