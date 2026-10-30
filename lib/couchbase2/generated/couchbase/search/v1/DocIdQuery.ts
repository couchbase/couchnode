// Original file: couchbase/search/v1/search.proto


/**
 * DocIdQuery matches documents by their document IDs.
 */
export interface DocIdQuery {
  'boost'?: (number | string);
  'ids'?: (string)[];
  '_boost'?: "boost";
}

/**
 * DocIdQuery matches documents by their document IDs.
 */
export interface DocIdQuery__Output {
  'boost'?: (number);
  'ids': (string)[];
  '_boost'?: "boost";
}
