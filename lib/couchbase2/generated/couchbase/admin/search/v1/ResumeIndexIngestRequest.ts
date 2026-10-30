// Original file: couchbase/admin/search/v1/search.proto


/**
 * ResumeIndexIngestRequest resumes document ingestion for a paused index.
 */
export interface ResumeIndexIngestRequest {
  'name'?: (string);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}

/**
 * ResumeIndexIngestRequest resumes document ingestion for a paused index.
 */
export interface ResumeIndexIngestRequest__Output {
  'name': (string);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}
