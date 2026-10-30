// Original file: couchbase/kv/v1/kv.proto

import type { MutationToken as _couchbase_kv_v1_MutationToken, MutationToken__Output as _couchbase_kv_v1_MutationToken__Output } from '../../../couchbase/kv/v1/MutationToken';
import type { Long } from '@grpc/proto-loader';

/**
 * TouchResponse returns the updated CAS and mutation token.
 */
export interface TouchResponse {
  'cas'?: (number | string | Long);
  'mutation_token'?: (_couchbase_kv_v1_MutationToken | null);
}

/**
 * TouchResponse returns the updated CAS and mutation token.
 */
export interface TouchResponse__Output {
  'cas': (string);
  'mutation_token': (_couchbase_kv_v1_MutationToken__Output | null);
}
