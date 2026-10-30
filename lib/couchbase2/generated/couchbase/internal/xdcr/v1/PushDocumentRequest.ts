// Original file: couchbase/internal/xdcr/v1/xdcr.proto

import type { ContentType as _couchbase_internal_xdcr_v1_ContentType, ContentType__Output as _couchbase_internal_xdcr_v1_ContentType__Output } from '../../../../couchbase/internal/xdcr/v1/ContentType';
import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from '../../../../google/protobuf/Timestamp';
import type { Long } from '@grpc/proto-loader';

/**
 * PushDocumentRequest pushes a replicated document to the target cluster.
 */
export interface PushDocumentRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'key'?: (string);
  /**
   * The CAS to check before storing. If the target document's CAS
   * does not match, the push is rejected for conflict resolution.
   */
  'check_cas'?: (number | string | Long);
  /**
   * The CAS value to store with the document on the target.
   */
  'store_cas'?: (number | string | Long);
  /**
   * The revision number.
   */
  'revno'?: (number | string | Long);
  /**
   * SDK-specific content encoding metadata.
   */
  'content_flags'?: (number);
  /**
   * The content format (JSON or non-JSON).
   */
  'content_type'?: (_couchbase_internal_xdcr_v1_ContentType);
  'content_compressed'?: (Buffer | Uint8Array | string);
  /**
   * The document expiry time.
   */
  'expiry_time'?: (_google_protobuf_Timestamp | null);
  /**
   * Whether this is a tombstone (deletion marker).
   */
  'is_deleted'?: (boolean);
  /**
   * The vbucket UUID for disambiguating cluster/bucket identity.
   */
  'vb_uuid'?: (number | string | Long);
  'content_uncompressed'?: (Buffer | Uint8Array | string);
  /**
   * Extended attributes to store with the document.
   */
  'xattrs'?: ({[key: string]: Buffer | Uint8Array | string});
  '_check_cas'?: "check_cas";
  /**
   * The document body, either uncompressed or snappy-compressed.
   */
  'content'?: "content_uncompressed"|"content_compressed";
  '_expiry_time'?: "expiry_time";
  '_vb_uuid'?: "vb_uuid";
}

/**
 * PushDocumentRequest pushes a replicated document to the target cluster.
 */
export interface PushDocumentRequest__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  'key': (string);
  /**
   * The CAS to check before storing. If the target document's CAS
   * does not match, the push is rejected for conflict resolution.
   */
  'check_cas'?: (string);
  /**
   * The CAS value to store with the document on the target.
   */
  'store_cas': (string);
  /**
   * The revision number.
   */
  'revno': (string);
  /**
   * SDK-specific content encoding metadata.
   */
  'content_flags': (number);
  /**
   * The content format (JSON or non-JSON).
   */
  'content_type': (_couchbase_internal_xdcr_v1_ContentType__Output);
  'content_compressed'?: (Buffer);
  /**
   * The document expiry time.
   */
  'expiry_time'?: (_google_protobuf_Timestamp__Output | null);
  /**
   * Whether this is a tombstone (deletion marker).
   */
  'is_deleted': (boolean);
  /**
   * The vbucket UUID for disambiguating cluster/bucket identity.
   */
  'vb_uuid'?: (string);
  'content_uncompressed'?: (Buffer);
  /**
   * Extended attributes to store with the document.
   */
  'xattrs': ({[key: string]: Buffer});
  '_check_cas'?: "check_cas";
  /**
   * The document body, either uncompressed or snappy-compressed.
   */
  'content'?: "content_uncompressed"|"content_compressed";
  '_expiry_time'?: "expiry_time";
  '_vb_uuid'?: "vb_uuid";
}
