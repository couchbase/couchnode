// Original file: couchbase/admin/query/v1/query.proto

/**
 * IndexState represents the current lifecycle state of an index.
 */
export const IndexState = {
  /**
   * The index was created with deferred=true and has not been built yet.
   */
  INDEX_STATE_DEFERRED: 'INDEX_STATE_DEFERRED',
  /**
   * The index is currently being built.
   */
  INDEX_STATE_BUILDING: 'INDEX_STATE_BUILDING',
  /**
   * The index build is pending (queued).
   */
  INDEX_STATE_PENDING: 'INDEX_STATE_PENDING',
  /**
   * The index is online and ready for queries.
   */
  INDEX_STATE_ONLINE: 'INDEX_STATE_ONLINE',
  /**
   * The index is offline.
   */
  INDEX_STATE_OFFLINE: 'INDEX_STATE_OFFLINE',
  /**
   * The index is in an abridged state.
   */
  INDEX_STATE_ABRIDGED: 'INDEX_STATE_ABRIDGED',
  /**
   * The index build is scheduled but not yet started.
   */
  INDEX_STATE_SCHEDULED: 'INDEX_STATE_SCHEDULED',
} as const;

/**
 * IndexState represents the current lifecycle state of an index.
 */
export type IndexState =
  /**
   * The index was created with deferred=true and has not been built yet.
   */
  | 'INDEX_STATE_DEFERRED'
  | 0
  /**
   * The index is currently being built.
   */
  | 'INDEX_STATE_BUILDING'
  | 1
  /**
   * The index build is pending (queued).
   */
  | 'INDEX_STATE_PENDING'
  | 2
  /**
   * The index is online and ready for queries.
   */
  | 'INDEX_STATE_ONLINE'
  | 3
  /**
   * The index is offline.
   */
  | 'INDEX_STATE_OFFLINE'
  | 4
  /**
   * The index is in an abridged state.
   */
  | 'INDEX_STATE_ABRIDGED'
  | 5
  /**
   * The index build is scheduled but not yet started.
   */
  | 'INDEX_STATE_SCHEDULED'
  | 6

/**
 * IndexState represents the current lifecycle state of an index.
 */
export type IndexState__Output = typeof IndexState[keyof typeof IndexState]
