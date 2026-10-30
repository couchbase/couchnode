// Original file: couchbase/transactions/v1/transactions.proto

import type { Long } from '@grpc/proto-loader';

/**
 * TransactionGetResponse returns the document content and CAS.
 */
export interface TransactionGetResponse {
  /**
   * The CAS value, required for subsequent Replace or Remove operations.
   */
  'cas'?: (number | string | Long);
  /**
   * The document body as raw bytes.
   */
  'value'?: (Buffer | Uint8Array | string);
}

/**
 * TransactionGetResponse returns the document content and CAS.
 */
export interface TransactionGetResponse__Output {
  /**
   * The CAS value, required for subsequent Replace or Remove operations.
   */
  'cas': (string);
  /**
   * The document body as raw bytes.
   */
  'value': (Buffer);
}
