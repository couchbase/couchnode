// Original file: couchbase/kv/v1/kv.proto

import type { MutationToken as _couchbase_kv_v1_MutationToken, MutationToken__Output as _couchbase_kv_v1_MutationToken__Output } from '../../../couchbase/kv/v1/MutationToken';
import type { Long } from '@grpc/proto-loader';

/**
 * Spec contains the result for a single mutation. Content is only
 * populated for counter operations (returns the new counter value).
 */
export interface _couchbase_kv_v1_MutateInResponse_Spec {
  'content'?: (Buffer | Uint8Array | string);
  '_content'?: "content";
}

/**
 * Spec contains the result for a single mutation. Content is only
 * populated for counter operations (returns the new counter value).
 */
export interface _couchbase_kv_v1_MutateInResponse_Spec__Output {
  'content'?: (Buffer);
  '_content'?: "content";
}

/**
 * MutateInResponse contains the results of sub-document mutation operations.
 */
export interface MutateInResponse {
  /**
   * Results corresponding 1:1 to the specs in the request.
   */
  'specs'?: (_couchbase_kv_v1_MutateInResponse_Spec)[];
  'cas'?: (number | string | Long);
  'mutation_token'?: (_couchbase_kv_v1_MutationToken | null);
}

/**
 * MutateInResponse contains the results of sub-document mutation operations.
 */
export interface MutateInResponse__Output {
  /**
   * Results corresponding 1:1 to the specs in the request.
   */
  'specs': (_couchbase_kv_v1_MutateInResponse_Spec__Output)[];
  'cas': (string);
  'mutation_token': (_couchbase_kv_v1_MutationToken__Output | null);
}
