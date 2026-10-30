// Original file: couchbase/internal/xdcr/v1/xdcr.proto

/**
 * ConflictResolutionType specifies how XDCR conflicts are resolved.
 */
export const ConflictResolutionType = {
  /**
   * Resolve by highest timestamp (last-write-wins).
   */
  CONFLICT_RESOLUTION_TYPE_TIMESTAMP: 'CONFLICT_RESOLUTION_TYPE_TIMESTAMP',
  /**
   * Resolve by highest sequence number.
   */
  CONFLICT_RESOLUTION_TYPE_SEQUENCE_NUMBER: 'CONFLICT_RESOLUTION_TYPE_SEQUENCE_NUMBER',
  /**
   * Use custom conflict resolution logic.
   */
  CONFLICT_RESOLUTION_TYPE_CUSTOM: 'CONFLICT_RESOLUTION_TYPE_CUSTOM',
} as const;

/**
 * ConflictResolutionType specifies how XDCR conflicts are resolved.
 */
export type ConflictResolutionType =
  /**
   * Resolve by highest timestamp (last-write-wins).
   */
  | 'CONFLICT_RESOLUTION_TYPE_TIMESTAMP'
  | 0
  /**
   * Resolve by highest sequence number.
   */
  | 'CONFLICT_RESOLUTION_TYPE_SEQUENCE_NUMBER'
  | 1
  /**
   * Use custom conflict resolution logic.
   */
  | 'CONFLICT_RESOLUTION_TYPE_CUSTOM'
  | 2

/**
 * ConflictResolutionType specifies how XDCR conflicts are resolved.
 */
export type ConflictResolutionType__Output = typeof ConflictResolutionType[keyof typeof ConflictResolutionType]
