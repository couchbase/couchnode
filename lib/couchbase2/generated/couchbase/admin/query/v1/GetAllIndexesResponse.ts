// Original file: couchbase/admin/query/v1/query.proto

import type { IndexType as _couchbase_admin_query_v1_IndexType, IndexType__Output as _couchbase_admin_query_v1_IndexType__Output } from '../../../../couchbase/admin/query/v1/IndexType';
import type { IndexState as _couchbase_admin_query_v1_IndexState, IndexState__Output as _couchbase_admin_query_v1_IndexState__Output } from '../../../../couchbase/admin/query/v1/IndexState';

/**
 * Index describes a single N1QL index.
 */
export interface _couchbase_admin_query_v1_GetAllIndexesResponse_Index {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'name'?: (string);
  'is_primary'?: (boolean);
  'type'?: (_couchbase_admin_query_v1_IndexType);
  'state'?: (_couchbase_admin_query_v1_IndexState);
  /**
   * The indexed field expressions.
   */
  'fields'?: (string)[];
  /**
   * The WHERE clause condition, if any.
   */
  'condition'?: (string);
  /**
   * The PARTITION BY expression, if any.
   */
  'partition'?: (string);
  '_condition'?: "condition";
  '_partition'?: "partition";
}

/**
 * Index describes a single N1QL index.
 */
export interface _couchbase_admin_query_v1_GetAllIndexesResponse_Index__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  'name': (string);
  'is_primary': (boolean);
  'type': (_couchbase_admin_query_v1_IndexType__Output);
  'state': (_couchbase_admin_query_v1_IndexState__Output);
  /**
   * The indexed field expressions.
   */
  'fields': (string)[];
  /**
   * The WHERE clause condition, if any.
   */
  'condition'?: (string);
  /**
   * The PARTITION BY expression, if any.
   */
  'partition'?: (string);
  '_condition'?: "condition";
  '_partition'?: "partition";
}

/**
 * GetAllIndexesResponse contains all matching indexes.
 */
export interface GetAllIndexesResponse {
  'indexes'?: (_couchbase_admin_query_v1_GetAllIndexesResponse_Index)[];
}

/**
 * GetAllIndexesResponse contains all matching indexes.
 */
export interface GetAllIndexesResponse__Output {
  'indexes': (_couchbase_admin_query_v1_GetAllIndexesResponse_Index__Output)[];
}
