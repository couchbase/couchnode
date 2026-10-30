// Original file: couchbase/search/v1/search.proto


/**
 * PrefixQuery matches documents where the field value starts with
 * the given prefix.
 */
export interface PrefixQuery {
  'boost'?: (number | string);
  'field'?: (string);
  'prefix'?: (string);
  '_boost'?: "boost";
  '_field'?: "field";
}

/**
 * PrefixQuery matches documents where the field value starts with
 * the given prefix.
 */
export interface PrefixQuery__Output {
  'boost'?: (number);
  'field'?: (string);
  'prefix': (string);
  '_boost'?: "boost";
  '_field'?: "field";
}
