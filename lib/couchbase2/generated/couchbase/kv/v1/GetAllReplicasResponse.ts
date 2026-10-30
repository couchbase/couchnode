// Original file: couchbase/kv/v1/kv.proto

import type { Long } from '@grpc/proto-loader';

/**
 * GetAllReplicasResponse is streamed once per node (active + replicas).
 */
export interface GetAllReplicasResponse {
  /**
   * True if this response came from a replica node, false if from the active.
   */
  'is_replica'?: (boolean);
  'content'?: (Buffer | Uint8Array | string);
  'content_flags'?: (number);
  'cas'?: (number | string | Long);
}

/**
 * GetAllReplicasResponse is streamed once per node (active + replicas).
 */
export interface GetAllReplicasResponse__Output {
  /**
   * True if this response came from a replica node, false if from the active.
   */
  'is_replica': (boolean);
  'content': (Buffer);
  'content_flags': (number);
  'cas': (string);
}
