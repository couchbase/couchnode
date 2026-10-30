// Original file: couchbase/admin/search/v1/search.proto


/**
 * PauseIndexIngestRequest pauses document ingestion for an index.
 */
export interface PauseIndexIngestRequest {
  'name'?: (string);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}

/**
 * PauseIndexIngestRequest pauses document ingestion for an index.
 */
export interface PauseIndexIngestRequest__Output {
  'name': (string);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}
