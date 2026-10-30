// Original file: couchbase/admin/query/v1/query.proto


/**
 * CreatePrimaryIndexRequest creates a primary index.
 */
export interface CreatePrimaryIndexRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  /**
   * Optional custom name for the primary index.
   */
  'name'?: (string);
  /**
   * Number of index replicas.
   */
  'num_replicas'?: (number);
  /**
   * When true, create the index in deferred state (must be built later).
   */
  'deferred'?: (boolean);
  /**
   * When true, do not error if the index already exists.
   */
  'ignore_if_exists'?: (boolean);
  '_scope_name'?: "scope_name";
  '_collection_name'?: "collection_name";
  '_name'?: "name";
  '_num_replicas'?: "num_replicas";
  '_deferred'?: "deferred";
  '_ignore_if_exists'?: "ignore_if_exists";
}

/**
 * CreatePrimaryIndexRequest creates a primary index.
 */
export interface CreatePrimaryIndexRequest__Output {
  'bucket_name': (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  /**
   * Optional custom name for the primary index.
   */
  'name'?: (string);
  /**
   * Number of index replicas.
   */
  'num_replicas'?: (number);
  /**
   * When true, create the index in deferred state (must be built later).
   */
  'deferred'?: (boolean);
  /**
   * When true, do not error if the index already exists.
   */
  'ignore_if_exists'?: (boolean);
  '_scope_name'?: "scope_name";
  '_collection_name'?: "collection_name";
  '_name'?: "name";
  '_num_replicas'?: "num_replicas";
  '_deferred'?: "deferred";
  '_ignore_if_exists'?: "ignore_if_exists";
}
