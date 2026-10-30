// Original file: couchbase/routing/v2/routing.proto

import type { ServerRouting as _couchbase_routing_v2_ServerRouting, ServerRouting__Output as _couchbase_routing_v2_ServerRouting__Output } from '../../../couchbase/routing/v2/ServerRouting';
import type { VbucketRouting as _couchbase_routing_v2_VbucketRouting, VbucketRouting__Output as _couchbase_routing_v2_VbucketRouting__Output } from '../../../couchbase/routing/v2/VbucketRouting';

/**
 * WatchRoutingResponse contains the current cluster routing configuration.
 * Each field is optional — only populated when the corresponding service
 * is available in the cluster.
 */
export interface WatchRoutingResponse {
  /**
   * Routing for the KV (data) service.
   */
  'server_routing'?: (_couchbase_routing_v2_ServerRouting | null);
  /**
   * Routing for the Views service.
   */
  'views_routing'?: (_couchbase_routing_v2_ServerRouting | null);
  /**
   * Routing for the Query (N1QL) service.
   */
  'query_routing'?: (_couchbase_routing_v2_ServerRouting | null);
  /**
   * Routing for the Search (FTS) service.
   */
  'search_routing'?: (_couchbase_routing_v2_ServerRouting | null);
  /**
   * Routing for the Analytics (CBAS) service.
   */
  'analytics_routing'?: (_couchbase_routing_v2_ServerRouting | null);
  /**
   * Vbucket distribution for the KV data service. Only present when
   * a bucket_name was specified in the request.
   */
  'vbucket_data_routing'?: (_couchbase_routing_v2_VbucketRouting | null);
  '_server_routing'?: "server_routing";
  '_views_routing'?: "views_routing";
  '_query_routing'?: "query_routing";
  '_search_routing'?: "search_routing";
  '_analytics_routing'?: "analytics_routing";
  '_vbucket_data_routing'?: "vbucket_data_routing";
}

/**
 * WatchRoutingResponse contains the current cluster routing configuration.
 * Each field is optional — only populated when the corresponding service
 * is available in the cluster.
 */
export interface WatchRoutingResponse__Output {
  /**
   * Routing for the KV (data) service.
   */
  'server_routing'?: (_couchbase_routing_v2_ServerRouting__Output | null);
  /**
   * Routing for the Views service.
   */
  'views_routing'?: (_couchbase_routing_v2_ServerRouting__Output | null);
  /**
   * Routing for the Query (N1QL) service.
   */
  'query_routing'?: (_couchbase_routing_v2_ServerRouting__Output | null);
  /**
   * Routing for the Search (FTS) service.
   */
  'search_routing'?: (_couchbase_routing_v2_ServerRouting__Output | null);
  /**
   * Routing for the Analytics (CBAS) service.
   */
  'analytics_routing'?: (_couchbase_routing_v2_ServerRouting__Output | null);
  /**
   * Vbucket distribution for the KV data service. Only present when
   * a bucket_name was specified in the request.
   */
  'vbucket_data_routing'?: (_couchbase_routing_v2_VbucketRouting__Output | null);
  '_server_routing'?: "server_routing";
  '_views_routing'?: "views_routing";
  '_query_routing'?: "query_routing";
  '_search_routing'?: "search_routing";
  '_analytics_routing'?: "analytics_routing";
  '_vbucket_data_routing'?: "vbucket_data_routing";
}
