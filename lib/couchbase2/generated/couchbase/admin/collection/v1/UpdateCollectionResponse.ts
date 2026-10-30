// Original file: couchbase/admin/collection/v1/collection.proto

import type { Long } from '@grpc/proto-loader';

/**
 * UpdateCollectionResponse returns the new manifest version.
 */
export interface UpdateCollectionResponse {
  'manifest_uid'?: (number | string | Long);
}

/**
 * UpdateCollectionResponse returns the new manifest version.
 */
export interface UpdateCollectionResponse__Output {
  'manifest_uid': (string);
}
