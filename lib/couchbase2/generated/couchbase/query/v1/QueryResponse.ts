// Original file: couchbase/query/v1/query.proto

import type { Duration as _google_protobuf_Duration, Duration__Output as _google_protobuf_Duration__Output } from '../../../google/protobuf/Duration';
import type { Long } from '@grpc/proto-loader';

/**
 * MetaData is included in the final streamed response and contains
 * execution status, metrics, warnings, and profile information.
 */
export interface _couchbase_query_v1_QueryResponse_MetaData {
  /**
   * The unique identifier assigned to this query by the server.
   */
  'request_id'?: (string);
  /**
   * The client_context_id echoed back from the request.
   */
  'client_context_id'?: (string);
  'metrics'?: (_couchbase_query_v1_QueryResponse_MetaData_Metrics | null);
  'status'?: (_couchbase_query_v1_QueryResponse_MetaData_Status);
  'warnings'?: (_couchbase_query_v1_QueryResponse_MetaData_Warning)[];
  /**
   * Profiling information, when requested via profile_mode. JSON-encoded.
   */
  'profile'?: (Buffer | Uint8Array | string);
  /**
   * The schema signature of the results. JSON-encoded.
   */
  'signature'?: (Buffer | Uint8Array | string);
  '_metrics'?: "metrics";
  '_profile'?: "profile";
}

/**
 * MetaData is included in the final streamed response and contains
 * execution status, metrics, warnings, and profile information.
 */
export interface _couchbase_query_v1_QueryResponse_MetaData__Output {
  /**
   * The unique identifier assigned to this query by the server.
   */
  'request_id': (string);
  /**
   * The client_context_id echoed back from the request.
   */
  'client_context_id': (string);
  'metrics'?: (_couchbase_query_v1_QueryResponse_MetaData_Metrics__Output | null);
  'status': (_couchbase_query_v1_QueryResponse_MetaData_Status__Output);
  'warnings': (_couchbase_query_v1_QueryResponse_MetaData_Warning__Output)[];
  /**
   * Profiling information, when requested via profile_mode. JSON-encoded.
   */
  'profile'?: (Buffer);
  /**
   * The schema signature of the results. JSON-encoded.
   */
  'signature': (Buffer);
  '_metrics'?: "metrics";
  '_profile'?: "profile";
}

/**
 * Metrics contains execution timing and count statistics.
 */
export interface _couchbase_query_v1_QueryResponse_MetaData_Metrics {
  /**
   * Total wall-clock time for the query.
   */
  'elapsed_time'?: (_google_protobuf_Duration | null);
  /**
   * Time spent executing the query (excludes queue wait).
   */
  'execution_time'?: (_google_protobuf_Duration | null);
  /**
   * Number of result rows returned.
   */
  'result_count'?: (number | string | Long);
  /**
   * Total size of all result rows in bytes.
   */
  'result_size'?: (number | string | Long);
  /**
   * Number of mutations performed by the query.
   */
  'mutation_count'?: (number | string | Long);
  /**
   * Number of items sorted during query execution.
   */
  'sort_count'?: (number | string | Long);
  /**
   * Number of errors encountered.
   */
  'error_count'?: (number | string | Long);
  /**
   * Number of warnings encountered.
   */
  'warning_count'?: (number | string | Long);
}

/**
 * Metrics contains execution timing and count statistics.
 */
export interface _couchbase_query_v1_QueryResponse_MetaData_Metrics__Output {
  /**
   * Total wall-clock time for the query.
   */
  'elapsed_time': (_google_protobuf_Duration__Output | null);
  /**
   * Time spent executing the query (excludes queue wait).
   */
  'execution_time': (_google_protobuf_Duration__Output | null);
  /**
   * Number of result rows returned.
   */
  'result_count': (string);
  /**
   * Total size of all result rows in bytes.
   */
  'result_size': (string);
  /**
   * Number of mutations performed by the query.
   */
  'mutation_count': (string);
  /**
   * Number of items sorted during query execution.
   */
  'sort_count': (string);
  /**
   * Number of errors encountered.
   */
  'error_count': (string);
  /**
   * Number of warnings encountered.
   */
  'warning_count': (string);
}

// Original file: couchbase/query/v1/query.proto

/**
 * Status indicates the overall outcome of the query.
 */
export const _couchbase_query_v1_QueryResponse_MetaData_Status = {
  STATUS_RUNNING: 'STATUS_RUNNING',
  STATUS_SUCCESS: 'STATUS_SUCCESS',
  STATUS_ERRORS: 'STATUS_ERRORS',
  STATUS_COMPLETED: 'STATUS_COMPLETED',
  STATUS_STOPPED: 'STATUS_STOPPED',
  STATUS_TIMEOUT: 'STATUS_TIMEOUT',
  STATUS_CLOSED: 'STATUS_CLOSED',
  STATUS_FATAL: 'STATUS_FATAL',
  STATUS_ABORTED: 'STATUS_ABORTED',
  STATUS_UNKNOWN: 'STATUS_UNKNOWN',
} as const;

/**
 * Status indicates the overall outcome of the query.
 */
export type _couchbase_query_v1_QueryResponse_MetaData_Status =
  | 'STATUS_RUNNING'
  | 0
  | 'STATUS_SUCCESS'
  | 1
  | 'STATUS_ERRORS'
  | 2
  | 'STATUS_COMPLETED'
  | 3
  | 'STATUS_STOPPED'
  | 4
  | 'STATUS_TIMEOUT'
  | 5
  | 'STATUS_CLOSED'
  | 6
  | 'STATUS_FATAL'
  | 7
  | 'STATUS_ABORTED'
  | 8
  | 'STATUS_UNKNOWN'
  | 9

/**
 * Status indicates the overall outcome of the query.
 */
export type _couchbase_query_v1_QueryResponse_MetaData_Status__Output = typeof _couchbase_query_v1_QueryResponse_MetaData_Status[keyof typeof _couchbase_query_v1_QueryResponse_MetaData_Status]

/**
 * Warning represents a non-fatal issue encountered during execution.
 */
export interface _couchbase_query_v1_QueryResponse_MetaData_Warning {
  /**
   * The warning code.
   */
  'code'?: (number);
  /**
   * A human-readable description of the warning.
   */
  'message'?: (string);
}

/**
 * Warning represents a non-fatal issue encountered during execution.
 */
export interface _couchbase_query_v1_QueryResponse_MetaData_Warning__Output {
  /**
   * The warning code.
   */
  'code': (number);
  /**
   * A human-readable description of the warning.
   */
  'message': (string);
}

/**
 * QueryResponse is streamed back to the client. Early responses contain
 * rows; the final response includes MetaData with execution status and metrics.
 */
export interface QueryResponse {
  /**
   * Result rows, each as a JSON-encoded byte array.
   */
  'rows'?: (Buffer | Uint8Array | string)[];
  'meta_data'?: (_couchbase_query_v1_QueryResponse_MetaData | null);
  '_meta_data'?: "meta_data";
}

/**
 * QueryResponse is streamed back to the client. Early responses contain
 * rows; the final response includes MetaData with execution status and metrics.
 */
export interface QueryResponse__Output {
  /**
   * Result rows, each as a JSON-encoded byte array.
   */
  'rows': (Buffer)[];
  'meta_data'?: (_couchbase_query_v1_QueryResponse_MetaData__Output | null);
  '_meta_data'?: "meta_data";
}
