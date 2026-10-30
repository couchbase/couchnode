// Original file: couchbase/admin/query/v1/query.proto


/**
 * CreateIndexRequest creates a secondary index on specified fields.
 */
export interface CreateIndexRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'name'?: (string);
  'num_replicas'?: (number);
  /**
   * The field expressions to index.
   */
  'fields'?: (string)[];
  /**
   * When true, create the index in deferred state.
   */
  'deferred'?: (boolean);
  /**
   * When true, do not error if the index already exists.
   */
  'ignore_if_exists'?: (boolean);
  '_scope_name'?: "scope_name";
  '_collection_name'?: "collection_name";
  '_num_replicas'?: "num_replicas";
  '_deferred'?: "deferred";
  '_ignore_if_exists'?: "ignore_if_exists";
}

/**
 * CreateIndexRequest creates a secondary index on specified fields.
 */
export interface CreateIndexRequest__Output {
  'bucket_name': (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'name': (string);
  'num_replicas'?: (number);
  /**
   * The field expressions to index.
   */
  'fields': (string)[];
  /**
   * When true, create the index in deferred state.
   */
  'deferred'?: (boolean);
  /**
   * When true, do not error if the index already exists.
   */
  'ignore_if_exists'?: (boolean);
  '_scope_name'?: "scope_name";
  '_collection_name'?: "collection_name";
  '_num_replicas'?: "num_replicas";
  '_deferred'?: "deferred";
  '_ignore_if_exists'?: "ignore_if_exists";
}
