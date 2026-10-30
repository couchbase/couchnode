// Original file: couchbase/admin/search/v1/search.proto


/**
 * GetIndexRequest retrieves a search index by name.
 */
export interface GetIndexRequest {
  'name'?: (string);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}

/**
 * GetIndexRequest retrieves a search index by name.
 */
export interface GetIndexRequest__Output {
  'name': (string);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}
