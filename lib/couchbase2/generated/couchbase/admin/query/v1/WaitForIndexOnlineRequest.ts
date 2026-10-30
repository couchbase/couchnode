// Original file: couchbase/admin/query/v1/query.proto


/**
 * WaitForIndexOnlineRequest blocks until the named index is online.
 */
export interface WaitForIndexOnlineRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'name'?: (string);
}

/**
 * WaitForIndexOnlineRequest blocks until the named index is online.
 */
export interface WaitForIndexOnlineRequest__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  'name': (string);
}
