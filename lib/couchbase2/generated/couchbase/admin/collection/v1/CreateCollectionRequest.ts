// Original file: couchbase/admin/collection/v1/collection.proto


/**
 * CreateCollectionRequest creates a new collection within a scope.
 */
export interface CreateCollectionRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  /**
   * Maximum document expiry in seconds for this collection.
   */
  'max_expiry_secs'?: (number);
  /**
   * Whether to enable change history retention.
   */
  'history_retention_enabled'?: (boolean);
  '_max_expiry_secs'?: "max_expiry_secs";
  '_history_retention_enabled'?: "history_retention_enabled";
}

/**
 * CreateCollectionRequest creates a new collection within a scope.
 */
export interface CreateCollectionRequest__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  /**
   * Maximum document expiry in seconds for this collection.
   */
  'max_expiry_secs'?: (number);
  /**
   * Whether to enable change history retention.
   */
  'history_retention_enabled'?: (boolean);
  '_max_expiry_secs'?: "max_expiry_secs";
  '_history_retention_enabled'?: "history_retention_enabled";
}
