// Original file: couchbase/search/v1/search.proto


/**
 * PhraseQuery matches documents containing the exact sequence of terms
 * in the specified field.
 */
export interface PhraseQuery {
  'boost'?: (number | string);
  'field'?: (string);
  'terms'?: (string)[];
  '_boost'?: "boost";
  '_field'?: "field";
}

/**
 * PhraseQuery matches documents containing the exact sequence of terms
 * in the specified field.
 */
export interface PhraseQuery__Output {
  'boost'?: (number);
  'field'?: (string);
  'terms': (string)[];
  '_boost'?: "boost";
  '_field'?: "field";
}
