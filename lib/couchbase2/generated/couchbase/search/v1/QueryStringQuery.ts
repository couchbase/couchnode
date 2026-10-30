// Original file: couchbase/search/v1/search.proto


/**
 * QueryStringQuery uses the FTS query string syntax to express complex
 * queries in a single string (e.g., "+field:value -excluded").
 */
export interface QueryStringQuery {
  'boost'?: (number | string);
  'query_string'?: (string);
  '_boost'?: "boost";
}

/**
 * QueryStringQuery uses the FTS query string syntax to express complex
 * queries in a single string (e.g., "+field:value -excluded").
 */
export interface QueryStringQuery__Output {
  'boost'?: (number);
  'query_string': (string);
  '_boost'?: "boost";
}
