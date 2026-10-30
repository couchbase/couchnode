// Original file: couchbase/admin/query/v1/query.proto


/**
 * DropPrimaryIndexRequest drops a primary index.
 */
export interface DropPrimaryIndexRequest {
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
  '_name'?: "name";
  '_ignore_if_missing'?: "ignore_if_missing";
}

/**
 * DropPrimaryIndexRequest drops a primary index.
 */
export interface DropPrimaryIndexRequest__Output {
  'bucket_name': (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'name'?: (string);
  /**
   * When true, do not error if the index does not exist.
   */
  'ignore_if_missing'?: (boolean);
  '_scope_name'?: "scope_name";
  '_collection_name'?: "collection_name";
  '_name'?: "name";
  '_ignore_if_missing'?: "ignore_if_missing";
}
