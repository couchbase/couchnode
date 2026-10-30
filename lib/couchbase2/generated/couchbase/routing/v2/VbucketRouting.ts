// Original file: couchbase/routing/v2/routing.proto


/**
 * VbucketRouting describes the distribution of vbuckets across servers.
 * Used for KV data operations to determine which server handles a given key.
 */
export interface VbucketRouting {
  /**
   * Total number of vbuckets for this bucket.
   */
  'num_vbuckets'?: (number);
  /**
   * Mapping of vbucket IDs to local server indices.
   */
  'local_vbuckets'?: (number)[];
  /**
   * Mapping of vbucket IDs to group (remote) server indices.
   */
  'group_vbuckets'?: (number)[];
}

/**
 * VbucketRouting describes the distribution of vbuckets across servers.
 * Used for KV data operations to determine which server handles a given key.
 */
export interface VbucketRouting__Output {
  /**
   * Total number of vbuckets for this bucket.
   */
  'num_vbuckets': (number);
  /**
   * Mapping of vbucket IDs to local server indices.
   */
  'local_vbuckets': (number)[];
  /**
   * Mapping of vbucket IDs to group (remote) server indices.
   */
  'group_vbuckets': (number)[];
}
