// Original file: couchbase/internal/xdcr/v1/xdcr.proto


/**
 * GetVbucketInfoRequest requests vbucket state. Results are streamed.
 */
export interface GetVbucketInfoRequest {
  'bucket_name'?: (string);
  /**
   * The vbucket IDs to retrieve state for.
   */
  'vbucket_ids'?: (number)[];
  /**
   * When true, include the failover history for each vbucket.
   */
  'include_history'?: (boolean);
  /**
   * When true, include the maximum CAS for each vbucket.
   */
  'include_max_cas'?: (boolean);
  '_include_history'?: "include_history";
  '_include_max_cas'?: "include_max_cas";
}

/**
 * GetVbucketInfoRequest requests vbucket state. Results are streamed.
 */
export interface GetVbucketInfoRequest__Output {
  'bucket_name': (string);
  /**
   * The vbucket IDs to retrieve state for.
   */
  'vbucket_ids': (number)[];
  /**
   * When true, include the failover history for each vbucket.
   */
  'include_history'?: (boolean);
  /**
   * When true, include the maximum CAS for each vbucket.
   */
  'include_max_cas'?: (boolean);
  '_include_history'?: "include_history";
  '_include_max_cas'?: "include_max_cas";
}
