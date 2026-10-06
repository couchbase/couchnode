// What globalSetup hands to every worker.
//
// Plain data: it crosses a process boundary, so nothing here may
// be a live handle. The cluster connection is described, not shared: each
// worker opens its own.

import { ClusterCapabilities } from './capabilities'
import { TestConfig } from './config'
import { ClusterConnection } from './env'

export interface RunStateReady {
  readonly kind: 'ready'
  /** Where a worker appends what the harness decided, and why. */
  readonly runLog: string
  readonly config: TestConfig
  readonly capabilities: ClusterCapabilities
  readonly connection: ClusterConnection
  readonly runId: string
  /** One line naming what we are testing against, for the run header. */
  readonly description: string
}

/**
 * No cluster was configured at all: `CNCSTR` unset and `CNMOCK=none`. Suites
 * needing a server skip; cluster-free suites run normally. This is what a
 * contributor with no server gets, and it must not read as a broken
 * environment.
 */
export interface RunStateNoCluster {
  readonly kind: 'no-cluster'
  readonly runLog: string
  readonly config: TestConfig
  readonly runId: string
  readonly reason: string
}

export type RunState = RunStateReady | RunStateNoCluster

declare module 'vitest' {
  interface ProvidedContext {
    runState: RunState
  }
}
