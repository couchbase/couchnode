// Original file: couchbase/kv/v1/kv.proto

import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from '../../../google/protobuf/Timestamp';
import type { Long } from '@grpc/proto-loader';

/**
 * GetAndTouchResponse contains the retrieved document with its updated expiry.
 */
export interface GetAndTouchResponse {
  'content_uncompressed'?: (Buffer | Uint8Array | string);
  'cas'?: (number | string | Long);
  'expiry'?: (_google_protobuf_Timestamp | null);
  'content_flags'?: (number);
  'content_compressed'?: (Buffer | Uint8Array | string);
  'content'?: "content_uncompressed"|"content_compressed";
}

/**
 * GetAndTouchResponse contains the retrieved document with its updated expiry.
 */
export interface GetAndTouchResponse__Output {
  'content_uncompressed'?: (Buffer);
  'cas': (string);
  'expiry': (_google_protobuf_Timestamp__Output | null);
  'content_flags': (number);
  'content_compressed'?: (Buffer);
  'content'?: "content_uncompressed"|"content_compressed";
}
