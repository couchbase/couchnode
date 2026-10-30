// Original file: couchbase/admin/search/v1/search.proto

import type { Index as _couchbase_admin_search_v1_Index, Index__Output as _couchbase_admin_search_v1_Index__Output } from '../../../../couchbase/admin/search/v1/Index';

/**
 * ListIndexesResponse contains all matching indexes.
 */
export interface ListIndexesResponse {
  'indexes'?: (_couchbase_admin_search_v1_Index)[];
}

/**
 * ListIndexesResponse contains all matching indexes.
 */
export interface ListIndexesResponse__Output {
  'indexes': (_couchbase_admin_search_v1_Index__Output)[];
}
