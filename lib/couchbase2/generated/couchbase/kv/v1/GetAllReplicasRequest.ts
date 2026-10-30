// Original file: couchbase/kv/v1/kv.proto


/**
 * GetAllReplicasRequest reads a document from the active node and all replicas.
 */
export interface GetAllReplicasRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'key'?: (string);
}

/**
 * GetAllReplicasRequest reads a document from the active node and all replicas.
 */
export interface GetAllReplicasRequest__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  'key': (string);
}
