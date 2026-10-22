import { describe, expect, it } from 'vitest'

import { setFlagsFromString } from 'v8'
import { runInNewContext } from 'vm'

import type { CppConnection } from '../../../lib/binding'
import { Cluster } from '../../../lib/cluster'
import type { Collection } from '../../../lib/collection'
import { knownProfiles } from '../../../lib/configProfile'
import type { ConnectOptions } from '../../../lib/cluster'
import { AuthenticationFailureError } from '../../../lib/errors'
import { lcbVersion } from '../../../lib/couchbase'
import { LoggingMeter } from '../../../lib/loggingmeter'
import { NoOpMeter, NoOpTracer } from '../../../lib/observability'
import { ThresholdLoggingTracer } from '../../../lib/thresholdlogging'
import { withCtx } from '../../asserts/ctx'
import { expectThrows } from '../../asserts/errors'
import { ServerFeature } from '../../infra/capabilities'
import { TestEnv } from '../../infra/env'
import { CollectionStrategy } from '../../infra/requirements'
import { defineSuite } from '../../infra/suite'

// Almost every test wants its own cluster handle, from `env.openCluster()`,
// which the environment closes. Tests close their own connection only where
// closing is the subject (`close()` is idempotent): a close on the last line
// of a body leaks the connection when an earlier assertion fails, and enough
// leaks keep the run from exiting.
//
// The four instrument tests never open a socket. They stub the private `_conn`
// before calling `_connect`, because which tracer and meter the constructor
// selected is not otherwise observable.

interface ConnStub {
  openBucket: () => void
  connect: (
    connStr: string,
    auth: unknown,
    dns: unknown,
    telemetry: unknown,
    enableTracing: unknown,
    orphanConfig: unknown,
    callback: () => void
  ) => void
  shutdown: (callback: () => void) => void
  getClusterLabels: () => { clusterName: string; clusterUUID: string }
}

/**
 * A `Cluster` whose instruments are selected but whose connection is a stub.
 *
 * Element access on private members is still type checked, so a rename in
 * `lib/cluster.ts` fails here. The stub implements only the four calls
 * `_connect` makes, hence the cast to `CppConnection`.
 */
async function withStubbedConnection(
  options: ConnectOptions
): Promise<Cluster> {
  const cluster = new Cluster(UNCONNECTED, options)
  const stub: ConnStub = {
    openBucket: () => undefined,
    connect: (_connStr, _auth, _dns, _telemetry, _tracing, _orphan, callback) =>
      callback(),
    shutdown: (callback) => callback(),
    getClusterLabels: () => ({ clusterName: 'test', clusterUUID: 'uuid' }),
  }
  cluster['_conn'] = stub as unknown as CppConnection
  await cluster['_connect']()
  return cluster
}

/** The timeouts `wanDevelopment` sets, in milliseconds. */
const WAN_KV_MS = 20_000
const WAN_SERVICE_MS = 120_000

const CUSTOM_KV_MS = 5_000
const CUSTOM_KV_DURABLE_MS = 10_000
const CUSTOM_SERVICE_MS = 60_000

class TestProfile {
  apply(options: ConnectOptions): void {
    // A profile is applied after the caller's own timeouts and overrides them.
    options.timeouts = {
      ...options.timeouts,
      kvTimeout: CUSTOM_KV_MS,
      kvDurableTimeout: CUSTOM_KV_DURABLE_MS,
      analyticsTimeout: CUSTOM_SERVICE_MS,
      managementTimeout: CUSTOM_SERVICE_MS,
      queryTimeout: CUSTOM_SERVICE_MS,
      searchTimeout: CUSTOM_SERVICE_MS,
      viewTimeout: CUSTOM_SERVICE_MS,
    }
  }
}

const CUSTOM_PROFILE_NAME = 'testProfile'

/**
 * Distinct from `CUSTOM_PROFILE_NAME`, so the unknown-profile test does not
 * depend on running before the test that registers one.
 */
const UNREGISTERED_PROFILE = 'notARegisteredProfile'

/** For tests that never open a socket: no packet is ever sent here. */
const UNCONNECTED = 'couchbase://localhost'

/**
 * Inserts a document and has the environment remove it afterwards, through
 * the shared connection, since most of these tests close their own.
 */
async function insertTracked(
  env: TestEnv,
  collection: Collection,
  key: string
): Promise<void> {
  await collection.insert(key, 'bar')
  env.registerCleanup(async () => {
    await env.defaultCollection.remove(key)
  })
}

defineSuite(
  '#Cluster',
  {
    collection: CollectionStrategy.DefaultCollection,
    features: [ServerFeature.KeyValue],
  },
  ({ test }) => {
    test('should queue operations until connected', async ({ env }) => {
      // Nothing is awaited between the connect and the insert, which is what
      // makes this a test of the queue rather than of a settled connection.
      const cluster = await env.openCluster()
      const collection = cluster.bucket(env.config.bucket).defaultCollection()
      await insertTracked(env, collection, env.key())
      await cluster.close()
    })

    test('should successfully gc connections', async ({ env }) => {
      const cluster = await env.openCluster()
      const collection = cluster.bucket(env.config.bucket).defaultCollection()
      await insertTracked(env, collection, env.key())
      await cluster.close()

      // Collecting a closed connection's collection is the crash case, so the
      // collection must still be reachable when the sweep runs. `expose-gc` is
      // inlined because the package ships no type declarations.
      setFlagsFromString('--expose_gc')
      const gc = runInNewContext('gc') as () => void
      gc()
    })

    test('should successfully close an unconnected cluster and error ops', async ({
      env,
    }) => {
      const cluster = await env.openCluster()
      const collection = cluster.bucket(env.config.bucket).defaultCollection()

      await cluster.close()

      await expectThrows(
        () => collection.insert(env.key(), 'bar'),
        Error,
        undefined,
        env.ctx({ op: 'insert', extra: 'after close' })
      )
    })

    test('should error ops after close and ignore superfluous closes', async ({
      env,
    }) => {
      const cluster = await env.openCluster()
      const collection = cluster.bucket(env.config.bucket).defaultCollection()
      await insertTracked(env, collection, env.key())

      for (let i = 0; i < 4; ++i) {
        await cluster.close()
      }

      await expectThrows(
        () => collection.insert(env.key(), 'bar'),
        Error,
        undefined,
        env.ctx({ op: 'insert', extra: 'after four closes' })
      )

      await cluster.close()
      await cluster.close()
    })

    test('should error with AuthenticationFailureError', async ({ env }) => {
      await expectThrows(
        () => env.openCluster({ username: 'wrongUsername' }),
        AuthenticationFailureError,
        undefined,
        env.ctx({ op: 'connect', extra: 'username=wrongUsername' })
      )
    })

    test('should use wanDevelopment config profile', async ({ env }) => {
      const cluster = await env.openCluster(
        {},
        { configProfile: 'wanDevelopment' }
      )
      // One assertion per timeout rather than a loop over a table, so a failure
      // names the property that is wrong.
      expect(cluster.kvTimeout, 'kvTimeout').toStrictEqual(WAN_KV_MS)
      expect(cluster.kvDurableTimeout, 'kvDurableTimeout').toStrictEqual(
        WAN_KV_MS
      )
      expect(cluster.analyticsTimeout, 'analyticsTimeout').toStrictEqual(
        WAN_SERVICE_MS
      )
      expect(cluster.managementTimeout, 'managementTimeout').toStrictEqual(
        WAN_SERVICE_MS
      )
      expect(cluster.queryTimeout, 'queryTimeout').toStrictEqual(WAN_SERVICE_MS)
      expect(cluster.searchTimeout, 'searchTimeout').toStrictEqual(
        WAN_SERVICE_MS
      )
      expect(cluster.viewTimeout, 'viewTimeout').toStrictEqual(WAN_SERVICE_MS)
      expect(cluster.bootstrapTimeout, 'bootstrapTimeout').toStrictEqual(
        WAN_SERVICE_MS
      )
      expect(cluster.connectTimeout, 'connectTimeout').toStrictEqual(WAN_KV_MS)
      expect(cluster.resolveTimeout, 'resolveTimeout').toStrictEqual(WAN_KV_MS)
    })

    test('should use custom config profile', async ({ env }) => {
      knownProfiles.registerProfile(CUSTOM_PROFILE_NAME, new TestProfile())
      const cluster = await env.openCluster(
        {},
        { configProfile: CUSTOM_PROFILE_NAME }
      )
      expect(cluster.kvTimeout, 'kvTimeout').toStrictEqual(CUSTOM_KV_MS)
      expect(cluster.kvDurableTimeout, 'kvDurableTimeout').toStrictEqual(
        CUSTOM_KV_DURABLE_MS
      )
      expect(cluster.analyticsTimeout, 'analyticsTimeout').toStrictEqual(
        CUSTOM_SERVICE_MS
      )
      expect(cluster.managementTimeout, 'managementTimeout').toStrictEqual(
        CUSTOM_SERVICE_MS
      )
      expect(cluster.queryTimeout, 'queryTimeout').toStrictEqual(
        CUSTOM_SERVICE_MS
      )
      expect(cluster.searchTimeout, 'searchTimeout').toStrictEqual(
        CUSTOM_SERVICE_MS
      )
      expect(cluster.viewTimeout, 'viewTimeout').toStrictEqual(
        CUSTOM_SERVICE_MS
      )
    })

    test('should not expose auth info in cluster', ({ cluster }) => {
      const serialized = JSON.parse(JSON.stringify(cluster)) as {
        _auth: unknown
      }
      expect(serialized._auth, 'the serialized cluster authenticator').toBe(
        '***hidden***'
      )
    })

    test('should not expose cluster auth info in bucket', ({ env }) => {
      const serialized = JSON.parse(JSON.stringify(env.bucket)) as {
        _cluster: { _auth: unknown }
      }
      expect(
        serialized._cluster._auth,
        "the serialized bucket's cluster authenticator"
      ).toBe('***hidden***')
    })
  }
)

// The `#Cluster` tests that need no server, in their own block so they run
// without a cluster. It shares the integration block's title, so all of them
// report under `#Cluster`.
describe('#Cluster', () => {
  it('lcbVersion property should work', () => {
    expect(lcbVersion, 'lcbVersion').toBeTypeOf('string')
  })

  it('should error when config profile is not registered', () => {
    expect(
      () =>
        new Cluster(UNCONNECTED, {
          username: 'test',
          password: 'pass',
          configProfile: UNREGISTERED_PROFILE,
        }),
      withCtx('an unregistered profile', {
        extra: `profile=${UNREGISTERED_PROFILE}`,
      })
    ).toThrow(`${UNREGISTERED_PROFILE} is not a registered profile.`)
  })

  it('should use NoOpTracer when tracing is disabled', async () => {
    const cluster = await withStubbedConnection({
      username: 'test',
      password: 'pass',
      tracingConfig: { enableTracing: false },
    })
    expect(
      cluster.observabilityInstruments.tracer,
      'the tracer with tracing disabled'
    ).toBeInstanceOf(NoOpTracer)
    await cluster.close()
  })

  it('should use ThresholdLoggingTracer by default', async () => {
    const cluster = await withStubbedConnection({
      username: 'test',
      password: 'pass',
    })
    expect(
      cluster.observabilityInstruments.tracer,
      'the default tracer'
    ).toBeInstanceOf(ThresholdLoggingTracer)
    await cluster.close()
  })

  it('should use NoOpMeter when metrics are disabled', async () => {
    const cluster = await withStubbedConnection({
      username: 'test',
      password: 'pass',
      metricsConfig: { enableMetrics: false },
    })
    expect(
      cluster.observabilityInstruments.meter,
      'the meter with metrics disabled'
    ).toBeInstanceOf(NoOpMeter)
    await cluster.close()
  })

  it('should use LoggingMeter by default', async () => {
    const cluster = await withStubbedConnection({
      username: 'test',
      password: 'pass',
    })
    expect(
      cluster.observabilityInstruments.meter,
      'the default meter'
    ).toBeInstanceOf(LoggingMeter)
    await cluster.close()
  })
})
