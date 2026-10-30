// Original file: couchbase/admin/analytics/v1/analytics.proto

import type { LinkStatus as _couchbase_admin_analytics_v1_LinkStatus, LinkStatus__Output as _couchbase_admin_analytics_v1_LinkStatus__Output } from '../../../../couchbase/admin/analytics/v1/LinkStatus';
import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from '../../../../google/protobuf/Timestamp';
import type { Long } from '@grpc/proto-loader';

/**
 * Collection identifies a collection being ingested.
 */
export interface _couchbase_admin_analytics_v1_GetIngestionStatusResponse_Link_State_Scope_Collection {
  'collection_name'?: (string);
}

/**
 * Collection identifies a collection being ingested.
 */
export interface _couchbase_admin_analytics_v1_GetIngestionStatusResponse_Link_State_Scope_Collection__Output {
  'collection_name': (string);
}

/**
 * Link contains the status and ingestion state for a single link.
 */
export interface _couchbase_admin_analytics_v1_GetIngestionStatusResponse_Link {
  'link_name'?: (string);
  'analytics_scope_name'?: (string);
  'status'?: (_couchbase_admin_analytics_v1_LinkStatus);
  /**
   * Historical and current ingestion states.
   */
  'states'?: (_couchbase_admin_analytics_v1_GetIngestionStatusResponse_Link_State)[];
}

/**
 * Link contains the status and ingestion state for a single link.
 */
export interface _couchbase_admin_analytics_v1_GetIngestionStatusResponse_Link__Output {
  'link_name': (string);
  'analytics_scope_name': (string);
  'status': (_couchbase_admin_analytics_v1_LinkStatus__Output);
  /**
   * Historical and current ingestion states.
   */
  'states': (_couchbase_admin_analytics_v1_GetIngestionStatusResponse_Link_State__Output)[];
}

/**
 * Scope identifies a scope being ingested.
 */
export interface _couchbase_admin_analytics_v1_GetIngestionStatusResponse_Link_State_Scope {
  'scope_name'?: (string);
  'collections'?: (_couchbase_admin_analytics_v1_GetIngestionStatusResponse_Link_State_Scope_Collection)[];
}

/**
 * Scope identifies a scope being ingested.
 */
export interface _couchbase_admin_analytics_v1_GetIngestionStatusResponse_Link_State_Scope__Output {
  'scope_name': (string);
  'collections': (_couchbase_admin_analytics_v1_GetIngestionStatusResponse_Link_State_Scope_Collection__Output)[];
}

/**
 * State represents the ingestion state at a point in time.
 */
export interface _couchbase_admin_analytics_v1_GetIngestionStatusResponse_Link_State {
  /**
   * When this state snapshot was captured.
   */
  'timestamp'?: (_google_protobuf_Timestamp | null);
  /**
   * Ingestion progress as a fraction (0.0 to 1.0).
   */
  'progress'?: (number | string);
  /**
   * Time lag in milliseconds behind the source.
   */
  'time_lag_ms'?: (number | string | Long);
  /**
   * Number of items processed so far.
   */
  'items_processed'?: (number | string | Long);
  /**
   * Number of sequence number advances.
   */
  'seqno_advances'?: (number | string | Long);
  /**
   * Scopes being ingested.
   */
  'scopes'?: (_couchbase_admin_analytics_v1_GetIngestionStatusResponse_Link_State_Scope)[];
  '_time_lag_ms'?: "time_lag_ms";
  '_items_processed'?: "items_processed";
  '_seqno_advances'?: "seqno_advances";
}

/**
 * State represents the ingestion state at a point in time.
 */
export interface _couchbase_admin_analytics_v1_GetIngestionStatusResponse_Link_State__Output {
  /**
   * When this state snapshot was captured.
   */
  'timestamp': (_google_protobuf_Timestamp__Output | null);
  /**
   * Ingestion progress as a fraction (0.0 to 1.0).
   */
  'progress': (number);
  /**
   * Time lag in milliseconds behind the source.
   */
  'time_lag_ms'?: (string);
  /**
   * Number of items processed so far.
   */
  'items_processed'?: (string);
  /**
   * Number of sequence number advances.
   */
  'seqno_advances'?: (string);
  /**
   * Scopes being ingested.
   */
  'scopes': (_couchbase_admin_analytics_v1_GetIngestionStatusResponse_Link_State_Scope__Output)[];
  '_time_lag_ms'?: "time_lag_ms";
  '_items_processed'?: "items_processed";
  '_seqno_advances'?: "seqno_advances";
}

/**
 * GetIngestionStatusResponse contains the ingestion status of all links.
 */
export interface GetIngestionStatusResponse {
  'links'?: (_couchbase_admin_analytics_v1_GetIngestionStatusResponse_Link)[];
}

/**
 * GetIngestionStatusResponse contains the ingestion status of all links.
 */
export interface GetIngestionStatusResponse__Output {
  'links': (_couchbase_admin_analytics_v1_GetIngestionStatusResponse_Link__Output)[];
}
