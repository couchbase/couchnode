// Original file: couchbase/admin/collection/v1/collection.proto


/**
 * UpdateCollectionRequest modifies collection properties.
 */
export interface UpdateCollectionRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'max_expiry_secs'?: (number);
  'history_retention_enabled'?: (boolean);
  '_max_expiry_secs'?: "max_expiry_secs";
  '_history_retention_enabled'?: "history_retention_enabled";
}

/**
 * UpdateCollectionRequest modifies collection properties.
 */
export interface UpdateCollectionRequest__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  'max_expiry_secs'?: (number);
  'history_retention_enabled'?: (boolean);
  '_max_expiry_secs'?: "max_expiry_secs";
  '_history_retention_enabled'?: "history_retention_enabled";
}
