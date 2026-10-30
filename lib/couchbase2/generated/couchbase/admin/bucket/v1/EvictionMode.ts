// Original file: couchbase/admin/bucket/v1/bucket.proto

/**
 * EvictionMode controls how items are ejected when memory is full.
 */
export const EvictionMode = {
  /**
   * Eject everything (metadata + value) from memory.
   */
  EVICTION_MODE_FULL: 'EVICTION_MODE_FULL',
  /**
   * Eject the least recently used items first (ephemeral buckets only).
   */
  EVICTION_MODE_NOT_RECENTLY_USED: 'EVICTION_MODE_NOT_RECENTLY_USED',
  /**
   * Eject only the value, keeping metadata in memory.
   */
  EVICTION_MODE_VALUE_ONLY: 'EVICTION_MODE_VALUE_ONLY',
  /**
   * No eviction — reject writes when memory is full (ephemeral buckets only).
   */
  EVICTION_MODE_NONE: 'EVICTION_MODE_NONE',
} as const;

/**
 * EvictionMode controls how items are ejected when memory is full.
 */
export type EvictionMode =
  /**
   * Eject everything (metadata + value) from memory.
   */
  | 'EVICTION_MODE_FULL'
  | 0
  /**
   * Eject the least recently used items first (ephemeral buckets only).
   */
  | 'EVICTION_MODE_NOT_RECENTLY_USED'
  | 1
  /**
   * Eject only the value, keeping metadata in memory.
   */
  | 'EVICTION_MODE_VALUE_ONLY'
  | 2
  /**
   * No eviction — reject writes when memory is full (ephemeral buckets only).
   */
  | 'EVICTION_MODE_NONE'
  | 3

/**
 * EvictionMode controls how items are ejected when memory is full.
 */
export type EvictionMode__Output = typeof EvictionMode[keyof typeof EvictionMode]
