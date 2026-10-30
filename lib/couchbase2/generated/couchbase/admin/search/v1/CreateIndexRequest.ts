// Original file: couchbase/admin/search/v1/search.proto


/**
 * CreateIndexRequest creates a new search index.
 * Does not reuse the Index message because uuid is server-assigned.
 */
export interface CreateIndexRequest {
  'name'?: (string);
  'params'?: ({[key: string]: Buffer | Uint8Array | string});
  'plan_params'?: ({[key: string]: Buffer | Uint8Array | string});
  /**
   * UUID of a prior index version, for optimistic concurrency.
   */
  'prev_index_uuid'?: (string);
  'source_name'?: (string);
  'source_params'?: ({[key: string]: Buffer | Uint8Array | string});
  'source_type'?: (string);
  'source_uuid'?: (string);
  'type'?: (string);
  /**
   * Optional bucket/scope scoping for the index.
   */
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_prev_index_uuid'?: "prev_index_uuid";
  '_source_name'?: "source_name";
  '_source_type'?: "source_type";
  '_source_uuid'?: "source_uuid";
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}

/**
 * CreateIndexRequest creates a new search index.
 * Does not reuse the Index message because uuid is server-assigned.
 */
export interface CreateIndexRequest__Output {
  'name': (string);
  'params': ({[key: string]: Buffer});
  'plan_params': ({[key: string]: Buffer});
  /**
   * UUID of a prior index version, for optimistic concurrency.
   */
  'prev_index_uuid'?: (string);
  'source_name'?: (string);
  'source_params': ({[key: string]: Buffer});
  'source_type'?: (string);
  'source_uuid'?: (string);
  'type': (string);
  /**
   * Optional bucket/scope scoping for the index.
   */
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_prev_index_uuid'?: "prev_index_uuid";
  '_source_name'?: "source_name";
  '_source_type'?: "source_type";
  '_source_uuid'?: "source_uuid";
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}
