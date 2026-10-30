// Original file: couchbase/internal/xdcr/v1/xdcr.proto

import type { Long } from '@grpc/proto-loader';

/**
 * HistoryEntry represents a single entry in the vbucket failover log.
 */
export interface _couchbase_internal_xdcr_v1_GetVbucketInfoResponse_HistoryEntry {
  'uuid'?: (number | string | Long);
  'seqno'?: (number | string | Long);
}

/**
 * HistoryEntry represents a single entry in the vbucket failover log.
 */
export interface _couchbase_internal_xdcr_v1_GetVbucketInfoResponse_HistoryEntry__Output {
  'uuid': (string);
  'seqno': (string);
}

/**
 * VbucketState describes the current state of a single vbucket.
 */
export interface _couchbase_internal_xdcr_v1_GetVbucketInfoResponse_VbucketState {
  'vbucket_id'?: (number);
  /**
   * The current vbucket UUID.
   */
  'uuid'?: (number | string | Long);
  /**
   * The highest sequence number in this vbucket.
   */
  'high_seqno'?: (number | string | Long);
  /**
   * The failover history, if requested.
   */
  'history'?: (_couchbase_internal_xdcr_v1_GetVbucketInfoResponse_HistoryEntry)[];
  /**
   * The maximum CAS value in this vbucket, if requested.
   */
  'max_cas'?: (number | string | Long);
  '_max_cas'?: "max_cas";
}

/**
 * VbucketState describes the current state of a single vbucket.
 */
export interface _couchbase_internal_xdcr_v1_GetVbucketInfoResponse_VbucketState__Output {
  'vbucket_id': (number);
  /**
   * The current vbucket UUID.
   */
  'uuid': (string);
  /**
   * The highest sequence number in this vbucket.
   */
  'high_seqno': (string);
  /**
   * The failover history, if requested.
   */
  'history': (_couchbase_internal_xdcr_v1_GetVbucketInfoResponse_HistoryEntry__Output)[];
  /**
   * The maximum CAS value in this vbucket, if requested.
   */
  'max_cas'?: (string);
  '_max_cas'?: "max_cas";
}

/**
 * GetVbucketInfoResponse contains vbucket state for one or more vbuckets.
 */
export interface GetVbucketInfoResponse {
  'vbuckets'?: (_couchbase_internal_xdcr_v1_GetVbucketInfoResponse_VbucketState)[];
}

/**
 * GetVbucketInfoResponse contains vbucket state for one or more vbuckets.
 */
export interface GetVbucketInfoResponse__Output {
  'vbuckets': (_couchbase_internal_xdcr_v1_GetVbucketInfoResponse_VbucketState__Output)[];
}
