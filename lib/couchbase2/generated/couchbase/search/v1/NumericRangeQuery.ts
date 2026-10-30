// Original file: couchbase/search/v1/search.proto


/**
 * NumericRangeQuery matches documents with a numeric field within the
 * specified range.
 */
export interface NumericRangeQuery {
  'boost'?: (number | string);
  'field'?: (string);
  'min'?: (number | string);
  'max'?: (number | string);
  /**
   * Whether the min value is inclusive (default: true).
   */
  'inclusive_min'?: (boolean);
  /**
   * Whether the max value is inclusive (default: false).
   */
  'inclusive_max'?: (boolean);
  '_boost'?: "boost";
  '_field'?: "field";
  '_min'?: "min";
  '_max'?: "max";
  '_inclusive_min'?: "inclusive_min";
  '_inclusive_max'?: "inclusive_max";
}

/**
 * NumericRangeQuery matches documents with a numeric field within the
 * specified range.
 */
export interface NumericRangeQuery__Output {
  'boost'?: (number);
  'field'?: (string);
  'min'?: (number);
  'max'?: (number);
  /**
   * Whether the min value is inclusive (default: true).
   */
  'inclusive_min'?: (boolean);
  /**
   * Whether the max value is inclusive (default: false).
   */
  'inclusive_max'?: (boolean);
  '_boost'?: "boost";
  '_field'?: "field";
  '_min'?: "min";
  '_max'?: "max";
  '_inclusive_min'?: "inclusive_min";
  '_inclusive_max'?: "inclusive_max";
}
