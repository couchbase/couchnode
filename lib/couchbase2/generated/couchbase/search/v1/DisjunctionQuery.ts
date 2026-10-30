// Original file: couchbase/search/v1/search.proto

import type { Query as _couchbase_search_v1_Query, Query__Output as _couchbase_search_v1_Query__Output } from '../../../couchbase/search/v1/Query';

/**
 * DisjunctionQuery requires at least `minimum` child queries to match (OR).
 * Defaults to minimum=1 if not specified.
 */
export interface DisjunctionQuery {
  'boost'?: (number | string);
  'queries'?: (_couchbase_search_v1_Query)[];
  /**
   * Minimum number of child queries that must match. Default: 1.
   */
  'minimum'?: (number);
  '_boost'?: "boost";
  '_minimum'?: "minimum";
}

/**
 * DisjunctionQuery requires at least `minimum` child queries to match (OR).
 * Defaults to minimum=1 if not specified.
 */
export interface DisjunctionQuery__Output {
  'boost'?: (number);
  'queries': (_couchbase_search_v1_Query__Output)[];
  /**
   * Minimum number of child queries that must match. Default: 1.
   */
  'minimum'?: (number);
  '_boost'?: "boost";
  '_minimum'?: "minimum";
}
