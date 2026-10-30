// Original file: couchbase/search/v1/search.proto

/**
 * KnnOperator controls how multiple KNN queries are combined.
 */
export const KnnOperator = {
  /**
   * Results from multiple KNN queries are combined with OR (union).
   */
  KNN_OPERATOR_OR: 'KNN_OPERATOR_OR',
  /**
   * Results from multiple KNN queries are combined with AND (intersection).
   */
  KNN_OPERATOR_AND: 'KNN_OPERATOR_AND',
} as const;

/**
 * KnnOperator controls how multiple KNN queries are combined.
 */
export type KnnOperator =
  /**
   * Results from multiple KNN queries are combined with OR (union).
   */
  | 'KNN_OPERATOR_OR'
  | 0
  /**
   * Results from multiple KNN queries are combined with AND (intersection).
   */
  | 'KNN_OPERATOR_AND'
  | 1

/**
 * KnnOperator controls how multiple KNN queries are combined.
 */
export type KnnOperator__Output = typeof KnnOperator[keyof typeof KnnOperator]
