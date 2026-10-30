// Original file: couchbase/admin/search/v1/search.proto


/**
 * ListIndexesRequest lists search indexes, optionally scoped.
 */
export interface ListIndexesRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}

/**
 * ListIndexesRequest lists search indexes, optionally scoped.
 */
export interface ListIndexesRequest__Output {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}
