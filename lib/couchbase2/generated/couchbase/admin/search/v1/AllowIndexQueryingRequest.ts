// Original file: couchbase/admin/search/v1/search.proto


/**
 * AllowIndexQueryingRequest re-enables querying for an index.
 */
export interface AllowIndexQueryingRequest {
  'name'?: (string);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}

/**
 * AllowIndexQueryingRequest re-enables querying for an index.
 */
export interface AllowIndexQueryingRequest__Output {
  'name': (string);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}
