// Original file: couchbase/kv/v1/kv.proto

import type { DurabilityLevel as _couchbase_kv_v1_DurabilityLevel, DurabilityLevel__Output as _couchbase_kv_v1_DurabilityLevel__Output } from '../../../couchbase/kv/v1/DurabilityLevel';
import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from '../../../google/protobuf/Timestamp';
import type { Long } from '@grpc/proto-loader';

/**
 * Flags for this individual spec.
 */
export interface _couchbase_kv_v1_MutateInRequest_Spec_Flags {
  /**
   * When true, intermediate path elements are created if they don't exist.
   */
  'create_path'?: (boolean);
  /**
   * When true, operate on an extended attribute (xattr).
   */
  'xattr'?: (boolean);
  '_create_path'?: "create_path";
  '_xattr'?: "xattr";
}

/**
 * Flags for this individual spec.
 */
export interface _couchbase_kv_v1_MutateInRequest_Spec_Flags__Output {
  /**
   * When true, intermediate path elements are created if they don't exist.
   */
  'create_path'?: (boolean);
  /**
   * When true, operate on an extended attribute (xattr).
   */
  'xattr'?: (boolean);
  '_create_path'?: "create_path";
  '_xattr'?: "xattr";
}

/**
 * Document-level flags.
 */
export interface _couchbase_kv_v1_MutateInRequest_Flags {
  /**
   * When true, allow mutations on deleted (tombstoned) documents.
   */
  'access_deleted'?: (boolean);
  '_access_deleted'?: "access_deleted";
}

/**
 * Document-level flags.
 */
export interface _couchbase_kv_v1_MutateInRequest_Flags__Output {
  /**
   * When true, allow mutations on deleted (tombstoned) documents.
   */
  'access_deleted'?: (boolean);
  '_access_deleted'?: "access_deleted";
}

// Original file: couchbase/kv/v1/kv.proto

/**
 * The type of sub-document mutation to perform.
 */
export const _couchbase_kv_v1_MutateInRequest_Spec_Operation = {
  /**
   * Insert a value at the specified path (fails if path exists).
   */
  OPERATION_INSERT: 'OPERATION_INSERT',
  /**
   * Insert or replace a value at the specified path.
   */
  OPERATION_UPSERT: 'OPERATION_UPSERT',
  /**
   * Replace a value at the specified path (fails if path doesn't exist).
   */
  OPERATION_REPLACE: 'OPERATION_REPLACE',
  /**
   * Remove the value at the specified path.
   */
  OPERATION_REMOVE: 'OPERATION_REMOVE',
  /**
   * Append a value to the end of an array.
   */
  OPERATION_ARRAY_APPEND: 'OPERATION_ARRAY_APPEND',
  /**
   * Prepend a value to the beginning of an array.
   */
  OPERATION_ARRAY_PREPEND: 'OPERATION_ARRAY_PREPEND',
  /**
   * Insert a value at a specific index in an array.
   */
  OPERATION_ARRAY_INSERT: 'OPERATION_ARRAY_INSERT',
  /**
   * Add a value to an array only if it doesn't already exist.
   */
  OPERATION_ARRAY_ADD_UNIQUE: 'OPERATION_ARRAY_ADD_UNIQUE',
  /**
   * Increment or decrement a numeric value at the specified path.
   */
  OPERATION_COUNTER: 'OPERATION_COUNTER',
} as const;

/**
 * The type of sub-document mutation to perform.
 */
export type _couchbase_kv_v1_MutateInRequest_Spec_Operation =
  /**
   * Insert a value at the specified path (fails if path exists).
   */
  | 'OPERATION_INSERT'
  | 0
  /**
   * Insert or replace a value at the specified path.
   */
  | 'OPERATION_UPSERT'
  | 1
  /**
   * Replace a value at the specified path (fails if path doesn't exist).
   */
  | 'OPERATION_REPLACE'
  | 2
  /**
   * Remove the value at the specified path.
   */
  | 'OPERATION_REMOVE'
  | 3
  /**
   * Append a value to the end of an array.
   */
  | 'OPERATION_ARRAY_APPEND'
  | 4
  /**
   * Prepend a value to the beginning of an array.
   */
  | 'OPERATION_ARRAY_PREPEND'
  | 5
  /**
   * Insert a value at a specific index in an array.
   */
  | 'OPERATION_ARRAY_INSERT'
  | 6
  /**
   * Add a value to an array only if it doesn't already exist.
   */
  | 'OPERATION_ARRAY_ADD_UNIQUE'
  | 7
  /**
   * Increment or decrement a numeric value at the specified path.
   */
  | 'OPERATION_COUNTER'
  | 8

/**
 * The type of sub-document mutation to perform.
 */
export type _couchbase_kv_v1_MutateInRequest_Spec_Operation__Output = typeof _couchbase_kv_v1_MutateInRequest_Spec_Operation[keyof typeof _couchbase_kv_v1_MutateInRequest_Spec_Operation]

/**
 * Spec defines a single sub-document mutation operation.
 */
export interface _couchbase_kv_v1_MutateInRequest_Spec {
  'operation'?: (_couchbase_kv_v1_MutateInRequest_Spec_Operation);
  /**
   * The JSON path to operate on.
   */
  'path'?: (string);
  /**
   * The value to apply (interpretation depends on the operation).
   */
  'content'?: (Buffer | Uint8Array | string);
  'flags'?: (_couchbase_kv_v1_MutateInRequest_Spec_Flags | null);
  '_flags'?: "flags";
}

/**
 * Spec defines a single sub-document mutation operation.
 */
export interface _couchbase_kv_v1_MutateInRequest_Spec__Output {
  'operation': (_couchbase_kv_v1_MutateInRequest_Spec_Operation__Output);
  /**
   * The JSON path to operate on.
   */
  'path': (string);
  /**
   * The value to apply (interpretation depends on the operation).
   */
  'content': (Buffer);
  'flags'?: (_couchbase_kv_v1_MutateInRequest_Spec_Flags__Output | null);
  '_flags'?: "flags";
}

// Original file: couchbase/kv/v1/kv.proto

/**
 * StoreSemantic controls the document-level behavior of the mutation.
 */
export const _couchbase_kv_v1_MutateInRequest_StoreSemantic = {
  /**
   * The document must already exist (default).
   */
  STORE_SEMANTIC_REPLACE: 'STORE_SEMANTIC_REPLACE',
  /**
   * Create the document if it doesn't exist, or update if it does.
   */
  STORE_SEMANTIC_UPSERT: 'STORE_SEMANTIC_UPSERT',
  /**
   * Create the document only if it doesn't exist (fail otherwise).
   */
  STORE_SEMANTIC_INSERT: 'STORE_SEMANTIC_INSERT',
} as const;

/**
 * StoreSemantic controls the document-level behavior of the mutation.
 */
export type _couchbase_kv_v1_MutateInRequest_StoreSemantic =
  /**
   * The document must already exist (default).
   */
  | 'STORE_SEMANTIC_REPLACE'
  | 0
  /**
   * Create the document if it doesn't exist, or update if it does.
   */
  | 'STORE_SEMANTIC_UPSERT'
  | 1
  /**
   * Create the document only if it doesn't exist (fail otherwise).
   */
  | 'STORE_SEMANTIC_INSERT'
  | 2

/**
 * StoreSemantic controls the document-level behavior of the mutation.
 */
export type _couchbase_kv_v1_MutateInRequest_StoreSemantic__Output = typeof _couchbase_kv_v1_MutateInRequest_StoreSemantic[keyof typeof _couchbase_kv_v1_MutateInRequest_StoreSemantic]

/**
 * MutateInRequest performs sub-document mutation operations on a JSON document.
 * Multiple mutation specs can be executed atomically in a single request.
 */
export interface MutateInRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'key'?: (string);
  /**
   * The list of sub-document mutations to perform atomically.
   */
  'specs'?: (_couchbase_kv_v1_MutateInRequest_Spec)[];
  'store_semantic'?: (_couchbase_kv_v1_MutateInRequest_StoreSemantic);
  'durability_level'?: (_couchbase_kv_v1_DurabilityLevel);
  /**
   * Optional CAS for optimistic concurrency on the full document.
   */
  'cas'?: (number | string | Long);
  'flags'?: (_couchbase_kv_v1_MutateInRequest_Flags | null);
  'expiry_time'?: (_google_protobuf_Timestamp | null);
  'expiry_secs'?: (number);
  '_store_semantic'?: "store_semantic";
  '_durability_level'?: "durability_level";
  '_cas'?: "cas";
  '_flags'?: "flags";
  /**
   * Optional expiry to set on the document.
   */
  'expiry'?: "expiry_time"|"expiry_secs";
}

/**
 * MutateInRequest performs sub-document mutation operations on a JSON document.
 * Multiple mutation specs can be executed atomically in a single request.
 */
export interface MutateInRequest__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  'key': (string);
  /**
   * The list of sub-document mutations to perform atomically.
   */
  'specs': (_couchbase_kv_v1_MutateInRequest_Spec__Output)[];
  'store_semantic'?: (_couchbase_kv_v1_MutateInRequest_StoreSemantic__Output);
  'durability_level'?: (_couchbase_kv_v1_DurabilityLevel__Output);
  /**
   * Optional CAS for optimistic concurrency on the full document.
   */
  'cas'?: (string);
  'flags'?: (_couchbase_kv_v1_MutateInRequest_Flags__Output | null);
  'expiry_time'?: (_google_protobuf_Timestamp__Output | null);
  'expiry_secs'?: (number);
  '_store_semantic'?: "store_semantic";
  '_durability_level'?: "durability_level";
  '_cas'?: "cas";
  '_flags'?: "flags";
  /**
   * Optional expiry to set on the document.
   */
  'expiry'?: "expiry_time"|"expiry_secs";
}
