// Original file: couchbase/search/v1/search.proto

import type { ConjunctionQuery as _couchbase_search_v1_ConjunctionQuery, ConjunctionQuery__Output as _couchbase_search_v1_ConjunctionQuery__Output } from '../../../couchbase/search/v1/ConjunctionQuery';
import type { DisjunctionQuery as _couchbase_search_v1_DisjunctionQuery, DisjunctionQuery__Output as _couchbase_search_v1_DisjunctionQuery__Output } from '../../../couchbase/search/v1/DisjunctionQuery';

/**
 * BooleanQuery combines must, must_not, and should clauses using boolean logic.
 */
export interface BooleanQuery {
  'boost'?: (number | string);
  /**
   * All queries in `must` must match (AND).
   */
  'must'?: (_couchbase_search_v1_ConjunctionQuery | null);
  /**
   * No queries in `must_not` may match.
   */
  'must_not'?: (_couchbase_search_v1_DisjunctionQuery | null);
  /**
   * At least one query in `should` should match (OR).
   */
  'should'?: (_couchbase_search_v1_DisjunctionQuery | null);
  '_boost'?: "boost";
  '_must'?: "must";
  '_must_not'?: "must_not";
  '_should'?: "should";
}

/**
 * BooleanQuery combines must, must_not, and should clauses using boolean logic.
 */
export interface BooleanQuery__Output {
  'boost'?: (number);
  /**
   * All queries in `must` must match (AND).
   */
  'must'?: (_couchbase_search_v1_ConjunctionQuery__Output | null);
  /**
   * No queries in `must_not` may match.
   */
  'must_not'?: (_couchbase_search_v1_DisjunctionQuery__Output | null);
  /**
   * At least one query in `should` should match (OR).
   */
  'should'?: (_couchbase_search_v1_DisjunctionQuery__Output | null);
  '_boost'?: "boost";
  '_must'?: "must";
  '_must_not'?: "must_not";
  '_should'?: "should";
}
