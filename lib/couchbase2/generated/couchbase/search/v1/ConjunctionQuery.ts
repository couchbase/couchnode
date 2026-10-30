// Original file: couchbase/search/v1/search.proto

import type { Query as _couchbase_search_v1_Query, Query__Output as _couchbase_search_v1_Query__Output } from '../../../couchbase/search/v1/Query';

/**
 * ConjunctionQuery requires all child queries to match (AND).
 */
export interface ConjunctionQuery {
  'boost'?: (number | string);
  'queries'?: (_couchbase_search_v1_Query)[];
  '_boost'?: "boost";
}

/**
 * ConjunctionQuery requires all child queries to match (AND).
 */
export interface ConjunctionQuery__Output {
  'boost'?: (number);
  'queries': (_couchbase_search_v1_Query__Output)[];
  '_boost'?: "boost";
}
