// Original file: couchbase/kv/v1/kv.proto


/**
 * ExistsRequest checks if a document exists by key.
 */
export interface ExistsRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'key'?: (string);
}

/**
 * ExistsRequest checks if a document exists by key.
 */
export interface ExistsRequest__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  'key': (string);
}
