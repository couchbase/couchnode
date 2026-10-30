// Original file: couchbase/search/v1/search.proto


/**
 * MatchPhraseQuery matches documents containing the exact phrase
 * in the specified field, using the given analyzer.
 */
export interface MatchPhraseQuery {
  'boost'?: (number | string);
  'field'?: (string);
  'phrase'?: (string);
  'analyzer'?: (string);
  '_boost'?: "boost";
  '_field'?: "field";
  '_analyzer'?: "analyzer";
}

/**
 * MatchPhraseQuery matches documents containing the exact phrase
 * in the specified field, using the given analyzer.
 */
export interface MatchPhraseQuery__Output {
  'boost'?: (number);
  'field'?: (string);
  'phrase': (string);
  'analyzer'?: (string);
  '_boost'?: "boost";
  '_field'?: "field";
  '_analyzer'?: "analyzer";
}
