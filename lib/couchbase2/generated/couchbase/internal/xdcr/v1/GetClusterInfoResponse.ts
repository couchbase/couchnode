// Original file: couchbase/internal/xdcr/v1/xdcr.proto

import type { ClusterEdition as _couchbase_internal_xdcr_v1_ClusterEdition, ClusterEdition__Output as _couchbase_internal_xdcr_v1_ClusterEdition__Output } from '../../../../couchbase/internal/xdcr/v1/ClusterEdition';

/**
 * GetClusterInfoResponse returns cluster identity and edition information.
 */
export interface GetClusterInfoResponse {
  'cluster_uuid'?: (string);
  /**
   * The edition of the cluster (Community or Enterprise).
   */
  'edition'?: (_couchbase_internal_xdcr_v1_ClusterEdition);
  '_edition'?: "edition";
}

/**
 * GetClusterInfoResponse returns cluster identity and edition information.
 */
export interface GetClusterInfoResponse__Output {
  'cluster_uuid': (string);
  /**
   * The edition of the cluster (Community or Enterprise).
   */
  'edition'?: (_couchbase_internal_xdcr_v1_ClusterEdition__Output);
  '_edition'?: "edition";
}
