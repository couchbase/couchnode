// Original file: couchbase/search/v1/search.proto

import type { Long } from '@grpc/proto-loader';

/**
 * KnnQuery performs k-nearest-neighbor vector search on a vector field.
 */
export interface KnnQuery {
  /**
   * The vector index field name to search against.
   */
  'field'?: (string);
  /**
   * Number of nearest neighbors to return.
   */
  'k'?: (number | string | Long);
  /**
   * The query vector to find neighbors for.
   */
  'vector'?: (number | string)[];
  'boost'?: (number | string);
  '_boost'?: "boost";
}

/**
 * KnnQuery performs k-nearest-neighbor vector search on a vector field.
 */
export interface KnnQuery__Output {
  /**
   * The vector index field name to search against.
   */
  'field': (string);
  /**
   * Number of nearest neighbors to return.
   */
  'k': (string);
  /**
   * The query vector to find neighbors for.
   */
  'vector': (number)[];
  'boost'?: (number);
  '_boost'?: "boost";
}
