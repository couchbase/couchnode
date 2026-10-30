// Original file: couchbase/transactions/v1/transactions.proto


/**
 * TransactionBeginAttemptRequest starts a new transaction attempt.
 */
export interface TransactionBeginAttemptRequest {
  /**
   * The bucket to use for transaction metadata storage.
   */
  'bucket_name'?: (string);
  /**
   * Optional. When provided, this begins a retry attempt for an existing
   * transaction rather than starting a brand-new transaction.
   */
  'transaction_id'?: (string);
  '_transaction_id'?: "transaction_id";
}

/**
 * TransactionBeginAttemptRequest starts a new transaction attempt.
 */
export interface TransactionBeginAttemptRequest__Output {
  /**
   * The bucket to use for transaction metadata storage.
   */
  'bucket_name': (string);
  /**
   * Optional. When provided, this begins a retry attempt for an existing
   * transaction rather than starting a brand-new transaction.
   */
  'transaction_id'?: (string);
  '_transaction_id'?: "transaction_id";
}
