// Original file: couchbase/analytics/v1/analytics.proto

import type { Duration as _google_protobuf_Duration, Duration__Output as _google_protobuf_Duration__Output } from '../../../google/protobuf/Duration';
import type { Long } from '@grpc/proto-loader';

/**
 * MetaData is included in the final streamed response.
 */
export interface _couchbase_analytics_v1_AnalyticsQueryResponse_MetaData {
  /**
   * The unique identifier assigned to this query by the server.
   */
  'request_id'?: (string);
  /**
   * The client_context_id echoed back from the request.
   */
  'client_context_id'?: (string);
  /**
   * Execution metrics for this query.
   */
  'metrics'?: (_couchbase_analytics_v1_AnalyticsQueryResponse_Metrics | null);
  /**
   * The schema signature of the results. JSON-encoded.
   */
  'signature'?: (Buffer | Uint8Array | string);
  /**
   * Warnings encountered during execution.
   */
  'warnings'?: (_couchbase_analytics_v1_AnalyticsQueryResponse_MetaData_Warning)[];
  /**
   * The analytics execution status string.
   */
  'status'?: (string);
  /**
   * The logical plan, if requested. JSON-encoded.
   */
  'logical_plan'?: (Buffer | Uint8Array | string);
  /**
   * The optimized logical plan, if requested. JSON-encoded.
   */
  'optimized_logical_plan'?: (Buffer | Uint8Array | string);
  /**
   * The expression tree, if requested.
   */
  'expression_tree'?: (string);
  /**
   * The rewritten expression tree, if requested.
   */
  'rewritten_expression_tree'?: (string);
  '_logical_plan'?: "logical_plan";
  '_optimized_logical_plan'?: "optimized_logical_plan";
  '_expression_tree'?: "expression_tree";
  '_rewritten_expression_tree'?: "rewritten_expression_tree";
}

/**
 * MetaData is included in the final streamed response.
 */
export interface _couchbase_analytics_v1_AnalyticsQueryResponse_MetaData__Output {
  /**
   * The unique identifier assigned to this query by the server.
   */
  'request_id': (string);
  /**
   * The client_context_id echoed back from the request.
   */
  'client_context_id': (string);
  /**
   * Execution metrics for this query.
   */
  'metrics': (_couchbase_analytics_v1_AnalyticsQueryResponse_Metrics__Output | null);
  /**
   * The schema signature of the results. JSON-encoded.
   */
  'signature': (Buffer);
  /**
   * Warnings encountered during execution.
   */
  'warnings': (_couchbase_analytics_v1_AnalyticsQueryResponse_MetaData_Warning__Output)[];
  /**
   * The analytics execution status string.
   */
  'status': (string);
  /**
   * The logical plan, if requested. JSON-encoded.
   */
  'logical_plan'?: (Buffer);
  /**
   * The optimized logical plan, if requested. JSON-encoded.
   */
  'optimized_logical_plan'?: (Buffer);
  /**
   * The expression tree, if requested.
   */
  'expression_tree'?: (string);
  /**
   * The rewritten expression tree, if requested.
   */
  'rewritten_expression_tree'?: (string);
  '_logical_plan'?: "logical_plan";
  '_optimized_logical_plan'?: "optimized_logical_plan";
  '_expression_tree'?: "expression_tree";
  '_rewritten_expression_tree'?: "rewritten_expression_tree";
}

/**
 * Metrics contains execution timing and count statistics for the query.
 */
export interface _couchbase_analytics_v1_AnalyticsQueryResponse_Metrics {
  /**
   * Total wall-clock time for the query.
   */
  'elapsed_time'?: (_google_protobuf_Duration | null);
  /**
   * Time spent executing (excludes queue wait).
   */
  'execution_time'?: (_google_protobuf_Duration | null);
  /**
   * Number of result rows returned.
   */
  'result_count'?: (number | string | Long);
  /**
   * Total size of result rows in bytes.
   */
  'result_size'?: (number | string | Long);
  /**
   * Number of mutations performed.
   */
  'mutation_count'?: (number | string | Long);
  /**
   * Number of items sorted.
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
  /**
   * Number of objects processed by the analytics engine.
   */
  'processed_objects'?: (number | string | Long);
}

/**
 * Metrics contains execution timing and count statistics for the query.
 */
export interface _couchbase_analytics_v1_AnalyticsQueryResponse_Metrics__Output {
  /**
   * Total wall-clock time for the query.
   */
  'elapsed_time': (_google_protobuf_Duration__Output | null);
  /**
   * Time spent executing (excludes queue wait).
   */
  'execution_time': (_google_protobuf_Duration__Output | null);
  /**
   * Number of result rows returned.
   */
  'result_count': (string);
  /**
   * Total size of result rows in bytes.
   */
  'result_size': (string);
  /**
   * Number of mutations performed.
   */
  'mutation_count': (string);
  /**
   * Number of items sorted.
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
  /**
   * Number of objects processed by the analytics engine.
   */
  'processed_objects': (string);
}

/**
 * Warning represents a non-fatal issue during query execution.
 */
export interface _couchbase_analytics_v1_AnalyticsQueryResponse_MetaData_Warning {
  'code'?: (number);
  'message'?: (string);
}

/**
 * Warning represents a non-fatal issue during query execution.
 */
export interface _couchbase_analytics_v1_AnalyticsQueryResponse_MetaData_Warning__Output {
  'code': (number);
  'message': (string);
}

/**
 * AnalyticsQueryResponse is streamed back to the client. Early responses
 * contain rows; the final response includes MetaData.
 */
export interface AnalyticsQueryResponse {
  /**
   * Result rows, each as a JSON-encoded byte array.
   */
  'rows'?: (Buffer | Uint8Array | string)[];
  'meta_data'?: (_couchbase_analytics_v1_AnalyticsQueryResponse_MetaData | null);
  '_meta_data'?: "meta_data";
}

/**
 * AnalyticsQueryResponse is streamed back to the client. Early responses
 * contain rows; the final response includes MetaData.
 */
export interface AnalyticsQueryResponse__Output {
  /**
   * Result rows, each as a JSON-encoded byte array.
   */
  'rows': (Buffer)[];
  'meta_data'?: (_couchbase_analytics_v1_AnalyticsQueryResponse_MetaData__Output | null);
  '_meta_data'?: "meta_data";
}
