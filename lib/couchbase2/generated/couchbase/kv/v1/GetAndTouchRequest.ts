// Original file: couchbase/kv/v1/kv.proto

import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from '../../../google/protobuf/Timestamp';
import type { CompressionEnabled as _couchbase_kv_v1_CompressionEnabled, CompressionEnabled__Output as _couchbase_kv_v1_CompressionEnabled__Output } from '../../../couchbase/kv/v1/CompressionEnabled';

/**
 * GetAndTouchRequest retrieves a document and simultaneously resets its expiry.
 */
export interface GetAndTouchRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'key'?: (string);
  'expiry_time'?: (_google_protobuf_Timestamp | null);
  'expiry_secs'?: (number);
  'compression'?: (_couchbase_kv_v1_CompressionEnabled);
  /**
   * The new expiry to set, as either an absolute timestamp or a duration in
   * seconds.
   */
  'expiry'?: "expiry_time"|"expiry_secs";
  '_compression'?: "compression";
}

/**
 * GetAndTouchRequest retrieves a document and simultaneously resets its expiry.
 */
export interface GetAndTouchRequest__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  'key': (string);
  'expiry_time'?: (_google_protobuf_Timestamp__Output | null);
  'expiry_secs'?: (number);
  'compression'?: (_couchbase_kv_v1_CompressionEnabled__Output);
  /**
   * The new expiry to set, as either an absolute timestamp or a duration in
   * seconds.
   */
  'expiry'?: "expiry_time"|"expiry_secs";
  '_compression'?: "compression";
}
