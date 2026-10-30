// Original file: couchbase/admin/search/v1/search.proto


/**
 * DisallowIndexQueryingRequest disables querying for an index.
 */
export interface DisallowIndexQueryingRequest {
  'name'?: (string);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}

/**
 * DisallowIndexQueryingRequest disables querying for an index.
 */
export interface DisallowIndexQueryingRequest__Output {
  'name': (string);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}
