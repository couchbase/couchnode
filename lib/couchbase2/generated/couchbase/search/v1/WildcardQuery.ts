// Original file: couchbase/search/v1/search.proto


/**
 * WildcardQuery matches documents where the field value matches a
 * wildcard pattern (* for any characters, ? for single character).
 */
export interface WildcardQuery {
  'boost'?: (number | string);
  'field'?: (string);
  'wildcard'?: (string);
  '_boost'?: "boost";
  '_field'?: "field";
}

/**
 * WildcardQuery matches documents where the field value matches a
 * wildcard pattern (* for any characters, ? for single character).
 */
export interface WildcardQuery__Output {
  'boost'?: (number);
  'field'?: (string);
  'wildcard': (string);
  '_boost'?: "boost";
  '_field'?: "field";
}
