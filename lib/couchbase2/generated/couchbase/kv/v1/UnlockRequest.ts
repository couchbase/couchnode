// Original file: couchbase/kv/v1/kv.proto

import type { Long } from '@grpc/proto-loader';

/**
 * UnlockRequest releases a pessimistic lock on a document.
 */
export interface UnlockRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'key'?: (string);
  /**
   * The CAS value returned by the GetAndLock that acquired the lock.
   */
  'cas'?: (number | string | Long);
}

/**
 * UnlockRequest releases a pessimistic lock on a document.
 */
export interface UnlockRequest__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  'key': (string);
  /**
   * The CAS value returned by the GetAndLock that acquired the lock.
   */
  'cas': (string);
}
