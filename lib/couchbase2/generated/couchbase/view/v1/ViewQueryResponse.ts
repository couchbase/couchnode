// Original file: couchbase/view/v1/view.proto

import type { Long } from '@grpc/proto-loader';

/**
 * MetaData contains summary information about the view query results.
 */
export interface _couchbase_view_v1_ViewQueryResponse_MetaData {
  /**
   * Total number of rows in the view (before skip/limit are applied).
   */
  'total_rows'?: (number | string | Long);
  /**
   * Debug information, if requested. JSON-encoded.
   */
  'debug'?: (Buffer | Uint8Array | string);
}

/**
 * MetaData contains summary information about the view query results.
 */
export interface _couchbase_view_v1_ViewQueryResponse_MetaData__Output {
  /**
   * Total number of rows in the view (before skip/limit are applied).
   */
  'total_rows': (string);
  /**
   * Debug information, if requested. JSON-encoded.
   */
  'debug': (Buffer);
}

/**
 * Row represents a single result from the view query.
 */
export interface _couchbase_view_v1_ViewQueryResponse_Row {
  /**
   * The document ID that produced this row.
   */
  'id'?: (string);
  /**
   * The emitted key from the map function. JSON-encoded.
   */
  'key'?: (Buffer | Uint8Array | string);
  /**
   * The emitted value from the map function (or reduce result). JSON-encoded.
   */
  'value'?: (Buffer | Uint8Array | string);
}

/**
 * Row represents a single result from the view query.
 */
export interface _couchbase_view_v1_ViewQueryResponse_Row__Output {
  /**
   * The document ID that produced this row.
   */
  'id': (string);
  /**
   * The emitted key from the map function. JSON-encoded.
   */
  'key': (Buffer);
  /**
   * The emitted value from the map function (or reduce result). JSON-encoded.
   */
  'value': (Buffer);
}

/**
 * ViewQueryResponse is streamed back. Contains result rows and optional
 * metadata.
 */
export interface ViewQueryResponse {
  /**
   * The result rows from the view query.
   */
  'rows'?: (_couchbase_view_v1_ViewQueryResponse_Row)[];
  'meta_data'?: (_couchbase_view_v1_ViewQueryResponse_MetaData | null);
  '_meta_data'?: "meta_data";
}

/**
 * ViewQueryResponse is streamed back. Contains result rows and optional
 * metadata.
 */
export interface ViewQueryResponse__Output {
  /**
   * The result rows from the view query.
   */
  'rows': (_couchbase_view_v1_ViewQueryResponse_Row__Output)[];
  'meta_data'?: (_couchbase_view_v1_ViewQueryResponse_MetaData__Output | null);
  '_meta_data'?: "meta_data";
}
