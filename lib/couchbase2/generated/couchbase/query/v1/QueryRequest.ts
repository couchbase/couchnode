// Original file: couchbase/query/v1/query.proto

import type { MutationToken as _couchbase_kv_v1_MutationToken, MutationToken__Output as _couchbase_kv_v1_MutationToken__Output } from '../../../couchbase/kv/v1/MutationToken';
import type { Duration as _google_protobuf_Duration, Duration__Output as _google_protobuf_Duration__Output } from '../../../google/protobuf/Duration';

// Original file: couchbase/query/v1/query.proto

/**
 * DurabilityLevel for mutations performed by this query.
 */
export const _couchbase_query_v1_QueryRequest_DurabilityLevel = {
  /**
   * No durability requirements (default).
   */
  DURABILITY_LEVEL_NONE: 'DURABILITY_LEVEL_NONE',
  /**
   * Replicate to a majority of data service nodes.
   */
  DURABILITY_LEVEL_MAJORITY: 'DURABILITY_LEVEL_MAJORITY',
  /**
   * Replicate to majority and persist to the active node.
   */
  DURABILITY_LEVEL_MAJORITY_AND_PERSIST_TO_ACTIVE: 'DURABILITY_LEVEL_MAJORITY_AND_PERSIST_TO_ACTIVE',
  /**
   * Persist to a majority of data service nodes.
   */
  DURABILITY_LEVEL_PERSIST_TO_MAJORITY: 'DURABILITY_LEVEL_PERSIST_TO_MAJORITY',
} as const;

/**
 * DurabilityLevel for mutations performed by this query.
 */
export type _couchbase_query_v1_QueryRequest_DurabilityLevel =
  /**
   * No durability requirements (default).
   */
  | 'DURABILITY_LEVEL_NONE'
  | 0
  /**
   * Replicate to a majority of data service nodes.
   */
  | 'DURABILITY_LEVEL_MAJORITY'
  | 1
  /**
   * Replicate to majority and persist to the active node.
   */
  | 'DURABILITY_LEVEL_MAJORITY_AND_PERSIST_TO_ACTIVE'
  | 2
  /**
   * Persist to a majority of data service nodes.
   */
  | 'DURABILITY_LEVEL_PERSIST_TO_MAJORITY'
  | 3

/**
 * DurabilityLevel for mutations performed by this query.
 */
export type _couchbase_query_v1_QueryRequest_DurabilityLevel__Output = typeof _couchbase_query_v1_QueryRequest_DurabilityLevel[keyof typeof _couchbase_query_v1_QueryRequest_DurabilityLevel]

// Original file: couchbase/query/v1/query.proto

/**
 * ProfileMode controls the level of query profiling information returned.
 */
export const _couchbase_query_v1_QueryRequest_ProfileMode = {
  /**
   * No profiling.
   */
  PROFILE_MODE_OFF: 'PROFILE_MODE_OFF',
  /**
   * Profile execution phases.
   */
  PROFILE_MODE_PHASES: 'PROFILE_MODE_PHASES',
  /**
   * Profile individual operator timings.
   */
  PROFILE_MODE_TIMINGS: 'PROFILE_MODE_TIMINGS',
} as const;

/**
 * ProfileMode controls the level of query profiling information returned.
 */
export type _couchbase_query_v1_QueryRequest_ProfileMode =
  /**
   * No profiling.
   */
  | 'PROFILE_MODE_OFF'
  | 0
  /**
   * Profile execution phases.
   */
  | 'PROFILE_MODE_PHASES'
  | 1
  /**
   * Profile individual operator timings.
   */
  | 'PROFILE_MODE_TIMINGS'
  | 2

/**
 * ProfileMode controls the level of query profiling information returned.
 */
export type _couchbase_query_v1_QueryRequest_ProfileMode__Output = typeof _couchbase_query_v1_QueryRequest_ProfileMode[keyof typeof _couchbase_query_v1_QueryRequest_ProfileMode]

// Original file: couchbase/query/v1/query.proto

/**
 * ScanConsistency controls index consistency guarantees.
 */
export const _couchbase_query_v1_QueryRequest_ScanConsistency = {
  /**
   * No consistency required — fastest, but may return stale results.
   */
  SCAN_CONSISTENCY_NOT_BOUNDED: 'SCAN_CONSISTENCY_NOT_BOUNDED',
  /**
   * Wait for all prior mutations to be indexed before executing.
   */
  SCAN_CONSISTENCY_REQUEST_PLUS: 'SCAN_CONSISTENCY_REQUEST_PLUS',
} as const;

/**
 * ScanConsistency controls index consistency guarantees.
 */
export type _couchbase_query_v1_QueryRequest_ScanConsistency =
  /**
   * No consistency required — fastest, but may return stale results.
   */
  | 'SCAN_CONSISTENCY_NOT_BOUNDED'
  | 0
  /**
   * Wait for all prior mutations to be indexed before executing.
   */
  | 'SCAN_CONSISTENCY_REQUEST_PLUS'
  | 1

/**
 * ScanConsistency controls index consistency guarantees.
 */
export type _couchbase_query_v1_QueryRequest_ScanConsistency__Output = typeof _couchbase_query_v1_QueryRequest_ScanConsistency[keyof typeof _couchbase_query_v1_QueryRequest_ScanConsistency]

/**
 * TuningOptions controls query engine resource usage and timing.
 */
export interface _couchbase_query_v1_QueryRequest_TuningOptions {
  /**
   * Maximum number of index partitions to scan in parallel.
   */
  'max_parallelism'?: (number);
  /**
   * Number of items in a batch for query pipeline processing.
   */
  'pipeline_batch'?: (number);
  /**
   * Maximum number of items in the query pipeline queue.
   */
  'pipeline_cap'?: (number);
  /**
   * Maximum time to wait for index consistency (for scan_consistency).
   */
  'scan_wait'?: (_google_protobuf_Duration | null);
  /**
   * Maximum number of index entries to scan per partition.
   */
  'scan_cap'?: (number);
  /**
   * When true, metrics are not collected for this query.
   */
  'disable_metrics'?: (boolean);
  '_max_parallelism'?: "max_parallelism";
  '_pipeline_batch'?: "pipeline_batch";
  '_pipeline_cap'?: "pipeline_cap";
  '_scan_wait'?: "scan_wait";
  '_scan_cap'?: "scan_cap";
  '_disable_metrics'?: "disable_metrics";
}

/**
 * TuningOptions controls query engine resource usage and timing.
 */
export interface _couchbase_query_v1_QueryRequest_TuningOptions__Output {
  /**
   * Maximum number of index partitions to scan in parallel.
   */
  'max_parallelism'?: (number);
  /**
   * Number of items in a batch for query pipeline processing.
   */
  'pipeline_batch'?: (number);
  /**
   * Maximum number of items in the query pipeline queue.
   */
  'pipeline_cap'?: (number);
  /**
   * Maximum time to wait for index consistency (for scan_consistency).
   */
  'scan_wait'?: (_google_protobuf_Duration__Output | null);
  /**
   * Maximum number of index entries to scan per partition.
   */
  'scan_cap'?: (number);
  /**
   * When true, metrics are not collected for this query.
   */
  'disable_metrics'?: (boolean);
  '_max_parallelism'?: "max_parallelism";
  '_pipeline_batch'?: "pipeline_batch";
  '_pipeline_cap'?: "pipeline_cap";
  '_scan_wait'?: "scan_wait";
  '_scan_cap'?: "scan_cap";
  '_disable_metrics'?: "disable_metrics";
}

/**
 * QueryRequest contains the N1QL statement and all execution options.
 */
export interface QueryRequest {
  /**
   * The bucket to scope the query to. Optional for cluster-level queries.
   */
  'bucket_name'?: (string);
  /**
   * The scope within the bucket. Only meaningful when bucket_name is set.
   */
  'scope_name'?: (string);
  /**
   * The N1QL (SQL++) statement to execute.
   */
  'statement'?: (string);
  /**
   * When true, the query is read-only and will not modify any data.
   */
  'read_only'?: (boolean);
  /**
   * When true, the query engine uses a prepared (cached) form of the statement.
   */
  'prepared'?: (boolean);
  'tuning_options'?: (_couchbase_query_v1_QueryRequest_TuningOptions | null);
  /**
   * An opaque identifier for this request, echoed back in the response
   * for client-side correlation.
   */
  'client_context_id'?: (string);
  'scan_consistency'?: (_couchbase_query_v1_QueryRequest_ScanConsistency);
  /**
   * Positional parameters for parameterized queries ($1, $2, etc.).
   * Each element is a JSON-encoded value.
   */
  'positional_parameters'?: (Buffer | Uint8Array | string)[];
  /**
   * Named parameters for parameterized queries ($name).
   * Keys are parameter names, values are JSON-encoded.
   */
  'named_parameters'?: ({[key: string]: Buffer | Uint8Array | string});
  /**
   * When true, use a flex index (full-text search index) for the query.
   */
  'flex_index'?: (boolean);
  /**
   * When true, preserve document expiry on mutations performed by this query.
   */
  'preserve_expiry'?: (boolean);
  /**
   * Mutation tokens from prior KV operations. Provides at_plus (read-your-
   * own-writes) consistency — the query will wait until these mutations
   * are indexed.
   */
  'consistent_with'?: (_couchbase_kv_v1_MutationToken)[];
  'profile_mode'?: (_couchbase_query_v1_QueryRequest_ProfileMode);
  'durability_level'?: (_couchbase_query_v1_QueryRequest_DurabilityLevel);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
  '_read_only'?: "read_only";
  '_prepared'?: "prepared";
  '_tuning_options'?: "tuning_options";
  '_client_context_id'?: "client_context_id";
  '_scan_consistency'?: "scan_consistency";
  '_flex_index'?: "flex_index";
  '_preserve_expiry'?: "preserve_expiry";
  '_durability_level'?: "durability_level";
  '_profile_mode'?: "profile_mode";
}

/**
 * QueryRequest contains the N1QL statement and all execution options.
 */
export interface QueryRequest__Output {
  /**
   * The bucket to scope the query to. Optional for cluster-level queries.
   */
  'bucket_name'?: (string);
  /**
   * The scope within the bucket. Only meaningful when bucket_name is set.
   */
  'scope_name'?: (string);
  /**
   * The N1QL (SQL++) statement to execute.
   */
  'statement': (string);
  /**
   * When true, the query is read-only and will not modify any data.
   */
  'read_only'?: (boolean);
  /**
   * When true, the query engine uses a prepared (cached) form of the statement.
   */
  'prepared'?: (boolean);
  'tuning_options'?: (_couchbase_query_v1_QueryRequest_TuningOptions__Output | null);
  /**
   * An opaque identifier for this request, echoed back in the response
   * for client-side correlation.
   */
  'client_context_id'?: (string);
  'scan_consistency'?: (_couchbase_query_v1_QueryRequest_ScanConsistency__Output);
  /**
   * Positional parameters for parameterized queries ($1, $2, etc.).
   * Each element is a JSON-encoded value.
   */
  'positional_parameters': (Buffer)[];
  /**
   * Named parameters for parameterized queries ($name).
   * Keys are parameter names, values are JSON-encoded.
   */
  'named_parameters': ({[key: string]: Buffer});
  /**
   * When true, use a flex index (full-text search index) for the query.
   */
  'flex_index'?: (boolean);
  /**
   * When true, preserve document expiry on mutations performed by this query.
   */
  'preserve_expiry'?: (boolean);
  /**
   * Mutation tokens from prior KV operations. Provides at_plus (read-your-
   * own-writes) consistency — the query will wait until these mutations
   * are indexed.
   */
  'consistent_with': (_couchbase_kv_v1_MutationToken__Output)[];
  'profile_mode'?: (_couchbase_query_v1_QueryRequest_ProfileMode__Output);
  'durability_level'?: (_couchbase_query_v1_QueryRequest_DurabilityLevel__Output);
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
  '_read_only'?: "read_only";
  '_prepared'?: "prepared";
  '_tuning_options'?: "tuning_options";
  '_client_context_id'?: "client_context_id";
  '_scan_consistency'?: "scan_consistency";
  '_flex_index'?: "flex_index";
  '_preserve_expiry'?: "preserve_expiry";
  '_durability_level'?: "durability_level";
  '_profile_mode'?: "profile_mode";
}
