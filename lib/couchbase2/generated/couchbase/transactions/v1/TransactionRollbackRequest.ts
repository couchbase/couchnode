// Original file: couchbase/transactions/v1/transactions.proto


/**
 * TransactionRollbackRequest rolls back a transaction attempt.
 */
export interface TransactionRollbackRequest {
  'bucket_name'?: (string);
  'transaction_id'?: (string);
  'attempt_id'?: (string);
}

/**
 * TransactionRollbackRequest rolls back a transaction attempt.
 */
export interface TransactionRollbackRequest__Output {
  'bucket_name': (string);
  'transaction_id': (string);
  'attempt_id': (string);
}
