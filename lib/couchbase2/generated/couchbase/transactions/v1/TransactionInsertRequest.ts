// Original file: couchbase/transactions/v1/transactions.proto


/**
 * TransactionInsertRequest creates a new document within the transaction.
 */
export interface TransactionInsertRequest {
  'bucket_name'?: (string);
  'transaction_id'?: (string);
  'attempt_id'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'key'?: (string);
  /**
   * The document body to store.
   */
  'value'?: (Buffer | Uint8Array | string);
}

/**
 * TransactionInsertRequest creates a new document within the transaction.
 */
export interface TransactionInsertRequest__Output {
  'bucket_name': (string);
  'transaction_id': (string);
  'attempt_id': (string);
  'scope_name': (string);
  'collection_name': (string);
  'key': (string);
  /**
   * The document body to store.
   */
  'value': (Buffer);
}
