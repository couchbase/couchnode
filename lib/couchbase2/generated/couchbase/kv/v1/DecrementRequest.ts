// Original file: couchbase/kv/v1/kv.proto

import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from '../../../google/protobuf/Timestamp';
import type { DurabilityLevel as _couchbase_kv_v1_DurabilityLevel, DurabilityLevel__Output as _couchbase_kv_v1_DurabilityLevel__Output } from '../../../couchbase/kv/v1/DurabilityLevel';
import type { Long } from '@grpc/proto-loader';

/**
 * DecrementRequest atomically decrements a counter document.
 */
export interface DecrementRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'key'?: (string);
  /**
   * The amount to decrement the counter by.
   */
  'delta'?: (number | string | Long);
  'expiry_time'?: (_google_protobuf_Timestamp | null);
  /**
   * If the counter document does not exist, it will be created with this
   * initial value.
   */
  'initial'?: (number | string | Long);
  'durability_level'?: (_couchbase_kv_v1_DurabilityLevel);
  'expiry_secs'?: (number);
  'expiry'?: "expiry_time"|"expiry_secs";
  '_initial'?: "initial";
  '_durability_level'?: "durability_level";
}

/**
 * DecrementRequest atomically decrements a counter document.
 */
export interface DecrementRequest__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  'key': (string);
  /**
   * The amount to decrement the counter by.
   */
  'delta': (string);
  'expiry_time'?: (_google_protobuf_Timestamp__Output | null);
  /**
   * If the counter document does not exist, it will be created with this
   * initial value.
   */
  'initial'?: (string);
  'durability_level'?: (_couchbase_kv_v1_DurabilityLevel__Output);
  'expiry_secs'?: (number);
  'expiry'?: "expiry_time"|"expiry_secs";
  '_initial'?: "initial";
  '_durability_level'?: "durability_level";
}
