// Original file: couchbase/kv/v1/kv.proto

import type { MutationToken as _couchbase_kv_v1_MutationToken, MutationToken__Output as _couchbase_kv_v1_MutationToken__Output } from '../../../couchbase/kv/v1/MutationToken';
import type { Long } from '@grpc/proto-loader';

/**
 * DecrementResponse returns the new counter value after decrementing.
 */
export interface DecrementResponse {
  'cas'?: (number | string | Long);
  /**
   * The counter value after the decrement operation.
   */
  'content'?: (number | string | Long);
  'mutation_token'?: (_couchbase_kv_v1_MutationToken | null);
}

/**
 * DecrementResponse returns the new counter value after decrementing.
 */
export interface DecrementResponse__Output {
  'cas': (string);
  /**
   * The counter value after the decrement operation.
   */
  'content': (string);
  'mutation_token': (_couchbase_kv_v1_MutationToken__Output | null);
}
