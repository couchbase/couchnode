// Original file: couchbase/kv/v1/kv.proto

import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from '../../../google/protobuf/Timestamp';
import type { DurabilityLevel as _couchbase_kv_v1_DurabilityLevel, DurabilityLevel__Output as _couchbase_kv_v1_DurabilityLevel__Output } from '../../../couchbase/kv/v1/DurabilityLevel';
import type { Long } from '@grpc/proto-loader';

/**
 * ReplaceRequest updates an existing document. Fails if the document does not
 * exist.
 */
export interface ReplaceRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'key'?: (string);
  'content_uncompressed'?: (Buffer | Uint8Array | string);
  /**
   * Optional CAS for optimistic concurrency. If provided, the replace
   * will fail if the document has been modified since this CAS was obtained.
   */
  'cas'?: (number | string | Long);
  'expiry_time'?: (_google_protobuf_Timestamp | null);
  'durability_level'?: (_couchbase_kv_v1_DurabilityLevel);
  'expiry_secs'?: (number);
  'content_flags'?: (number);
  'content_compressed'?: (Buffer | Uint8Array | string);
  'content'?: "content_uncompressed"|"content_compressed";
  '_cas'?: "cas";
  'expiry'?: "expiry_time"|"expiry_secs";
  '_durability_level'?: "durability_level";
}

/**
 * ReplaceRequest updates an existing document. Fails if the document does not
 * exist.
 */
export interface ReplaceRequest__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  'key': (string);
  'content_uncompressed'?: (Buffer);
  /**
   * Optional CAS for optimistic concurrency. If provided, the replace
   * will fail if the document has been modified since this CAS was obtained.
   */
  'cas'?: (string);
  'expiry_time'?: (_google_protobuf_Timestamp__Output | null);
  'durability_level'?: (_couchbase_kv_v1_DurabilityLevel__Output);
  'expiry_secs'?: (number);
  'content_flags': (number);
  'content_compressed'?: (Buffer);
  'content'?: "content_uncompressed"|"content_compressed";
  '_cas'?: "cas";
  'expiry'?: "expiry_time"|"expiry_secs";
  '_durability_level'?: "durability_level";
}
