// Original file: couchbase/admin/bucket/v1/bucket.proto

/**
 * ConflictResolutionType specifies how conflicts are resolved during
 * cross-datacenter replication (XDCR).
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
 * ConflictResolutionType specifies how conflicts are resolved during
 * cross-datacenter replication (XDCR).
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
 * ConflictResolutionType specifies how conflicts are resolved during
 * cross-datacenter replication (XDCR).
 */
export type ConflictResolutionType__Output = typeof ConflictResolutionType[keyof typeof ConflictResolutionType]
