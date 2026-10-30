// Original file: couchbase/internal/xdcr/v1/xdcr.proto

import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from '../../../../google/protobuf/Timestamp';
import type { Long } from '@grpc/proto-loader';

/**
 * GetDocumentResponse returns the document with full metadata for replication.
 */
export interface GetDocumentResponse {
  /**
   * The CAS value of the document.
   */
  'cas'?: (number | string | Long);
  /**
   * The document expiry time.
   */
  'expiry'?: (_google_protobuf_Timestamp | null);
  /**
   * Whether the document is a tombstone (deleted but retained for replication).
   */
  'is_deleted'?: (boolean);
  /**
   * The datatype flags for the document content.
   */
  'datatype'?: (number);
  /**
   * The content flags (SDK-specific encoding metadata).
   */
  'content_flags'?: (number);
  /**
   * The document body, snappy-compressed.
   */
  'content_compressed'?: (Buffer | Uint8Array | string);
  /**
   * The revision number for conflict resolution.
   */
  'revno'?: (number | string | Long);
  /**
   * Extended attributes, keyed by xattr name.
   */
  'xattrs'?: ({[key: string]: Buffer | Uint8Array | string});
  '_content_compressed'?: "content_compressed";
}

/**
 * GetDocumentResponse returns the document with full metadata for replication.
 */
export interface GetDocumentResponse__Output {
  /**
   * The CAS value of the document.
   */
  'cas': (string);
  /**
   * The document expiry time.
   */
  'expiry': (_google_protobuf_Timestamp__Output | null);
  /**
   * Whether the document is a tombstone (deleted but retained for replication).
   */
  'is_deleted': (boolean);
  /**
   * The datatype flags for the document content.
   */
  'datatype': (number);
  /**
   * The content flags (SDK-specific encoding metadata).
   */
  'content_flags': (number);
  /**
   * The document body, snappy-compressed.
   */
  'content_compressed'?: (Buffer);
  /**
   * The revision number for conflict resolution.
   */
  'revno': (string);
  /**
   * Extended attributes, keyed by xattr name.
   */
  'xattrs': ({[key: string]: Buffer});
  '_content_compressed'?: "content_compressed";
}
