// Original file: couchbase/search/v1/search.proto


/**
 * TermFacet aggregates results by the most frequent terms in a field.
 */
export interface TermFacet {
  'field'?: (string);
  /**
   * Maximum number of term buckets to return.
   */
  'size'?: (number);
}

/**
 * TermFacet aggregates results by the most frequent terms in a field.
 */
export interface TermFacet__Output {
  'field': (string);
  /**
   * Maximum number of term buckets to return.
   */
  'size': (number);
}
