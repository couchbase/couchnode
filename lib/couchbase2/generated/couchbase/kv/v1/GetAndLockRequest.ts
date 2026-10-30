// Original file: couchbase/kv/v1/kv.proto

import type { CompressionEnabled as _couchbase_kv_v1_CompressionEnabled, CompressionEnabled__Output as _couchbase_kv_v1_CompressionEnabled__Output } from '../../../couchbase/kv/v1/CompressionEnabled';

/**
 * GetAndLockRequest retrieves a document and acquires a pessimistic lock.
 */
export interface GetAndLockRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'key'?: (string);
  /**
   * Duration in seconds for the pessimistic lock. The lock auto-expires
   * after this period if not explicitly released via Unlock.
   */
  'lock_time_secs'?: (number);
  'compression'?: (_couchbase_kv_v1_CompressionEnabled);
  '_compression'?: "compression";
}

/**
 * GetAndLockRequest retrieves a document and acquires a pessimistic lock.
 */
export interface GetAndLockRequest__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  'key': (string);
  /**
   * Duration in seconds for the pessimistic lock. The lock auto-expires
   * after this period if not explicitly released via Unlock.
   */
  'lock_time_secs': (number);
  'compression'?: (_couchbase_kv_v1_CompressionEnabled__Output);
  '_compression'?: "compression";
}
