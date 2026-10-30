// Original file: couchbase/admin/collection/v1/collection.proto

import type { Long } from '@grpc/proto-loader';

/**
 * CreateScopeResponse returns the new manifest version.
 */
export interface CreateScopeResponse {
  'manifest_uid'?: (number | string | Long);
}

/**
 * CreateScopeResponse returns the new manifest version.
 */
export interface CreateScopeResponse__Output {
  'manifest_uid': (string);
}
