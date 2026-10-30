// Original file: couchbase/kv/v1/kv.proto

import type { DurabilityLevel as _couchbase_kv_v1_DurabilityLevel, DurabilityLevel__Output as _couchbase_kv_v1_DurabilityLevel__Output } from '../../../couchbase/kv/v1/DurabilityLevel';
import type { Long } from '@grpc/proto-loader';

/**
 * RemoveRequest deletes a document by key.
 */
export interface RemoveRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'key'?: (string);
  /**
   * Optional CAS for optimistic concurrency control.
   */
  'cas'?: (number | string | Long);
  'durability_level'?: (_couchbase_kv_v1_DurabilityLevel);
  '_cas'?: "cas";
  '_durability_level'?: "durability_level";
}

/**
 * RemoveRequest deletes a document by key.
 */
export interface RemoveRequest__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  'key': (string);
  /**
   * Optional CAS for optimistic concurrency control.
   */
  'cas'?: (string);
  'durability_level'?: (_couchbase_kv_v1_DurabilityLevel__Output);
  '_cas'?: "cas";
  '_durability_level'?: "durability_level";
}
