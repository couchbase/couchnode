// Original file: couchbase/internal/xdcr/v1/xdcr.proto

import type { Long } from '@grpc/proto-loader';

/**
 * PushDocumentResponse returns the CAS and seqno assigned on the target.
 */
export interface PushDocumentResponse {
  /**
   * The CAS assigned to the document on the target cluster.
   */
  'cas'?: (number | string | Long);
  /**
   * The sequence number assigned on the target vbucket.
   */
  'seqno'?: (number | string | Long);
}

/**
 * PushDocumentResponse returns the CAS and seqno assigned on the target.
 */
export interface PushDocumentResponse__Output {
  /**
   * The CAS assigned to the document on the target cluster.
   */
  'cas': (string);
  /**
   * The sequence number assigned on the target vbucket.
   */
  'seqno': (string);
}
