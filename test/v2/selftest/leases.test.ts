// The lease resolution rules, against a stub host.
//
// A wrong route fails silently (a suite handed a shared collection instead of
// a clean one still passes), so routes are pinned by the management calls
// actually made. A stub reporting no collections also covers the pre-7.0
// fallback, including that the substitution is recorded.

import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

import type { Cluster } from '../../../lib/cluster'
import type { Collection } from '../../../lib/collection'
import { DocumentNotFoundError } from '../../../lib/errors'
import { ServerFeature, TestProtocol } from '../infra/capabilities'
import type { ClusterCapabilities } from '../infra/capabilities'
import type { TestConfig } from '../infra/config'
import type { ConsistencyUtils } from '../infra/consistency'
import { acquireCollection } from '../infra/leases/collection-lease'
import type { LeaseHost } from '../infra/leases/host'
import { PROBE_KEYS } from '../infra/leases/readiness'
import { leaseStampMs, resourceName } from '../infra/naming'
import { ClassicProtocolAdapter } from '../infra/protocol/adapter'
import { CollectionStrategy, DEFAULT_REQUIREMENTS } from '../infra/requirements'
import type { ResolvedRequirements } from '../infra/requirements'
import { readNotices, summarizeNotices } from '../infra/runlog'
import type { RunNotice } from '../infra/runlog'

const BUCKET = 'default'

interface Calls {
  readonly buckets: string[]
  readonly bucketsDropped: string[]
  readonly scopes: string[]
  readonly scopesDropped: string[]
  readonly collections: string[]
  readonly cleanups: (() => Promise<void>)[]
  /** How many cleanups were registered as each scope create was issued. */
  readonly cleanupsBeforeCreate: number[]
  readonly notices: RunNotice[]
}

/** A host that records what was asked of it instead of doing it. */
function stubHost(
  supported: readonly ServerFeature[],
  /**
   * Scopes the cluster already has, as a dead run would leave. The lease reads
   * the manifest to sweep stale scopes and to drop only what is there.
   */
  existingScopes: readonly string[] = []
): {
  host: LeaseHost
  calls: Calls
} {
  const calls: Calls = {
    buckets: [],
    bucketsDropped: [],
    scopes: [],
    scopesDropped: [],
    collections: [],
    cleanups: [],
    cleanupsBeforeCreate: [],
    notices: [],
  }

  const collection = {
    name: 'stub',
    get: async () => {
      throw new DocumentNotFoundError()
    },
  } as unknown as Collection

  // A manifest, not a call log: the lease asks what is there before dropping.
  const manifest = new Set<string>(existingScopes)

  const collectionManager = {
    getAllScopes: async () =>
      [...manifest].map((name) => ({ name, collections: [] })),
    createScope: async (name: string) => {
      calls.cleanupsBeforeCreate.push(calls.cleanups.length)
      calls.scopes.push(name)
      manifest.add(name)
    },
    dropScope: async (name: string) => {
      calls.scopesDropped.push(name)
      manifest.delete(name)
    },
    createCollection: async (name: string, scope: string) => {
      calls.collections.push(`${scope}.${name}`)
    },
  }

  const bucket = {
    name: BUCKET,
    defaultCollection: () => collection,
    collections: () => collectionManager,
    scope: () => ({ collection: () => collection }),
  }

  const cluster = {
    bucket: () => bucket,
    buckets: () => ({
      createBucket: async (settings: { name: string }) => {
        calls.buckets.push(settings.name)
      },
      dropBucket: async (name: string) => {
        calls.bucketsDropped.push(name)
      },
    }),
  } as unknown as Cluster

  const consistency = {
    waitUntilBucketPresent: async () => undefined,
    waitUntilBucketDropped: async () => undefined,
    waitUntilScopePresent: async () => undefined,
    waitUntilScopeDropped: async () => undefined,
    waitUntilCollectionPresent: async () => undefined,
  } as unknown as ConsistencyUtils

  const host: LeaseHost = {
    cluster,
    config: { bucket: BUCKET } as TestConfig,
    capabilities: {
      protocol: TestProtocol.Classic,
      backend: 'none',
    } as ClusterCapabilities,
    consistency,
    // The real adapter over the stubbed consistency, so its delegation is
    // exercised too.
    protocol: new ClassicProtocolAdapter(consistency),
    supports: (feature) => supported.includes(feature),
    registerCleanup: (fn) => {
      calls.cleanups.push(fn)
    },
  }

  return { host, calls }
}

function requirements(
  collection: ResolvedRequirements['collection'],
  suiteName = 'a suite'
): ResolvedRequirements {
  return { ...DEFAULT_REQUIREMENTS, suiteName, collection }
}

describe('default collection strategy', () => {
  it('provisions nothing at all', async () => {
    const { host, calls } = stubHost([ServerFeature.Collections])

    const lease = await acquireCollection(
      host,
      requirements(CollectionStrategy.DefaultCollection)
    )

    expect(lease.route).toBe('default-collection')
    expect(lease.scopeName).toBe('_default')
    expect(lease.collectionName).toBe('_default')
    expect(calls.buckets).toEqual([])
    expect(calls.scopes).toEqual([])
    expect(calls.cleanups).toEqual([])
  })

  it('waits for the shared bucket to answer key-value', async () => {
    // The bucket is opened by the connection, lazily, so a suite's first
    // operation can otherwise arrive before it is open and time out without
    // ever being sent.
    const { host } = stubHost([
      ServerFeature.Collections,
      ServerFeature.KeyValue,
    ])
    const probed: string[] = []
    const collection = host.cluster.bucket(BUCKET).defaultCollection()
    Object.assign(collection, {
      get: async (key: string) => {
        probed.push(key)
        throw new DocumentNotFoundError()
      },
    })

    await acquireCollection(
      host,
      requirements(CollectionStrategy.DefaultCollection)
    )

    expect(probed).toEqual(PROBE_KEYS)
  })

  it('releases without touching anything', async () => {
    const { host, calls } = stubHost([ServerFeature.Collections])
    const lease = await acquireCollection(
      host,
      requirements(CollectionStrategy.DefaultCollection)
    )

    await lease.release()

    expect(calls.scopesDropped).toEqual([])
    expect(calls.bucketsDropped).toEqual([])
  })
})

describe('named collection strategies', () => {
  it('creates a scope and collection under a newly minted name', async () => {
    const { host, calls } = stubHost([ServerFeature.Collections])

    const lease = await acquireCollection(
      host,
      requirements(CollectionStrategy.Named, 'kv range scan')
    )

    expect(lease.route).toBe('collection')
    expect(leaseStampMs(lease.scopeName)).not.toBeNull()
    expect(lease.collectionName).toBe(lease.scopeName.replace(/^s_/, 'c_'))
    expect(calls.scopes).toEqual([lease.scopeName])
    expect(calls.collections).toEqual([
      `${lease.scopeName}.${lease.collectionName}`,
    ])
  })

  it('gives two suites different collections', async () => {
    const { host } = stubHost([ServerFeature.Collections])
    const first = await acquireCollection(
      host,
      requirements(CollectionStrategy.Named, 'first suite')
    )
    const second = await acquireCollection(
      host,
      requirements(CollectionStrategy.Named, 'second suite')
    )

    expect(first.scopeName).not.toBe(second.scopeName)
  })

  it('never reuses a name, even for the same suite', async () => {
    // The same suite name twice, as two files declaring `#basic tracing` do.
    // A reused name would be dropped and recreated, and the management API
    // lists a recreated scope before every node has finished with the old one.
    const { host, calls } = stubHost([ServerFeature.Collections])
    const first = await acquireCollection(
      host,
      requirements(CollectionStrategy.Named, 's')
    )
    const second = await acquireCollection(
      host,
      requirements(CollectionStrategy.Named, 's')
    )

    expect(first.scopeName).not.toBe(second.scopeName)
    expect(calls.scopes).toEqual([first.scopeName, second.scopeName])
  })

  it('drops nothing before creating when nothing is stale', async () => {
    const { host, calls } = stubHost([ServerFeature.Collections])
    await acquireCollection(host, requirements(CollectionStrategy.Named, 's'))

    expect(calls.scopesDropped).toEqual([])
  })

  it("sweeps a dead run's scopes and nothing else", async () => {
    // A scope minted seven hours ago belongs to a process that died before
    // releasing it. One minted a minute ago may belong to a file still
    // running, here or in a concurrent run, and a scope this tree did not
    // name is not its to drop at any age.
    const minuteMs = 60_000
    const named = (agoMs: number) =>
      `s_${Math.floor((Date.now() - agoMs) / minuteMs).toString(36)}_1_abcdef`
    const stale = named(7 * 60 * minuteMs)
    const live = named(minuteMs)
    const { host, calls } = stubHost(
      [ServerFeature.Collections],
      [stale, live, 'inventory', resourceName('scope', 'a suite')]
    )
    await acquireCollection(host, requirements(CollectionStrategy.Named))

    expect(calls.scopesDropped).toEqual([stale])
  })

  it('registers release with the host before creating anything', async () => {
    // Registered on the way in: a half-succeeded create still leaves
    // something to drop.
    const { host, calls } = stubHost([ServerFeature.Collections])
    await acquireCollection(host, requirements(CollectionStrategy.Named))

    expect(calls.cleanupsBeforeCreate).toEqual([1])
    await calls.cleanups[0]()
    expect(calls.scopesDropped).toEqual(calls.scopes)
  })

  it('releases only once, however many times it is asked', async () => {
    const { host, calls } = stubHost([ServerFeature.Collections])
    const lease = await acquireCollection(
      host,
      requirements(CollectionStrategy.Named)
    )

    await lease.release()
    await lease.release()
    await calls.cleanups[0]()

    // Idempotent, so the fixture and the env can both call release.
    expect(calls.scopesDropped).toHaveLength(1)
  })
})

describe('clean default collection strategy', () => {
  it('leases a bucket and hands back its default collection', async () => {
    // The shared bucket's `_default._default` holds every DefaultCollection
    // suite's documents, so an empty one needs a bucket of its own.
    const { host, calls } = stubHost([ServerFeature.Collections])

    const lease = await acquireCollection(
      host,
      requirements(CollectionStrategy.CleanDefault, 'range scan')
    )

    expect(lease.route).toBe('clean-default-bucket')
    expect(lease.bucketName).toBe(resourceName('bucket', 'range scan'))
    expect(lease.scopeName).toBe('_default')
    expect(lease.collectionName).toBe('_default')
    expect(calls.buckets).toEqual([resourceName('bucket', 'range scan')])
    expect(calls.scopes).toEqual([])
    expect(calls.collections).toEqual([])
  })

  it('drops a leftover bucket before creating', async () => {
    // A bucket left by a dead run still holds its documents, so this strategy
    // drops it rather than reusing it. Asserted before any release, so the
    // drop can only have come from acquisition.
    const { host, calls } = stubHost([ServerFeature.Collections])

    await acquireCollection(
      host,
      requirements(CollectionStrategy.CleanDefault, 's')
    )

    expect(calls.bucketsDropped).toEqual([resourceName('bucket', 's')])
  })

  it('does not let the pre-create drop latch the lease as released', async () => {
    // Routing the pre-create drop through the lease's own release would make
    // the real teardown a no-op and leak the bucket just created.
    const { host, calls } = stubHost([ServerFeature.Collections])
    const lease = await acquireCollection(
      host,
      requirements(CollectionStrategy.CleanDefault, 's')
    )

    await lease.release()

    expect(calls.bucketsDropped).toEqual([
      resourceName('bucket', 's'),
      resourceName('bucket', 's'),
    ])
  })

  it('registers release with the host before creating anything', async () => {
    const { host, calls } = stubHost([ServerFeature.Collections])
    await acquireCollection(host, requirements(CollectionStrategy.CleanDefault))

    expect(calls.cleanups).toHaveLength(1)
    await calls.cleanups[0]()
    expect(calls.bucketsDropped).toHaveLength(2)
  })

  it('records no provisioning notice', async () => {
    // The provisioning channel means "a route the suite did not ask for", and
    // this is the route it asked for.
    const { host } = stubHost([ServerFeature.Collections])
    const runLog = tempLog()

    await acquireCollection(
      { ...host, runLog },
      requirements(CollectionStrategy.CleanDefault, 'range scan')
    )

    expect(readNotices(runLog)).toEqual([])
  })

  it('takes the same route on a server without collections', async () => {
    // Nothing here wants collections, so there is no substitution to make and
    // nothing to report, unlike Named, which loses something real.
    const { host, calls } = stubHost([
      ServerFeature.KeyValue,
      ServerFeature.BucketManagement,
    ])
    const runLog = tempLog()

    const lease = await acquireCollection(
      { ...host, runLog },
      requirements(CollectionStrategy.CleanDefault, 's')
    )

    expect(lease.route).toBe('clean-default-bucket')
    expect(calls.buckets).toEqual([resourceName('bucket', 's')])
    expect(readNotices(runLog)).toEqual([])
  })
})

describe('servers without collections', () => {
  const preCollections = [
    ServerFeature.KeyValue,
    ServerFeature.BucketManagement,
  ]

  it('leases a whole bucket instead, and says so', async () => {
    const { host, calls } = stubHost(preCollections)
    const runLog = tempLog()

    const lease = await acquireCollection(
      { ...host, runLog },
      requirements(CollectionStrategy.Named, 'range scan')
    )

    expect(lease.route).toBe('bucket-fallback')
    expect(calls.buckets).toEqual([resourceName('bucket', 'range scan')])
    expect(calls.scopes).toEqual([])
    // A fresh bucket's default collection is empty, which is what Named
    // promises.
    expect(lease.scopeName).toBe('_default')
    expect(lease.collectionName).toBe('_default')

    const notices = readNotices(runLog)
    expect(notices).toHaveLength(1)
    expect(notices[0].channel).toBe('provisioning')
    expect(notices[0].suite).toBe('range scan')
    expect(notices[0].kind).toBe('bucket-fallback')
  })

  it('drops the bucket before creating and on release', async () => {
    // Named promises an empty collection, so the fallback bucket is acquired
    // clean: the first drop clears a dead run's leftover, the second is the
    // release.
    const { host, calls } = stubHost(preCollections)
    const lease = await acquireCollection(
      host,
      requirements(CollectionStrategy.Named, 's')
    )

    expect(calls.bucketsDropped).toEqual([resourceName('bucket', 's')])

    await lease.release()

    expect(calls.bucketsDropped).toEqual([
      resourceName('bucket', 's'),
      resourceName('bucket', 's'),
    ])
  })

  it('still provisions nothing for the default strategy', async () => {
    // Pre-7.0 the default collection is the only one, so no fallback applies.
    const { host, calls } = stubHost(preCollections)
    const lease = await acquireCollection(
      host,
      requirements(CollectionStrategy.DefaultCollection)
    )

    expect(lease.route).toBe('default-collection')
    expect(calls.buckets).toEqual([])
  })
})

describe('the run log keeps its channels apart', () => {
  it('counts a fallback separately from a skip', () => {
    // A skip is coverage not taken; a fallback is coverage taken by another
    // route, so they are counted apart.
    const summary = summarizeNotices([
      { channel: 'skip', suite: 'a', kind: 'no-cluster', reason: 'no cluster' },
      {
        channel: 'provisioning',
        suite: 'b',
        kind: 'bucket-fallback',
        reason: 'no collections',
      },
    ])

    expect(summary).toContain('1 suite(s) skipped')
    expect(summary).toContain('1 suite(s) provisioned by a fallback route')
  })

  it('says nothing when nothing was decided', () => {
    expect(summarizeNotices([])).toBe('')
  })
})

function tempLog(): string {
  return join(
    mkdtempSync(join(tmpdir(), 'couchnode-lease-selftest-')),
    'notices.jsonl'
  )
}
