// Original file: couchbase/internal/hooks/v1/hooks.proto

import type { Any as _google_protobuf_Any, Any__Output as _google_protobuf_Any__Output } from '../../../../google/protobuf/Any';

/**
 * MetaDataEntry is a key-value pair from gRPC request metadata.
 */
export interface _couchbase_internal_hooks_v1_WatchRequestsResponse_MetaDataEntry {
  'key'?: (string);
  'value'?: (string);
}

/**
 * MetaDataEntry is a key-value pair from gRPC request metadata.
 */
export interface _couchbase_internal_hooks_v1_WatchRequestsResponse_MetaDataEntry__Output {
  'key': (string);
  'value': (string);
}

/**
 * WatchRequestsResponse contains details of an intercepted request.
 */
export interface WatchRequestsResponse {
  /**
   * The gRPC metadata headers from the intercepted request.
   */
  'meta_data'?: (_couchbase_internal_hooks_v1_WatchRequestsResponse_MetaDataEntry)[];
  /**
   * The full gRPC method name.
   */
  'full_method'?: (string);
  /**
   * The request message payload.
   */
  'payload'?: (_google_protobuf_Any | null);
}

/**
 * WatchRequestsResponse contains details of an intercepted request.
 */
export interface WatchRequestsResponse__Output {
  /**
   * The gRPC metadata headers from the intercepted request.
   */
  'meta_data': (_couchbase_internal_hooks_v1_WatchRequestsResponse_MetaDataEntry__Output)[];
  /**
   * The full gRPC method name.
   */
  'full_method': (string);
  /**
   * The request message payload.
   */
  'payload': (_google_protobuf_Any__Output | null);
}
