// Original file: couchbase/kv/v1/kv.proto

import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from '../../../google/protobuf/Timestamp';
import type { Long } from '@grpc/proto-loader';

/**
 * GetAndLockResponse contains the locked document's content and metadata.
 */
export interface GetAndLockResponse {
  'content_uncompressed'?: (Buffer | Uint8Array | string);
  /**
   * The CAS value required to unlock or mutate the locked document.
   */
  'cas'?: (number | string | Long);
  'expiry'?: (_google_protobuf_Timestamp | null);
  'content_flags'?: (number);
  'content_compressed'?: (Buffer | Uint8Array | string);
  'content'?: "content_uncompressed"|"content_compressed";
}

/**
 * GetAndLockResponse contains the locked document's content and metadata.
 */
export interface GetAndLockResponse__Output {
  'content_uncompressed'?: (Buffer);
  /**
   * The CAS value required to unlock or mutate the locked document.
   */
  'cas': (string);
  'expiry': (_google_protobuf_Timestamp__Output | null);
  'content_flags': (number);
  'content_compressed'?: (Buffer);
  'content'?: "content_uncompressed"|"content_compressed";
}
