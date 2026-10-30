// Original file: couchbase/admin/analytics/v1/analytics.proto

/**
 * LinkStatus describes the health state of an analytics link.
 */
export const LinkStatus = {
  LINK_STATUS_UNKNOWN: 'LINK_STATUS_UNKNOWN',
  LINK_STATUS_HEALTHY: 'LINK_STATUS_HEALTHY',
  LINK_STATUS_STOPPED: 'LINK_STATUS_STOPPED',
  LINK_STATUS_UNHEALTHY: 'LINK_STATUS_UNHEALTHY',
  LINK_STATUS_SUSPENDED: 'LINK_STATUS_SUSPENDED',
} as const;

/**
 * LinkStatus describes the health state of an analytics link.
 */
export type LinkStatus =
  | 'LINK_STATUS_UNKNOWN'
  | 0
  | 'LINK_STATUS_HEALTHY'
  | 1
  | 'LINK_STATUS_STOPPED'
  | 2
  | 'LINK_STATUS_UNHEALTHY'
  | 3
  | 'LINK_STATUS_SUSPENDED'
  | 4

/**
 * LinkStatus describes the health state of an analytics link.
 */
export type LinkStatus__Output = typeof LinkStatus[keyof typeof LinkStatus]
