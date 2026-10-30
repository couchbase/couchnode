// Original file: couchbase/admin/collection/v1/collection.proto

import type { Long } from '@grpc/proto-loader';

/**
 * DeleteScopeResponse returns the new manifest version.
 */
export interface DeleteScopeResponse {
  'manifest_uid'?: (number | string | Long);
}

/**
 * DeleteScopeResponse returns the new manifest version.
 */
export interface DeleteScopeResponse__Output {
  'manifest_uid': (string);
}
