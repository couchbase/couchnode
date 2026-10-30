// Original file: couchbase/search/v1/search.proto


/**
 * BooleanFieldQuery matches documents where a boolean field has the given
 * value.
 */
export interface BooleanFieldQuery {
  'boost'?: (number | string);
  'field'?: (string);
  'value'?: (boolean);
  '_boost'?: "boost";
  '_field'?: "field";
}

/**
 * BooleanFieldQuery matches documents where a boolean field has the given
 * value.
 */
export interface BooleanFieldQuery__Output {
  'boost'?: (number);
  'field'?: (string);
  'value': (boolean);
  '_boost'?: "boost";
  '_field'?: "field";
}
