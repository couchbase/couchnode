// Original file: couchbase/internal/xdcr/v1/xdcr.proto

import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from '../../../../google/protobuf/Timestamp';
import type { Long } from '@grpc/proto-loader';

/**
 * CheckDocumentRequest checks if a document exists and compares metadata
 * for conflict resolution before pushing a replicated document.
 */
export interface CheckDocumentRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'key'?: (string);
  /**
   * The CAS to compare against (from the source document).
   */
  'store_cas'?: (number | string | Long);
  /**
   * The revision number of the source document.
   */
  'revno'?: (number | string | Long);
  /**
   * The content flags of the source document.
   */
  'content_flags'?: (number);
  /**
   * Whether the source document has extended attributes.
   */
  'has_xattrs'?: (boolean);
  /**
   * The expiry time of the source document.
   */
  'expiry_time'?: (_google_protobuf_Timestamp | null);
  /**
   * Whether the source document is a tombstone.
   */
  'is_deleted'?: (boolean);
  /**
   * The vbucket UUID for disambiguating cluster/bucket identity.
   */
  'vb_uuid'?: (number | string | Long);
  '_expiry_time'?: "expiry_time";
  '_vb_uuid'?: "vb_uuid";
}

/**
 * CheckDocumentRequest checks if a document exists and compares metadata
 * for conflict resolution before pushing a replicated document.
 */
export interface CheckDocumentRequest__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  'key': (string);
  /**
   * The CAS to compare against (from the source document).
   */
  'store_cas': (string);
  /**
   * The revision number of the source document.
   */
  'revno': (string);
  /**
   * The content flags of the source document.
   */
  'content_flags': (number);
  /**
   * Whether the source document has extended attributes.
   */
  'has_xattrs': (boolean);
  /**
   * The expiry time of the source document.
   */
  'expiry_time'?: (_google_protobuf_Timestamp__Output | null);
  /**
   * Whether the source document is a tombstone.
   */
  'is_deleted': (boolean);
  /**
   * The vbucket UUID for disambiguating cluster/bucket identity.
   */
  'vb_uuid'?: (string);
  '_expiry_time'?: "expiry_time";
  '_vb_uuid'?: "vb_uuid";
}
