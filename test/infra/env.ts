// `TestEnv`: one per test file. It owns the connection handles, the capability
// snapshot, and the lifetime of anything it hands out.
//
// It does not know which suite is running. A suite testing a management API
// asks the SDK for it (`env.bucket.collections()`); one needing a management
// side effect gets it from a lease.

import { Bucket } from '../../lib/bucket'
import { Cluster } from '../../lib/cluster'
import type { ConnectOptions } from '../../lib/cluster'
import { Collection } from '../../lib/collection'
import { Scope } from '../../lib/scope'
import { AssertCtx } from '../asserts/ctx'
import {
  ClusterCapabilities,
  ServerFeature,
  formatVersion,
  isClassic,
  supports,
  versionAtLeast,
} from './capabilities'
import { TestConfig } from './config'
import { ConsistencyUtils } from './consistency'
import { ProtocolAdapter, adapterFor } from './protocol/adapter'
import { DocBatch } from './data/loader'
import type { DocBatchSpec } from './data/loader'
import { CollectionLease, acquireCollection } from './leases/collection-lease'
import { keyPrefix, newFileToken } from './naming'
import type { ResolvedRequirements } from './requirements'

/** Where to connect and as whom, resolved once per run by globalSetup. */
export interface ClusterConnection {
  readonly connectionString: string
  readonly username?: string
  readonly password?: string
}

/**
 * SDK connect options a suite may add to a connection of its own: a config
 * profile, a logger, a meter or a tracer. Credentials are excluded; they are
 * `ClusterConnection` fields, so there is one way to say who connects.
 */
export type ConnectOverrides = Omit<ConnectOptions, 'username' | 'password'>

export interface TestEnvOptions {
  readonly config: TestConfig
  readonly capabilities: ClusterCapabilities
  readonly connection: ClusterConnection
  /** Stamped once per run; makes keys unique across runs as well as workers. */
  readonly runId: string
  /** Where a provisioning fallback is recorded, when the run has a log. */
  readonly runLog?: string
}

type Cleanup = () => Promise<void>

export class TestEnv {
  private readonly cleanups: Cleanup[] = []
  private readonly extraClusters: Cluster[] = []
  private readonly leases = new Map<string, Promise<CollectionLease>>()
  private readonly batches = new Map<string, Promise<DocBatch>>()
  private readonly keyedClusters = new Map<string, Promise<Cluster>>()
  private clusterNameRead: Promise<string | null> | undefined
  private keyCounter = 0
  private readonly keyPrefix_: string
  private closed = false

  private constructor(
    private readonly cluster_: Cluster,
    private readonly bucket_: Bucket,
    readonly consistency: ConsistencyUtils,
    /** Leases use this rather than `consistency`; see `protocol/adapter.ts`. */
    readonly protocol: ProtocolAdapter,
    readonly config: TestConfig,
    readonly capabilities: ClusterCapabilities,
    /**
     * Readable so `exit.ts` can hand it to a child process; a connection in
     * this process comes from `openCluster`.
     */
    readonly connection: ClusterConnection,
    private readonly runId: string,
    readonly runLog?: string
  ) {
    this.keyPrefix_ = keyPrefix(runId, newFileToken())
  }

  static async open(opts: TestEnvOptions): Promise<TestEnv> {
    const cluster = await connect(opts.connection)
    let env: TestEnv
    try {
      const bucket = cluster.bucket(opts.config.bucket)
      const consistency = new ConsistencyUtils(
        managementHost(opts.connection.connectionString),
        `${opts.connection.username ?? ''}:${opts.connection.password ?? ''}`
      )
      // couchbase2 has no mock: it runs against a real gateway or not at all.
      await consistency.waitForConfig(
        isClassic(opts.capabilities) && opts.capabilities.backend !== 'none'
      )

      env = new TestEnv(
        cluster,
        bucket,
        consistency,
        adapterFor(opts.config.protocol, consistency),
        opts.config,
        opts.capabilities,
        opts.connection,
        opts.runId,
        opts.runLog
      )
    } catch (err) {
      // A leaked connection keeps the run from exiting, so nothing here may
      // throw without closing what it already opened.
      await cluster.close().catch(() => undefined)
      throw err
    }
    return env
  }

  get cluster(): Cluster {
    return this.cluster_
  }

  get bucket(): Bucket {
    return this.bucket_
  }

  get defaultScope(): Scope {
    return this.bucket_.defaultScope()
  }

  get defaultCollection(): Collection {
    return this.bucket_.defaultCollection()
  }

  collection(scopeName: string, collectionName: string): Collection {
    return this.bucket_.scope(scopeName).collection(collectionName)
  }

  supports(feature: ServerFeature): boolean {
    return supports(this.capabilities, feature)
  }

  /**
   * Whether the server is at least this version. Only for assertions whose
   * shape changed with a release and no capability names it (8.0 made magma
   * and full eviction the bucket defaults); prefer `supports()` everywhere
   * else. Always false under `couchbase2`, which has no detectable version.
   */
  versionAtLeast(major: number, minor = 0, patch = 0): boolean {
    return (
      isClassic(this.capabilities) &&
      versionAtLeast(this.capabilities.version, { major, minor, patch })
    )
  }

  /** A key unique to this run, worker, file and call. */
  key(): string {
    return `${this.keyPrefix_}_${++this.keyCounter}`
  }

  /** Pre-seeded with what the env knows: `env.ctx({ op: 'get', key })`. */
  ctx(extra: AssertCtx = {}): AssertCtx {
    return {
      bucket: this.config.bucket,
      // Omitted rather than faked under couchbase2, which has no detectable
      // version.
      serverVersion: isClassic(this.capabilities)
        ? formatVersion(this.capabilities.version)
        : undefined,
      ...extra,
    }
  }

  /**
   * A second connection, closed with the env so it closes on the failure path
   * too. Suites never call `Cluster.connect` themselves.
   */
  async openCluster(
    overrides: Partial<ClusterConnection> = {},
    options: ConnectOverrides = {}
  ): Promise<Cluster> {
    const cluster = await connect({ ...this.connection, ...overrides }, options)
    this.extraClusters.push(cluster)
    return cluster
  }

  /**
   * Opened once per file per `key`, for suites needing several configured
   * connections at once (a recording meter beside a no-op one). `options` is
   * read on the first call for a key only.
   */
  async sharedCluster(
    key: string,
    options: ConnectOverrides = {}
  ): Promise<Cluster> {
    const existing = this.keyedClusters.get(key)
    if (existing) {
      return existing
    }

    const pending = this.openCluster({}, options)
    this.keyedClusters.set(key, pending)
    try {
      return await pending
    } catch (err) {
      // Not cached, for the reason `collectionLeaseFor` gives.
      this.keyedClusters.delete(key)
      throw err
    }
  }

  /**
   * Decides whether a metric should carry `couchbase.cluster.name` and
   * `.uuid`. Read over the management API, independently of
   * `Cluster._getClusterLabels()`, which is what the metric's labels come
   * from. Null on a mock, under couchbase2 and below
   * `ServerFeature.ClusterLabels`. A failed read throws rather than answering
   * "no labels", which would skip the label assertions and pass.
   */
  async clusterName(): Promise<string | null> {
    if (!this.clusterNameRead) {
      this.clusterNameRead = this.readClusterName()
    }
    const pending = this.clusterNameRead
    try {
      return await pending
    } catch (err) {
      // Not cached, for the reason `collectionLeaseFor` gives.
      if (this.clusterNameRead === pending) {
        this.clusterNameRead = undefined
      }
      throw err
    }
  }

  private async readClusterName(): Promise<string | null> {
    if (
      !isClassic(this.capabilities) ||
      this.capabilities.backend !== 'none' ||
      !this.supports(ServerFeature.ClusterLabels)
    ) {
      return null
    }
    return this.consistency.getClusterName()
  }

  /**
   * The calling fixture is test-scoped (Vitest will not let `defineSuite`
   * redefine a file-scoped one per describe block), so the lease is memoised
   * here per (strategy, suite) and released by the env. The in-flight promise
   * is memoised, so two tests starting together do not provision twice.
   */
  async collectionLeaseFor(
    requirements: ResolvedRequirements,
    opts: { readonly cluster?: Cluster; readonly signal?: AbortSignal } = {}
  ): Promise<CollectionLease> {
    const key = `${requirements.collection}:${requirements.suiteName}`
    const existing = this.leases.get(key)
    if (existing) {
      return existing
    }

    const pending = acquireCollection(this, requirements, opts)
    this.leases.set(key, pending)
    try {
      return await pending
    } catch (err) {
      // Not cached: the next test would fail with this rejection without an
      // attempt of its own, blamed on a test that had nothing to do with it.
      this.leases.delete(key)
      throw err
    }
  }

  /**
   * The suite's shared document batch, loaded once and purged with the env. A
   * test wanting a batch of its own calls `DocBatch.load` and owns it.
   */
  async docsFor(
    requirements: ResolvedRequirements,
    collection: Collection,
    spec: Omit<DocBatchSpec, 'uid'> = {}
  ): Promise<DocBatch> {
    const key = `${requirements.suiteName}:${collection.name}`
    const existing = this.batches.get(key)
    if (existing) {
      return existing
    }

    const pending = DocBatch.load(collection, { ...spec, uid: this.key() })
    this.batches.set(key, pending)
    try {
      const batch = await pending
      this.registerCleanup(() => batch.purge())
      return batch
    } catch (err) {
      this.batches.delete(key)
      throw err
    }
  }

  /** Registered cleanups run in reverse order, and every one of them runs. */
  registerCleanup(fn: Cleanup): void {
    this.cleanups.push(fn)
  }

  async close(): Promise<void> {
    if (this.closed) {
      return
    }
    this.closed = true

    const failures: unknown[] = []

    for (const cleanup of [...this.cleanups].reverse()) {
      try {
        await cleanup()
      } catch (err) {
        failures.push(err)
      }
    }
    this.cleanups.length = 0

    this.keyedClusters.clear()
    for (const cluster of this.extraClusters.splice(0)) {
      try {
        await cluster.close()
      } catch (err) {
        failures.push(err)
      }
    }

    try {
      await this.cluster_.close()
    } catch (err) {
      failures.push(err)
    }

    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        `${failures.length} teardown step(s) failed while closing the test environment`
      )
    }
  }
}

function connect(
  connection: ClusterConnection,
  options: ConnectOverrides = {}
): Promise<Cluster> {
  return Cluster.connect(connection.connectionString, {
    // Tracing off by default; the spread after it lets a suite turn it on.
    tracingConfig: { enableTracing: false },
    ...options,
    username: connection.username,
    password: connection.password,
  })
}

/**
 * The first host in a connection string, for the consistency checker, which
 * discovers the other nodes from it.
 */
export function managementHost(connectionString: string): string {
  const withoutScheme = connectionString.replace(/^[a-z0-9+.-]+:\/\//i, '')
  const hosts = withoutScheme.split('?')[0]
  const first = hosts.split(',')[0]
  return first.split(':')[0]
}
