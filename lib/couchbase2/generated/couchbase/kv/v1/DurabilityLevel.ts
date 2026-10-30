// Original file: couchbase/kv/v1/kv.proto

/**
 * DurabilityLevel specifies the durability requirements for mutation
 * operations. Controls how many nodes must acknowledge a write before it is
 * considered successful.
 */
export const DurabilityLevel = {
  /**
   * The mutation must be replicated to a majority of data service nodes.
   */
  DURABILITY_LEVEL_MAJORITY: 'DURABILITY_LEVEL_MAJORITY',
  /**
   * The mutation must be replicated to a majority of nodes and additionally
   * persisted to disk on the active node.
   */
  DURABILITY_LEVEL_MAJORITY_AND_PERSIST_TO_ACTIVE: 'DURABILITY_LEVEL_MAJORITY_AND_PERSIST_TO_ACTIVE',
  /**
   * The mutation must be persisted to disk on a majority of data service nodes.
   */
  DURABILITY_LEVEL_PERSIST_TO_MAJORITY: 'DURABILITY_LEVEL_PERSIST_TO_MAJORITY',
} as const;

/**
 * DurabilityLevel specifies the durability requirements for mutation
 * operations. Controls how many nodes must acknowledge a write before it is
 * considered successful.
 */
export type DurabilityLevel =
  /**
   * The mutation must be replicated to a majority of data service nodes.
   */
  | 'DURABILITY_LEVEL_MAJORITY'
  | 0
  /**
   * The mutation must be replicated to a majority of nodes and additionally
   * persisted to disk on the active node.
   */
  | 'DURABILITY_LEVEL_MAJORITY_AND_PERSIST_TO_ACTIVE'
  | 1
  /**
   * The mutation must be persisted to disk on a majority of data service nodes.
   */
  | 'DURABILITY_LEVEL_PERSIST_TO_MAJORITY'
  | 2

/**
 * DurabilityLevel specifies the durability requirements for mutation
 * operations. Controls how many nodes must acknowledge a write before it is
 * considered successful.
 */
export type DurabilityLevel__Output = typeof DurabilityLevel[keyof typeof DurabilityLevel]
