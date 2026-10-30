// Original file: couchbase/transactions/v1/transactions.proto

import type { Long } from '@grpc/proto-loader';

/**
 * TransactionRemoveRequest removes a document within the transaction.
 */
export interface TransactionRemoveRequest {
  'bucket_name'?: (string);
  'transaction_id'?: (string);
  'attempt_id'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'key'?: (string);
  /**
   * The CAS from a prior TransactionGet. Required for concurrency control.
   */
  'cas'?: (number | string | Long);
}

/**
 * TransactionRemoveRequest removes a document within the transaction.
 */
export interface TransactionRemoveRequest__Output {
  'bucket_name': (string);
  'transaction_id': (string);
  'attempt_id': (string);
  'scope_name': (string);
  'collection_name': (string);
  'key': (string);
  /**
   * The CAS from a prior TransactionGet. Required for concurrency control.
   */
  'cas': (string);
}
