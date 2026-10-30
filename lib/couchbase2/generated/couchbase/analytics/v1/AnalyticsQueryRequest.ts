// Original file: couchbase/analytics/v1/analytics.proto


// Original file: couchbase/analytics/v1/analytics.proto

/**
 * PlanFormat controls the output format for query execution plans.
 */
export const _couchbase_analytics_v1_AnalyticsQueryRequest_PlanFormat = {
  /**
   * Return the plan as a JSON object.
   */
  PLAN_FORMAT_JSON: 'PLAN_FORMAT_JSON',
  /**
   * Return the plan as a human-readable string.
   */
  PLAN_FORMAT_STRING: 'PLAN_FORMAT_STRING',
} as const;

/**
 * PlanFormat controls the output format for query execution plans.
 */
export type _couchbase_analytics_v1_AnalyticsQueryRequest_PlanFormat =
  /**
   * Return the plan as a JSON object.
   */
  | 'PLAN_FORMAT_JSON'
  | 0
  /**
   * Return the plan as a human-readable string.
   */
  | 'PLAN_FORMAT_STRING'
  | 1

/**
 * PlanFormat controls the output format for query execution plans.
 */
export type _couchbase_analytics_v1_AnalyticsQueryRequest_PlanFormat__Output = typeof _couchbase_analytics_v1_AnalyticsQueryRequest_PlanFormat[keyof typeof _couchbase_analytics_v1_AnalyticsQueryRequest_PlanFormat]

// Original file: couchbase/analytics/v1/analytics.proto

/**
 * ScanConsistency controls data consistency for the analytics query.
 */
export const _couchbase_analytics_v1_AnalyticsQueryRequest_ScanConsistency = {
  /**
   * No consistency required — may return stale results.
   */
  SCAN_CONSISTENCY_NOT_BOUNDED: 'SCAN_CONSISTENCY_NOT_BOUNDED',
  /**
   * Wait for all prior mutations to be ingested before executing.
   */
  SCAN_CONSISTENCY_REQUEST_PLUS: 'SCAN_CONSISTENCY_REQUEST_PLUS',
} as const;

/**
 * ScanConsistency controls data consistency for the analytics query.
 */
export type _couchbase_analytics_v1_AnalyticsQueryRequest_ScanConsistency =
  /**
   * No consistency required — may return stale results.
   */
  | 'SCAN_CONSISTENCY_NOT_BOUNDED'
  | 0
  /**
   * Wait for all prior mutations to be ingested before executing.
   */
  | 'SCAN_CONSISTENCY_REQUEST_PLUS'
  | 1

/**
 * ScanConsistency controls data consistency for the analytics query.
 */
export type _couchbase_analytics_v1_AnalyticsQueryRequest_ScanConsistency__Output = typeof _couchbase_analytics_v1_AnalyticsQueryRequest_ScanConsistency[keyof typeof _couchbase_analytics_v1_AnalyticsQueryRequest_ScanConsistency]

/**
 * AnalyticsQueryRequest contains the analytics statement and execution options.
 */
export interface AnalyticsQueryRequest {
  /**
   * The SQL++ analytics statement to execute.
   */
  'statement'?: (string);
  /**
   * When true, the query is read-only and will not modify any data.
   */
  'read_only'?: (boolean);
  /**
   * An opaque identifier for client-side request correlation.
   */
  'client_context_id'?: (string);
  /**
   * When true, this query receives priority scheduling on the analytics node.
   */
  'priority'?: (boolean);
  'scan_consistency'?: (_couchbase_analytics_v1_AnalyticsQueryRequest_ScanConsistency);
  /**
   * Positional parameters ($1, $2, etc.). Each element is JSON-encoded.
   */
  'positional_parameters'?: (Buffer | Uint8Array | string)[];
  /**
   * Named parameters ($name). Keys are parameter names, values are
   * JSON-encoded.
   */
  'named_parameters'?: ({[key: string]: Buffer | Uint8Array | string});
  /**
   * The analytics scope to execute the query against.
   */
  'analytics_scope_name'?: (string);
  'plan_format'?: (_couchbase_analytics_v1_AnalyticsQueryRequest_PlanFormat);
  /**
   * When true, include the logical plan in the response metadata.
   */
  'include_logical_plan'?: (boolean);
  /**
   * When true, include the organized (optimized) logical plan.
   */
  'include_organized_logical_plan'?: (boolean);
  /**
   * When true, include the expression tree in the response metadata.
   */
  'include_expression_tree'?: (boolean);
  /**
   * When true, include the rewritten expression tree.
   */
  'include_rewritten_expression_tree'?: (boolean);
  /**
   * Maximum number of warnings to include in the response.
   */
  'max_warnings'?: (number);
  '_analytics_scope_name'?: "analytics_scope_name";
  '_read_only'?: "read_only";
  '_client_context_id'?: "client_context_id";
  '_priority'?: "priority";
  '_scan_consistency'?: "scan_consistency";
  '_plan_format'?: "plan_format";
  '_include_logical_plan'?: "include_logical_plan";
  '_include_organized_logical_plan'?: "include_organized_logical_plan";
  '_include_expression_tree'?: "include_expression_tree";
  '_include_rewritten_expression_tree'?: "include_rewritten_expression_tree";
  '_max_warnings'?: "max_warnings";
}

/**
 * AnalyticsQueryRequest contains the analytics statement and execution options.
 */
export interface AnalyticsQueryRequest__Output {
  /**
   * The SQL++ analytics statement to execute.
   */
  'statement': (string);
  /**
   * When true, the query is read-only and will not modify any data.
   */
  'read_only'?: (boolean);
  /**
   * An opaque identifier for client-side request correlation.
   */
  'client_context_id'?: (string);
  /**
   * When true, this query receives priority scheduling on the analytics node.
   */
  'priority'?: (boolean);
  'scan_consistency'?: (_couchbase_analytics_v1_AnalyticsQueryRequest_ScanConsistency__Output);
  /**
   * Positional parameters ($1, $2, etc.). Each element is JSON-encoded.
   */
  'positional_parameters': (Buffer)[];
  /**
   * Named parameters ($name). Keys are parameter names, values are
   * JSON-encoded.
   */
  'named_parameters': ({[key: string]: Buffer});
  /**
   * The analytics scope to execute the query against.
   */
  'analytics_scope_name'?: (string);
  'plan_format'?: (_couchbase_analytics_v1_AnalyticsQueryRequest_PlanFormat__Output);
  /**
   * When true, include the logical plan in the response metadata.
   */
  'include_logical_plan'?: (boolean);
  /**
   * When true, include the organized (optimized) logical plan.
   */
  'include_organized_logical_plan'?: (boolean);
  /**
   * When true, include the expression tree in the response metadata.
   */
  'include_expression_tree'?: (boolean);
  /**
   * When true, include the rewritten expression tree.
   */
  'include_rewritten_expression_tree'?: (boolean);
  /**
   * Maximum number of warnings to include in the response.
   */
  'max_warnings'?: (number);
  '_analytics_scope_name'?: "analytics_scope_name";
  '_read_only'?: "read_only";
  '_client_context_id'?: "client_context_id";
  '_priority'?: "priority";
  '_scan_consistency'?: "scan_consistency";
  '_plan_format'?: "plan_format";
  '_include_logical_plan'?: "include_logical_plan";
  '_include_organized_logical_plan'?: "include_organized_logical_plan";
  '_include_expression_tree'?: "include_expression_tree";
  '_include_rewritten_expression_tree'?: "include_rewritten_expression_tree";
  '_max_warnings'?: "max_warnings";
}
