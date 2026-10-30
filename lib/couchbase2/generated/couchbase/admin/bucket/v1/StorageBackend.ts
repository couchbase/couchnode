// Original file: couchbase/admin/bucket/v1/bucket.proto

/**
 * StorageBackend specifies the on-disk storage engine.
 */
export const StorageBackend = {
  /**
   * Couchstore — the traditional storage engine.
   */
  STORAGE_BACKEND_COUCHSTORE: 'STORAGE_BACKEND_COUCHSTORE',
  /**
   * Magma — high-performance storage engine for large datasets.
   */
  STORAGE_BACKEND_MAGMA: 'STORAGE_BACKEND_MAGMA',
} as const;

/**
 * StorageBackend specifies the on-disk storage engine.
 */
export type StorageBackend =
  /**
   * Couchstore — the traditional storage engine.
   */
  | 'STORAGE_BACKEND_COUCHSTORE'
  | 0
  /**
   * Magma — high-performance storage engine for large datasets.
   */
  | 'STORAGE_BACKEND_MAGMA'
  | 1

/**
 * StorageBackend specifies the on-disk storage engine.
 */
export type StorageBackend__Output = typeof StorageBackend[keyof typeof StorageBackend]
