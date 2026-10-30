// Original file: couchbase/search/v1/search.proto


/**
 * TermRangeQuery matches documents with a string field value within
 * the specified lexicographic range.
 */
export interface TermRangeQuery {
  'boost'?: (number | string);
  'field'?: (string);
  'min'?: (string);
  'max'?: (string);
  'inclusive_min'?: (boolean);
  'inclusive_max'?: (boolean);
  '_boost'?: "boost";
  '_field'?: "field";
  '_min'?: "min";
  '_max'?: "max";
  '_inclusive_min'?: "inclusive_min";
  '_inclusive_max'?: "inclusive_max";
}

/**
 * TermRangeQuery matches documents with a string field value within
 * the specified lexicographic range.
 */
export interface TermRangeQuery__Output {
  'boost'?: (number);
  'field'?: (string);
  'min'?: (string);
  'max'?: (string);
  'inclusive_min'?: (boolean);
  'inclusive_max'?: (boolean);
  '_boost'?: "boost";
  '_field'?: "field";
  '_min'?: "min";
  '_max'?: "max";
  '_inclusive_min'?: "inclusive_min";
  '_inclusive_max'?: "inclusive_max";
}
