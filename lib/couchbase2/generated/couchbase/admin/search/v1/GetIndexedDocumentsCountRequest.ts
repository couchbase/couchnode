// Original file: couchbase/admin/search/v1/search.proto


/**
 * GetIndexedDocumentsCountRequest retrieves the indexed document count.
 */
export interface GetIndexedDocumentsCountRequest {
  'name'?: (string);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}

/**
 * GetIndexedDocumentsCountRequest retrieves the indexed document count.
 */
export interface GetIndexedDocumentsCountRequest__Output {
  'name': (string);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}
