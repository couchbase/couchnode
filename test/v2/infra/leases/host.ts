// Structural rather than importing `TestEnv`, which would close an import
// cycle, and so a lease can be tested against a stub host without a cluster.

import type { Cluster } from '../../../../lib/cluster'
import type { ClusterCapabilities, ServerFeature } from '../capabilities'
import type { TestConfig } from '../config'
import type { ConsistencyUtils } from '../consistency'
import type { ProtocolAdapter } from '../protocol/adapter'

export interface LeaseHost {
  readonly cluster: Cluster
  readonly config: TestConfig
  readonly capabilities: ClusterCapabilities
  readonly consistency: ConsistencyUtils
  /**
   * A lease waits on `host.protocol.*`, never on `host.consistency.*`, whose
   * per-node management HTTP is classic-only.
   */
  readonly protocol: ProtocolAdapter
  /** Where a provisioning fallback is recorded, when the run has a log. */
  readonly runLog?: string
  supports(feature: ServerFeature): boolean
  /**
   * Registers release with the owner, so it happens when the suite throws.
   * `release` is idempotent, so a second release is a no-op.
   */
  registerCleanup(fn: () => Promise<void>): void
}
