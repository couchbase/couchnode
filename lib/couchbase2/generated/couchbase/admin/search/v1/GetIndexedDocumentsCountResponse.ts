// Original file: couchbase/admin/search/v1/search.proto

import type { Long } from '@grpc/proto-loader';

/**
 * GetIndexedDocumentsCountResponse returns the count.
 */
export interface GetIndexedDocumentsCountResponse {
  'count'?: (number | string | Long);
}

/**
 * GetIndexedDocumentsCountResponse returns the count.
 */
export interface GetIndexedDocumentsCountResponse__Output {
  'count': (string);
}
