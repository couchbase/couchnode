// Original file: couchbase/routing/v2/routing.proto


/**
 * WatchRoutingRequest specifies the scope of routing information requested.
 */
export interface WatchRoutingRequest {
  /**
   * When specified, include vbucket routing data for this bucket.
   * When omitted, only service-level routing is returned.
   */
  'bucket_name'?: (string);
  '_bucket_name'?: "bucket_name";
}

/**
 * WatchRoutingRequest specifies the scope of routing information requested.
 */
export interface WatchRoutingRequest__Output {
  /**
   * When specified, include vbucket routing data for this bucket.
   * When omitted, only service-level routing is returned.
   */
  'bucket_name'?: (string);
  '_bucket_name'?: "bucket_name";
}
