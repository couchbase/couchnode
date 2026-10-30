// Original file: couchbase/transactions/v1/transactions.proto

import type { Long } from '@grpc/proto-loader';

/**
 * TransactionReplaceRequest replaces an existing document within the
 * transaction.
 */
export interface TransactionReplaceRequest {
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
  /**
   * The new document body.
   */
  'value'?: (Buffer | Uint8Array | string);
}

/**
 * TransactionReplaceRequest replaces an existing document within the
 * transaction.
 */
export interface TransactionReplaceRequest__Output {
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
  /**
   * The new document body.
   */
  'value': (Buffer);
}
