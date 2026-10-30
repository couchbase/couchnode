// Original file: couchbase/kv/v1/kv.proto

import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from '../../../google/protobuf/Timestamp';
import type { DurabilityLevel as _couchbase_kv_v1_DurabilityLevel, DurabilityLevel__Output as _couchbase_kv_v1_DurabilityLevel__Output } from '../../../couchbase/kv/v1/DurabilityLevel';

/**
 * UpsertRequest creates or fully replaces a document unconditionally.
 */
export interface UpsertRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'key'?: (string);
  'content_uncompressed'?: (Buffer | Uint8Array | string);
  'expiry_time'?: (_google_protobuf_Timestamp | null);
  'durability_level'?: (_couchbase_kv_v1_DurabilityLevel);
  'expiry_secs'?: (number);
  'content_flags'?: (number);
  /**
   * When true and the document already exists, the existing expiry is
   * preserved rather than being replaced by the new expiry value.
   */
  'preserve_expiry_on_existing'?: (boolean);
  'content_compressed'?: (Buffer | Uint8Array | string);
  'content'?: "content_uncompressed"|"content_compressed";
  'expiry'?: "expiry_time"|"expiry_secs";
  '_preserve_expiry_on_existing'?: "preserve_expiry_on_existing";
  '_durability_level'?: "durability_level";
}

/**
 * UpsertRequest creates or fully replaces a document unconditionally.
 */
export interface UpsertRequest__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  'key': (string);
  'content_uncompressed'?: (Buffer);
  'expiry_time'?: (_google_protobuf_Timestamp__Output | null);
  'durability_level'?: (_couchbase_kv_v1_DurabilityLevel__Output);
  'expiry_secs'?: (number);
  'content_flags': (number);
  /**
   * When true and the document already exists, the existing expiry is
   * preserved rather than being replaced by the new expiry value.
   */
  'preserve_expiry_on_existing'?: (boolean);
  'content_compressed'?: (Buffer);
  'content'?: "content_uncompressed"|"content_compressed";
  'expiry'?: "expiry_time"|"expiry_secs";
  '_preserve_expiry_on_existing'?: "preserve_expiry_on_existing";
  '_durability_level'?: "durability_level";
}
