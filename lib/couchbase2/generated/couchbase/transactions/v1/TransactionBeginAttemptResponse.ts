// Original file: couchbase/transactions/v1/transactions.proto


/**
 * TransactionBeginAttemptResponse contains the identifiers for the new attempt.
 */
export interface TransactionBeginAttemptResponse {
  /**
   * The unique identifier for this transaction.
   */
  'transaction_id'?: (string);
  /**
   * The unique identifier for this specific attempt within the transaction.
   */
  'attempt_id'?: (string);
}

/**
 * TransactionBeginAttemptResponse contains the identifiers for the new attempt.
 */
export interface TransactionBeginAttemptResponse__Output {
  /**
   * The unique identifier for this transaction.
   */
  'transaction_id': (string);
  /**
   * The unique identifier for this specific attempt within the transaction.
   */
  'attempt_id': (string);
}
