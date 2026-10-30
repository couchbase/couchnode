// Original file: couchbase/transactions/v1/transactions.proto

import type { Long } from '@grpc/proto-loader';

/**
 * TransactionReplaceResponse returns the new CAS.
 */
export interface TransactionReplaceResponse {
  'cas'?: (number | string | Long);
}

/**
 * TransactionReplaceResponse returns the new CAS.
 */
export interface TransactionReplaceResponse__Output {
  'cas': (string);
}
