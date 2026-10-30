// Original file: couchbase/admin/search/v1/search.proto


/**
 * DeleteIndexRequest deletes a search index.
 */
export interface DeleteIndexRequest {
  'name'?: (string);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}

/**
 * DeleteIndexRequest deletes a search index.
 */
export interface DeleteIndexRequest__Output {
  'name': (string);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}
