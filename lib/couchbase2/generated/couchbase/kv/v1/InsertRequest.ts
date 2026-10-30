// Original file: couchbase/kv/v1/kv.proto

import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from '../../../google/protobuf/Timestamp';
import type { DurabilityLevel as _couchbase_kv_v1_DurabilityLevel, DurabilityLevel__Output as _couchbase_kv_v1_DurabilityLevel__Output } from '../../../couchbase/kv/v1/DurabilityLevel';

/**
 * InsertRequest creates a new document. Fails if the document already exists.
 */
export interface InsertRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'key'?: (string);
  'content_uncompressed'?: (Buffer | Uint8Array | string);
  'expiry_time'?: (_google_protobuf_Timestamp | null);
  /**
   * Optional durability requirements for this mutation.
   */
  'durability_level'?: (_couchbase_kv_v1_DurabilityLevel);
  'expiry_secs'?: (number);
  /**
   * SDK-specific flags describing the content encoding/type.
   */
  'content_flags'?: (number);
  'content_compressed'?: (Buffer | Uint8Array | string);
  /**
   * The document body to store.
   */
  'content'?: "content_uncompressed"|"content_compressed";
  /**
   * Optional expiry for the new document.
   */
  'expiry'?: "expiry_time"|"expiry_secs";
  '_durability_level'?: "durability_level";
}

/**
 * InsertRequest creates a new document. Fails if the document already exists.
 */
export interface InsertRequest__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  'key': (string);
  'content_uncompressed'?: (Buffer);
  'expiry_time'?: (_google_protobuf_Timestamp__Output | null);
  /**
   * Optional durability requirements for this mutation.
   */
  'durability_level'?: (_couchbase_kv_v1_DurabilityLevel__Output);
  'expiry_secs'?: (number);
  /**
   * SDK-specific flags describing the content encoding/type.
   */
  'content_flags': (number);
  'content_compressed'?: (Buffer);
  /**
   * The document body to store.
   */
  'content'?: "content_uncompressed"|"content_compressed";
  /**
   * Optional expiry for the new document.
   */
  'expiry'?: "expiry_time"|"expiry_secs";
  '_durability_level'?: "durability_level";
}
