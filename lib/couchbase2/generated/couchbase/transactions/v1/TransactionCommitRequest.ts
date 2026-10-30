// Original file: couchbase/transactions/v1/transactions.proto


/**
 * TransactionCommitRequest commits a transaction attempt.
 */
export interface TransactionCommitRequest {
  'bucket_name'?: (string);
  'transaction_id'?: (string);
  'attempt_id'?: (string);
}

/**
 * TransactionCommitRequest commits a transaction attempt.
 */
export interface TransactionCommitRequest__Output {
  'bucket_name': (string);
  'transaction_id': (string);
  'attempt_id': (string);
}
