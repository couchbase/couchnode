// Original file: couchbase/admin/query/v1/query.proto


/**
 * DropIndexRequest drops a named secondary index.
 */
export interface DropIndexRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'name'?: (string);
  /**
   * When true, do not error if the index does not exist.
   */
  'ignore_if_missing'?: (boolean);
  '_scope_name'?: "scope_name";
  '_collection_name'?: "collection_name";
  '_ignore_if_missing'?: "ignore_if_missing";
}

/**
 * DropIndexRequest drops a named secondary index.
 */
export interface DropIndexRequest__Output {
  'bucket_name': (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'name': (string);
  /**
   * When true, do not error if the index does not exist.
   */
  'ignore_if_missing'?: (boolean);
  '_scope_name'?: "scope_name";
  '_collection_name'?: "collection_name";
  '_ignore_if_missing'?: "ignore_if_missing";
}
