// Original file: couchbase/admin/search/v1/search.proto


/**
 * FreezeIndexPlanRequest freezes the index plan, preventing reassignment.
 */
export interface FreezeIndexPlanRequest {
  'name'?: (string);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}

/**
 * FreezeIndexPlanRequest freezes the index plan, preventing reassignment.
 */
export interface FreezeIndexPlanRequest__Output {
  'name': (string);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}
