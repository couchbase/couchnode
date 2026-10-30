// Original file: couchbase/kv/v1/kv.proto


/**
 * LegacyDurabilitySpec provides legacy-style observe-based durability by
 * specifying the number of nodes that must replicate and persist the mutation.
 */
export interface LegacyDurabilitySpec {
  /**
   * Number of replica nodes that must acknowledge the mutation.
   */
  'num_replicated'?: (number);
  /**
   * Number of nodes (active + replicas) that must persist the mutation to disk.
   */
  'num_persisted'?: (number);
}

/**
 * LegacyDurabilitySpec provides legacy-style observe-based durability by
 * specifying the number of nodes that must replicate and persist the mutation.
 */
export interface LegacyDurabilitySpec__Output {
  /**
   * Number of replica nodes that must acknowledge the mutation.
   */
  'num_replicated': (number);
  /**
   * Number of nodes (active + replicas) that must persist the mutation to disk.
   */
  'num_persisted': (number);
}
