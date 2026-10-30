// Original file: couchbase/search/v1/search.proto


/**
 * NumericRange defines a named numeric range for faceting.
 */
export interface NumericRange {
  'name'?: (string);
  'min'?: (number | string);
  'max'?: (number | string);
  '_min'?: "min";
  '_max'?: "max";
}

/**
 * NumericRange defines a named numeric range for faceting.
 */
export interface NumericRange__Output {
  'name': (string);
  'min'?: (number);
  'max'?: (number);
  '_min'?: "min";
  '_max'?: "max";
}
