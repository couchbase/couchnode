// Original file: couchbase/transactions/v1/transactions.proto

import type { Long } from '@grpc/proto-loader';

/**
 * TransactionRemoveResponse returns the resulting CAS.
 */
export interface TransactionRemoveResponse {
  'cas'?: (number | string | Long);
}

/**
 * TransactionRemoveResponse returns the resulting CAS.
 */
export interface TransactionRemoveResponse__Output {
  'cas': (string);
}
