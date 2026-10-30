// Original file: couchbase/kv/v1/kv.proto

import type { DurabilityLevel as _couchbase_kv_v1_DurabilityLevel, DurabilityLevel__Output as _couchbase_kv_v1_DurabilityLevel__Output } from '../../../couchbase/kv/v1/DurabilityLevel';
import type { Long } from '@grpc/proto-loader';

/**
 * AppendRequest appends raw bytes to the end of an existing document's value.
 */
export interface AppendRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'key'?: (string);
  /**
   * The bytes to append to the existing document value.
   */
  'content'?: (Buffer | Uint8Array | string);
  /**
   * Optional CAS for optimistic concurrency.
   */
  'cas'?: (number | string | Long);
  'durability_level'?: (_couchbase_kv_v1_DurabilityLevel);
  '_cas'?: "cas";
  '_durability_level'?: "durability_level";
}

/**
 * AppendRequest appends raw bytes to the end of an existing document's value.
 */
export interface AppendRequest__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  'key': (string);
  /**
   * The bytes to append to the existing document value.
   */
  'content': (Buffer);
  /**
   * Optional CAS for optimistic concurrency.
   */
  'cas'?: (string);
  'durability_level'?: (_couchbase_kv_v1_DurabilityLevel__Output);
  '_cas'?: "cas";
  '_durability_level'?: "durability_level";
}
