// Original file: couchbase/routing/v2/routing.proto


/**
 * ServerRouting describes the number of servers available for a service,
 * split by network locality.
 */
export interface ServerRouting {
  /**
   * Number of servers in the local (same-datacenter) group.
   */
  'num_local_servers'?: (number);
  /**
   * Number of servers in the remote (other-datacenter) group.
   */
  'num_group_servers'?: (number);
}

/**
 * ServerRouting describes the number of servers available for a service,
 * split by network locality.
 */
export interface ServerRouting__Output {
  /**
   * Number of servers in the local (same-datacenter) group.
   */
  'num_local_servers': (number);
  /**
   * Number of servers in the remote (other-datacenter) group.
   */
  'num_group_servers': (number);
}
