// Original file: couchbase/admin/search/v1/search.proto


/**
 * AnalyzeDocumentRequest analyzes a document against an index definition.
 */
export interface AnalyzeDocumentRequest {
  /**
   * The index name to analyze against.
   */
  'name'?: (string);
  /**
   * The document to analyze. JSON-encoded.
   */
  'doc'?: (Buffer | Uint8Array | string);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}

/**
 * AnalyzeDocumentRequest analyzes a document against an index definition.
 */
export interface AnalyzeDocumentRequest__Output {
  /**
   * The index name to analyze against.
   */
  'name': (string);
  /**
   * The document to analyze. JSON-encoded.
   */
  'doc': (Buffer);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}
