// Original file: couchbase/admin/search/v1/search.proto


/**
 * UnfreezeIndexPlanRequest unfreezes the index plan, allowing reassignment.
 */
export interface UnfreezeIndexPlanRequest {
  'name'?: (string);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}

/**
 * UnfreezeIndexPlanRequest unfreezes the index plan, allowing reassignment.
 */
export interface UnfreezeIndexPlanRequest__Output {
  'name': (string);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}
