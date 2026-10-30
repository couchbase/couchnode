// Original file: couchbase/admin/analytics/v1/analytics.proto

/**
 * CouchbaseEncryptionMode controls the encryption level for
 * remote Couchbase cluster links.
 */
export const CouchbaseEncryptionMode = {
  /**
   * No encryption.
   */
  COUCHBASE_ENCRYPTION_MODE_NONE: 'COUCHBASE_ENCRYPTION_MODE_NONE',
  /**
   * Encrypt password only.
   */
  COUCHBASE_ENCRYPTION_MODE_HALF: 'COUCHBASE_ENCRYPTION_MODE_HALF',
  /**
   * Full TLS encryption.
   */
  COUCHBASE_ENCRYPTION_MODE_FULL: 'COUCHBASE_ENCRYPTION_MODE_FULL',
} as const;

/**
 * CouchbaseEncryptionMode controls the encryption level for
 * remote Couchbase cluster links.
 */
export type CouchbaseEncryptionMode =
  /**
   * No encryption.
   */
  | 'COUCHBASE_ENCRYPTION_MODE_NONE'
  | 0
  /**
   * Encrypt password only.
   */
  | 'COUCHBASE_ENCRYPTION_MODE_HALF'
  | 1
  /**
   * Full TLS encryption.
   */
  | 'COUCHBASE_ENCRYPTION_MODE_FULL'
  | 2

/**
 * CouchbaseEncryptionMode controls the encryption level for
 * remote Couchbase cluster links.
 */
export type CouchbaseEncryptionMode__Output = typeof CouchbaseEncryptionMode[keyof typeof CouchbaseEncryptionMode]
