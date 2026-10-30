// Original file: couchbase/kv/v1/kv.proto

import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from '../../../google/protobuf/Timestamp';
import type { Long } from '@grpc/proto-loader';

/**
 * GetResponse contains the retrieved document content and metadata.
 */
export interface GetResponse {
  'content_uncompressed'?: (Buffer | Uint8Array | string);
  /**
   * The current Compare-And-Swap value for optimistic concurrency.
   */
  'cas'?: (number | string | Long);
  /**
   * The document's expiry time, if set.
   */
  'expiry'?: (_google_protobuf_Timestamp | null);
  /**
   * SDK-specific flags describing the content encoding/type.
   */
  'content_flags'?: (number);
  'content_compressed'?: (Buffer | Uint8Array | string);
  /**
   * The document body, either uncompressed or compressed.
   */
  'content'?: "content_uncompressed"|"content_compressed";
}

/**
 * GetResponse contains the retrieved document content and metadata.
 */
export interface GetResponse__Output {
  'content_uncompressed'?: (Buffer);
  /**
   * The current Compare-And-Swap value for optimistic concurrency.
   */
  'cas': (string);
  /**
   * The document's expiry time, if set.
   */
  'expiry': (_google_protobuf_Timestamp__Output | null);
  /**
   * SDK-specific flags describing the content encoding/type.
   */
  'content_flags': (number);
  'content_compressed'?: (Buffer);
  /**
   * The document body, either uncompressed or compressed.
   */
  'content'?: "content_uncompressed"|"content_compressed";
}
