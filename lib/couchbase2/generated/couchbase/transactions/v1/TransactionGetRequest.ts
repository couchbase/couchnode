// Original file: couchbase/transactions/v1/transactions.proto


/**
 * TransactionGetRequest retrieves a document within a transaction.
 */
export interface TransactionGetRequest {
  'bucket_name'?: (string);
  /**
   * transaction_id and attempt_id are optional to allow read-only transactions.
   * clients are not permitted to use this functionality to optimize
   * non-read-only transactions.
   */
  'transaction_id'?: (string);
  'attempt_id'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'key'?: (string);
}

/**
 * TransactionGetRequest retrieves a document within a transaction.
 */
export interface TransactionGetRequest__Output {
  'bucket_name': (string);
  /**
   * transaction_id and attempt_id are optional to allow read-only transactions.
   * clients are not permitted to use this functionality to optimize
   * non-read-only transactions.
   */
  'transaction_id': (string);
  'attempt_id': (string);
  'scope_name': (string);
  'collection_name': (string);
  'key': (string);
}
