// Original file: couchbase/admin/query/v1/query.proto


/**
 * BuildDeferredIndexesRequest triggers the build of all deferred indexes
 * in the specified scope.
 */
export interface BuildDeferredIndexesRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  '_scope_name'?: "scope_name";
  '_collection_name'?: "collection_name";
}

/**
 * BuildDeferredIndexesRequest triggers the build of all deferred indexes
 * in the specified scope.
 */
export interface BuildDeferredIndexesRequest__Output {
  'bucket_name': (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  '_scope_name'?: "scope_name";
  '_collection_name'?: "collection_name";
}
