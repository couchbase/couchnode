// Original file: couchbase/admin/query/v1/query.proto


/**
 * Index identifies an index that is being built.
 */
export interface _couchbase_admin_query_v1_BuildDeferredIndexesResponse_Index {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'name'?: (string);
  '_scope_name'?: "scope_name";
  '_collection_name'?: "collection_name";
}

/**
 * Index identifies an index that is being built.
 */
export interface _couchbase_admin_query_v1_BuildDeferredIndexesResponse_Index__Output {
  'bucket_name': (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'name': (string);
  '_scope_name'?: "scope_name";
  '_collection_name'?: "collection_name";
}

/**
 * BuildDeferredIndexesResponse returns the indexes that will be built.
 */
export interface BuildDeferredIndexesResponse {
  'indexes'?: (_couchbase_admin_query_v1_BuildDeferredIndexesResponse_Index)[];
}

/**
 * BuildDeferredIndexesResponse returns the indexes that will be built.
 */
export interface BuildDeferredIndexesResponse__Output {
  'indexes': (_couchbase_admin_query_v1_BuildDeferredIndexesResponse_Index__Output)[];
}
