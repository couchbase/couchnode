// Original file: couchbase/internal/hooks/v1/hooks.proto

/**
 * ComparisonOperator defines comparison operations for hook conditions.
 */
export const ComparisonOperator = {
  COMPARISON_OPERATOR_EQUAL: 'COMPARISON_OPERATOR_EQUAL',
  COMPARISON_OPERATOR_NOT_EQUAL: 'COMPARISON_OPERATOR_NOT_EQUAL',
  COMPARISON_OPERATOR_GREATER_THAN: 'COMPARISON_OPERATOR_GREATER_THAN',
  COMPARISON_OPERATOR_GREATER_THAN_OR_EQUAL: 'COMPARISON_OPERATOR_GREATER_THAN_OR_EQUAL',
  COMPARISON_OPERATOR_LESS_THAN: 'COMPARISON_OPERATOR_LESS_THAN',
  COMPARISON_OPERATOR_LESS_THAN_OR_EQUAL: 'COMPARISON_OPERATOR_LESS_THAN_OR_EQUAL',
} as const;

/**
 * ComparisonOperator defines comparison operations for hook conditions.
 */
export type ComparisonOperator =
  | 'COMPARISON_OPERATOR_EQUAL'
  | 0
  | 'COMPARISON_OPERATOR_NOT_EQUAL'
  | 1
  | 'COMPARISON_OPERATOR_GREATER_THAN'
  | 2
  | 'COMPARISON_OPERATOR_GREATER_THAN_OR_EQUAL'
  | 3
  | 'COMPARISON_OPERATOR_LESS_THAN'
  | 4
  | 'COMPARISON_OPERATOR_LESS_THAN_OR_EQUAL'
  | 5

/**
 * ComparisonOperator defines comparison operations for hook conditions.
 */
export type ComparisonOperator__Output = typeof ComparisonOperator[keyof typeof ComparisonOperator]
