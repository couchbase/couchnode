// Original file: couchbase/admin/query/v1/query.proto


/**
 * GetAllIndexesRequest lists indexes, optionally filtered by scope.
 */
export interface GetAllIndexesRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
  '_collection_name'?: "collection_name";
}

/**
 * GetAllIndexesRequest lists indexes, optionally filtered by scope.
 */
export interface GetAllIndexesRequest__Output {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
  '_collection_name'?: "collection_name";
}
