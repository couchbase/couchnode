// Original file: couchbase/kv/v1/kv.proto

import type { Long } from '@grpc/proto-loader';

/**
 * ExistsResponse indicates whether the document exists.
 */
export interface ExistsResponse {
  /**
   * True if the document exists.
   */
  'result'?: (boolean);
  /**
   * The current CAS value of the document, if it exists.
   */
  'cas'?: (number | string | Long);
}

/**
 * ExistsResponse indicates whether the document exists.
 */
export interface ExistsResponse__Output {
  /**
   * True if the document exists.
   */
  'result': (boolean);
  /**
   * The current CAS value of the document, if it exists.
   */
  'cas': (string);
}
