// Original file: couchbase/kv/v1/kv.proto

import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from '../../../google/protobuf/Timestamp';

/**
 * TouchRequest resets a document's expiry without retrieving its content.
 */
export interface TouchRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'key'?: (string);
  'expiry_time'?: (_google_protobuf_Timestamp | null);
  'expiry_secs'?: (number);
  /**
   * The new expiry to set.
   */
  'expiry'?: "expiry_time"|"expiry_secs";
}

/**
 * TouchRequest resets a document's expiry without retrieving its content.
 */
export interface TouchRequest__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  'key': (string);
  'expiry_time'?: (_google_protobuf_Timestamp__Output | null);
  'expiry_secs'?: (number);
  /**
   * The new expiry to set.
   */
  'expiry'?: "expiry_time"|"expiry_secs";
}
