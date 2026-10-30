// Original file: couchbase/admin/collection/v1/collection.proto

import type { Long } from '@grpc/proto-loader';

/**
 * DeleteCollectionResponse returns the new manifest version.
 */
export interface DeleteCollectionResponse {
  'manifest_uid'?: (number | string | Long);
}

/**
 * DeleteCollectionResponse returns the new manifest version.
 */
export interface DeleteCollectionResponse__Output {
  'manifest_uid': (string);
}
