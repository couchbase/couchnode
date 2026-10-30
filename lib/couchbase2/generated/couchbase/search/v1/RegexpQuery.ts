// Original file: couchbase/search/v1/search.proto


/**
 * RegexpQuery matches documents where the field value matches the
 * given regular expression.
 */
export interface RegexpQuery {
  'boost'?: (number | string);
  'field'?: (string);
  'regexp'?: (string);
  '_boost'?: "boost";
  '_field'?: "field";
}

/**
 * RegexpQuery matches documents where the field value matches the
 * given regular expression.
 */
export interface RegexpQuery__Output {
  'boost'?: (number);
  'field'?: (string);
  'regexp': (string);
  '_boost'?: "boost";
  '_field'?: "field";
}
