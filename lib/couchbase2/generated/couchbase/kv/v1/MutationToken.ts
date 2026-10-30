// Original file: couchbase/kv/v1/kv.proto

import type { Long } from '@grpc/proto-loader';

/**
 * MutationToken represents a point-in-time marker for a mutation on a specific
 * vbucket. Used for read-your-own-writes consistency (e.g., at_plus scan
 * consistency in query services).
 */
export interface MutationToken {
  /**
   * The bucket in which the mutation occurred.
   */
  'bucket_name'?: (string);
  /**
   * The vbucket where the mutation was applied.
   */
  'vbucket_id'?: (number);
  /**
   * The UUID of the vbucket at the time of mutation.
   */
  'vbucket_uuid'?: (number | string | Long);
  /**
   * The sequence number assigned to the mutation.
   */
  'seq_no'?: (number | string | Long);
}

/**
 * MutationToken represents a point-in-time marker for a mutation on a specific
 * vbucket. Used for read-your-own-writes consistency (e.g., at_plus scan
 * consistency in query services).
 */
export interface MutationToken__Output {
  /**
   * The bucket in which the mutation occurred.
   */
  'bucket_name': (string);
  /**
   * The vbucket where the mutation was applied.
   */
  'vbucket_id': (number);
  /**
   * The UUID of the vbucket at the time of mutation.
   */
  'vbucket_uuid': (string);
  /**
   * The sequence number assigned to the mutation.
   */
  'seq_no': (string);
}
