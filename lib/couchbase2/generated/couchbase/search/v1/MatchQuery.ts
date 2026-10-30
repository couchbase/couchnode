// Original file: couchbase/search/v1/search.proto

import type { Long } from '@grpc/proto-loader';

// Original file: couchbase/search/v1/search.proto

/**
 * Operator controls how multiple terms in the value are combined.
 */
export const _couchbase_search_v1_MatchQuery_Operator = {
  /**
   * Any term may match (default).
   */
  OPERATOR_OR: 'OPERATOR_OR',
  /**
   * All terms must match.
   */
  OPERATOR_AND: 'OPERATOR_AND',
} as const;

/**
 * Operator controls how multiple terms in the value are combined.
 */
export type _couchbase_search_v1_MatchQuery_Operator =
  /**
   * Any term may match (default).
   */
  | 'OPERATOR_OR'
  | 0
  /**
   * All terms must match.
   */
  | 'OPERATOR_AND'
  | 1

/**
 * Operator controls how multiple terms in the value are combined.
 */
export type _couchbase_search_v1_MatchQuery_Operator__Output = typeof _couchbase_search_v1_MatchQuery_Operator[keyof typeof _couchbase_search_v1_MatchQuery_Operator]

/**
 * MatchQuery performs full-text matching on a field. Supports fuzziness,
 * prefix length, and AND/OR operator modes.
 */
export interface MatchQuery {
  'boost'?: (number | string);
  'field'?: (string);
  /**
   * The text to match against the field.
   */
  'value'?: (string);
  'analyzer'?: (string);
  /**
   * Maximum edit distance for fuzzy matching.
   */
  'fuzziness'?: (number | string | Long);
  'operator'?: (_couchbase_search_v1_MatchQuery_Operator);
  /**
   * Number of characters at the start of the term that must match exactly.
   */
  'prefix_length'?: (number | string | Long);
  '_boost'?: "boost";
  '_field'?: "field";
  '_analyzer'?: "analyzer";
  '_fuzziness'?: "fuzziness";
  '_operator'?: "operator";
  '_prefix_length'?: "prefix_length";
}

/**
 * MatchQuery performs full-text matching on a field. Supports fuzziness,
 * prefix length, and AND/OR operator modes.
 */
export interface MatchQuery__Output {
  'boost'?: (number);
  'field'?: (string);
  /**
   * The text to match against the field.
   */
  'value': (string);
  'analyzer'?: (string);
  /**
   * Maximum edit distance for fuzzy matching.
   */
  'fuzziness'?: (string);
  'operator'?: (_couchbase_search_v1_MatchQuery_Operator__Output);
  /**
   * Number of characters at the start of the term that must match exactly.
   */
  'prefix_length'?: (string);
  '_boost'?: "boost";
  '_field'?: "field";
  '_analyzer'?: "analyzer";
  '_fuzziness'?: "fuzziness";
  '_operator'?: "operator";
  '_prefix_length'?: "prefix_length";
}
