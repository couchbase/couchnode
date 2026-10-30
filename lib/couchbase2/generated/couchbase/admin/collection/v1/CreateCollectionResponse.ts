// Original file: couchbase/admin/collection/v1/collection.proto

import type { Long } from '@grpc/proto-loader';

/**
 * CreateCollectionResponse returns the new manifest version.
 */
export interface CreateCollectionResponse {
  'manifest_uid'?: (number | string | Long);
}

/**
 * CreateCollectionResponse returns the new manifest version.
 */
export interface CreateCollectionResponse__Output {
  'manifest_uid': (string);
}
