// Original file: couchbase/view/v1/view.proto


// Original file: couchbase/view/v1/view.proto

/**
 * ErrorMode controls behavior when errors occur during view execution.
 */
export const _couchbase_view_v1_ViewQueryRequest_ErrorMode = {
  /**
   * Continue processing remaining results even if errors occur.
   */
  ERROR_MODE_CONTINUE: 'ERROR_MODE_CONTINUE',
  /**
   * Stop processing immediately on the first error.
   */
  ERROR_MODE_STOP: 'ERROR_MODE_STOP',
} as const;

/**
 * ErrorMode controls behavior when errors occur during view execution.
 */
export type _couchbase_view_v1_ViewQueryRequest_ErrorMode =
  /**
   * Continue processing remaining results even if errors occur.
   */
  | 'ERROR_MODE_CONTINUE'
  | 0
  /**
   * Stop processing immediately on the first error.
   */
  | 'ERROR_MODE_STOP'
  | 1

/**
 * ErrorMode controls behavior when errors occur during view execution.
 */
export type _couchbase_view_v1_ViewQueryRequest_ErrorMode__Output = typeof _couchbase_view_v1_ViewQueryRequest_ErrorMode[keyof typeof _couchbase_view_v1_ViewQueryRequest_ErrorMode]

// Original file: couchbase/view/v1/view.proto

/**
 * Namespace selects whether to query production or development views.
 */
export const _couchbase_view_v1_ViewQueryRequest_Namespace = {
  /**
   * Query production design documents.
   */
  NAMESPACE_PRODUCTION: 'NAMESPACE_PRODUCTION',
  /**
   * Query development design documents (prefixed with 'dev_').
   */
  NAMESPACE_DEVELOPMENT: 'NAMESPACE_DEVELOPMENT',
} as const;

/**
 * Namespace selects whether to query production or development views.
 */
export type _couchbase_view_v1_ViewQueryRequest_Namespace =
  /**
   * Query production design documents.
   */
  | 'NAMESPACE_PRODUCTION'
  | 0
  /**
   * Query development design documents (prefixed with 'dev_').
   */
  | 'NAMESPACE_DEVELOPMENT'
  | 1

/**
 * Namespace selects whether to query production or development views.
 */
export type _couchbase_view_v1_ViewQueryRequest_Namespace__Output = typeof _couchbase_view_v1_ViewQueryRequest_Namespace[keyof typeof _couchbase_view_v1_ViewQueryRequest_Namespace]

// Original file: couchbase/view/v1/view.proto

/**
 * Order controls the sort order of results.
 */
export const _couchbase_view_v1_ViewQueryRequest_Order = {
  /**
   * Return results in ascending key order (default).
   */
  ORDER_ASCENDING: 'ORDER_ASCENDING',
  /**
   * Return results in descending key order.
   */
  ORDER_DESCENDING: 'ORDER_DESCENDING',
} as const;

/**
 * Order controls the sort order of results.
 */
export type _couchbase_view_v1_ViewQueryRequest_Order =
  /**
   * Return results in ascending key order (default).
   */
  | 'ORDER_ASCENDING'
  | 0
  /**
   * Return results in descending key order.
   */
  | 'ORDER_DESCENDING'
  | 1

/**
 * Order controls the sort order of results.
 */
export type _couchbase_view_v1_ViewQueryRequest_Order__Output = typeof _couchbase_view_v1_ViewQueryRequest_Order[keyof typeof _couchbase_view_v1_ViewQueryRequest_Order]

// Original file: couchbase/view/v1/view.proto

/**
 * ScanConsistency controls index freshness for the view query.
 */
export const _couchbase_view_v1_ViewQueryRequest_ScanConsistency = {
  /**
   * No consistency required — fastest, may return stale results.
   */
  SCAN_CONSISTENCY_NOT_BOUNDED: 'SCAN_CONSISTENCY_NOT_BOUNDED',
  /**
   * Wait for all prior mutations to be indexed.
   */
  SCAN_CONSISTENCY_REQUEST_PLUS: 'SCAN_CONSISTENCY_REQUEST_PLUS',
  /**
   * Return current results but trigger an index update after the query.
   */
  SCAN_CONSISTENCY_UPDATE_AFTER: 'SCAN_CONSISTENCY_UPDATE_AFTER',
} as const;

/**
 * ScanConsistency controls index freshness for the view query.
 */
export type _couchbase_view_v1_ViewQueryRequest_ScanConsistency =
  /**
   * No consistency required — fastest, may return stale results.
   */
  | 'SCAN_CONSISTENCY_NOT_BOUNDED'
  | 0
  /**
   * Wait for all prior mutations to be indexed.
   */
  | 'SCAN_CONSISTENCY_REQUEST_PLUS'
  | 1
  /**
   * Return current results but trigger an index update after the query.
   */
  | 'SCAN_CONSISTENCY_UPDATE_AFTER'
  | 2

/**
 * ScanConsistency controls index freshness for the view query.
 */
export type _couchbase_view_v1_ViewQueryRequest_ScanConsistency__Output = typeof _couchbase_view_v1_ViewQueryRequest_ScanConsistency[keyof typeof _couchbase_view_v1_ViewQueryRequest_ScanConsistency]

/**
 * ViewQueryRequest specifies the view to query and all execution options.
 */
export interface ViewQueryRequest {
  /**
   * The name of the design document (without the '_design/' prefix).
   */
  'design_document_name'?: (string);
  /**
   * The name of the view within the design document.
   */
  'view_name'?: (string);
  /**
   * Number of initial rows to skip before returning results.
   */
  'skip'?: (number);
  /**
   * Maximum number of rows to return.
   */
  'limit'?: (number);
  'scan_consistency'?: (_couchbase_view_v1_ViewQueryRequest_ScanConsistency);
  /**
   * When true, execute the view's reduce function on the results.
   */
  'reduce'?: (boolean);
  /**
   * When true, group reduce results by their keys.
   */
  'group'?: (boolean);
  /**
   * The bucket containing the design document.
   */
  'bucket_name'?: (string);
  /**
   * The number of key components to group by (used with group=true).
   */
  'group_level'?: (number);
  /**
   * Fetch only the row with this exact key. JSON-encoded.
   */
  'key'?: (Buffer | Uint8Array | string);
  /**
   * Fetch only the rows with these exact keys. Each is JSON-encoded.
   */
  'keys'?: (Buffer | Uint8Array | string)[];
  /**
   * Start of the key range (inclusive). JSON-encoded.
   */
  'start_key'?: (Buffer | Uint8Array | string);
  /**
   * End of the key range. JSON-encoded. Inclusiveness controlled by
   * inclusive_end.
   */
  'end_key'?: (Buffer | Uint8Array | string);
  /**
   * When true, the end_key is inclusive (default: true).
   */
  'inclusive_end'?: (boolean);
  /**
   * Start returning results from this document ID within the start_key.
   */
  'start_key_doc_id'?: (string);
  /**
   * Stop returning results at this document ID within the end_key.
   */
  'end_key_doc_id'?: (string);
  'on_error'?: (_couchbase_view_v1_ViewQueryRequest_ErrorMode);
  /**
   * When true, include debug information in the response metadata.
   */
  'debug'?: (boolean);
  'namespace'?: (_couchbase_view_v1_ViewQueryRequest_Namespace);
  'order'?: (_couchbase_view_v1_ViewQueryRequest_Order);
  '_skip'?: "skip";
  '_limit'?: "limit";
  '_scan_consistency'?: "scan_consistency";
  '_reduce'?: "reduce";
  '_group'?: "group";
  '_group_level'?: "group_level";
  '_key'?: "key";
  '_start_key'?: "start_key";
  '_end_key'?: "end_key";
  '_inclusive_end'?: "inclusive_end";
  '_start_key_doc_id'?: "start_key_doc_id";
  '_end_key_doc_id'?: "end_key_doc_id";
  '_on_error'?: "on_error";
  '_debug'?: "debug";
  '_namespace'?: "namespace";
  '_order'?: "order";
}

/**
 * ViewQueryRequest specifies the view to query and all execution options.
 */
export interface ViewQueryRequest__Output {
  /**
   * The name of the design document (without the '_design/' prefix).
   */
  'design_document_name': (string);
  /**
   * The name of the view within the design document.
   */
  'view_name': (string);
  /**
   * Number of initial rows to skip before returning results.
   */
  'skip'?: (number);
  /**
   * Maximum number of rows to return.
   */
  'limit'?: (number);
  'scan_consistency'?: (_couchbase_view_v1_ViewQueryRequest_ScanConsistency__Output);
  /**
   * When true, execute the view's reduce function on the results.
   */
  'reduce'?: (boolean);
  /**
   * When true, group reduce results by their keys.
   */
  'group'?: (boolean);
  /**
   * The bucket containing the design document.
   */
  'bucket_name': (string);
  /**
   * The number of key components to group by (used with group=true).
   */
  'group_level'?: (number);
  /**
   * Fetch only the row with this exact key. JSON-encoded.
   */
  'key'?: (Buffer);
  /**
   * Fetch only the rows with these exact keys. Each is JSON-encoded.
   */
  'keys': (Buffer)[];
  /**
   * Start of the key range (inclusive). JSON-encoded.
   */
  'start_key'?: (Buffer);
  /**
   * End of the key range. JSON-encoded. Inclusiveness controlled by
   * inclusive_end.
   */
  'end_key'?: (Buffer);
  /**
   * When true, the end_key is inclusive (default: true).
   */
  'inclusive_end'?: (boolean);
  /**
   * Start returning results from this document ID within the start_key.
   */
  'start_key_doc_id'?: (string);
  /**
   * Stop returning results at this document ID within the end_key.
   */
  'end_key_doc_id'?: (string);
  'on_error'?: (_couchbase_view_v1_ViewQueryRequest_ErrorMode__Output);
  /**
   * When true, include debug information in the response metadata.
   */
  'debug'?: (boolean);
  'namespace'?: (_couchbase_view_v1_ViewQueryRequest_Namespace__Output);
  'order'?: (_couchbase_view_v1_ViewQueryRequest_Order__Output);
  '_skip'?: "skip";
  '_limit'?: "limit";
  '_scan_consistency'?: "scan_consistency";
  '_reduce'?: "reduce";
  '_group'?: "group";
  '_group_level'?: "group_level";
  '_key'?: "key";
  '_start_key'?: "start_key";
  '_end_key'?: "end_key";
  '_inclusive_end'?: "inclusive_end";
  '_start_key_doc_id'?: "start_key_doc_id";
  '_end_key_doc_id'?: "end_key_doc_id";
  '_on_error'?: "on_error";
  '_debug'?: "debug";
  '_namespace'?: "namespace";
  '_order'?: "order";
}
