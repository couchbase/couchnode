// Original file: couchbase/transactions/v1/transactions.proto

import type { Long } from '@grpc/proto-loader';

/**
 * TransactionInsertResponse returns the CAS of the new document.
 */
export interface TransactionInsertResponse {
  'cas'?: (number | string | Long);
}

/**
 * TransactionInsertResponse returns the CAS of the new document.
 */
export interface TransactionInsertResponse__Output {
  'cas': (string);
}
