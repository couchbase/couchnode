// Original file: couchbase/admin/query/v1/query.proto

/**
 * IndexType specifies the underlying index technology.
 */
export const IndexType = {
  /**
   * A MapReduce view-based index.
   */
  INDEX_TYPE_VIEW: 'INDEX_TYPE_VIEW',
  /**
   * A Global Secondary Index (GSI).
   */
  INDEX_TYPE_GSI: 'INDEX_TYPE_GSI',
} as const;

/**
 * IndexType specifies the underlying index technology.
 */
export type IndexType =
  /**
   * A MapReduce view-based index.
   */
  | 'INDEX_TYPE_VIEW'
  | 0
  /**
   * A Global Secondary Index (GSI).
   */
  | 'INDEX_TYPE_GSI'
  | 1

/**
 * IndexType specifies the underlying index technology.
 */
export type IndexType__Output = typeof IndexType[keyof typeof IndexType]
