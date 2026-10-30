// Original file: couchbase/internal/xdcr/v1/xdcr.proto

/**
 * ClusterEdition indicates the edition of the Couchbase cluster.
 */
export const ClusterEdition = {
  CLUSTER_EDITION_COMMUNITY: 'CLUSTER_EDITION_COMMUNITY',
  CLUSTER_EDITION_ENTERPRISE: 'CLUSTER_EDITION_ENTERPRISE',
  CLUSTER_EDITION_MIXED: 'CLUSTER_EDITION_MIXED',
} as const;

/**
 * ClusterEdition indicates the edition of the Couchbase cluster.
 */
export type ClusterEdition =
  | 'CLUSTER_EDITION_COMMUNITY'
  | 0
  | 'CLUSTER_EDITION_ENTERPRISE'
  | 1
  | 'CLUSTER_EDITION_MIXED'
  | 2

/**
 * ClusterEdition indicates the edition of the Couchbase cluster.
 */
export type ClusterEdition__Output = typeof ClusterEdition[keyof typeof ClusterEdition]
