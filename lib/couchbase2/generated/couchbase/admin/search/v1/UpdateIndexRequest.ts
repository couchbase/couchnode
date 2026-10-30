// Original file: couchbase/admin/search/v1/search.proto

import type { Index as _couchbase_admin_search_v1_Index, Index__Output as _couchbase_admin_search_v1_Index__Output } from '../../../../couchbase/admin/search/v1/Index';

/**
 * UpdateIndexRequest updates an existing search index.
 */
export interface UpdateIndexRequest {
  /**
   * The full index definition with updated fields.
   */
  'index'?: (_couchbase_admin_search_v1_Index | null);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}

/**
 * UpdateIndexRequest updates an existing search index.
 */
export interface UpdateIndexRequest__Output {
  /**
   * The full index definition with updated fields.
   */
  'index': (_couchbase_admin_search_v1_Index__Output | null);
  'bucket_name'?: (string);
  'scope_name'?: (string);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}
