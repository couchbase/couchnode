// The infrastructure exercised against whatever the run is pointed at.
//
// These are the checks that cannot be made without a cluster: that the version
// is really detected, that a suite's declared requirements reach its fixtures,
// and that opening and closing an environment leaves nothing behind.

import { describe, expect, inject, it } from 'vitest'

import {
  ClassicCapabilities,
  ClusterCapabilities,
  ServerFeature,
  formatVersion,
  isClassic,
  parseVersion,
} from '../infra/capabilities'
import { leaseStampMs } from '../infra/naming'
import { TIER_RANK } from '../infra/config'
import { CollectionStrategy } from '../infra/requirements'
import { probeCluster } from '../infra/probe'
import type { SkipGate } from '../infra/skips'
import { defineSuite, skippedSuites } from '../infra/suite'

/**
 * Narrows a run's capabilities to the classic protocol. The assertions below
 * are about things `couchbase2` does not have, so this throws rather than
 * letting an early `return` report a pass.
 */
function classicOnly(caps: ClusterCapabilities): ClassicCapabilities {
  if (!isClassic(caps)) {
    throw new Error(
      `this suite asserts on classic-only detection, but the run protocol is ` +
        `'${caps.protocol}'. It should have been gated by protocols: [classic].`
    )
  }
  return caps
}

/** A mock declares its capabilities rather than probing them. */
function onMock(caps: ClusterCapabilities): SkipGate | false {
  if (!isClassic(caps) || caps.backend === 'none') {
    return false
  }
  return {
    kind: 'no-cluster',
    reason:
      `The ${caps.backend} backend is not probed, so there is no ` +
      `detection to check.`,
  }
}

defineSuite(
  'infra: test environment',
  { features: [ServerFeature.KeyValue] },
  ({ test, capabilities }) => {
    test('hands out a usable collection', async ({ collection, env }) => {
      const key = env.key()
      await collection.upsert(key, { hello: 'world' })
      const got = await collection.get(key)
      expect(got.content).toEqual({ hello: 'world' })
      await collection.remove(key)
    })

    test('mints keys unique to this run and worker', async ({ env }) => {
      const keys = new Set([env.key(), env.key(), env.key()])
      expect(keys.size).toBe(3)
    })

    test('pre-seeds the assertion context', async ({ env }) => {
      const c = env.ctx({ op: 'get' })
      expect(c.bucket).toBe(env.config.bucket)
      expect(c.serverVersion).toBe(
        formatVersion(classicOnly(capabilities).version)
      )
      expect(c.op).toBe('get')
    })

    test('owns any extra connection it hands out', async ({ env }) => {
      // Closed by the env's teardown even if the test throws here.
      const extra = await env.openCluster()
      const ping = await extra.ping()
      expect(Object.keys(ping.services).length).toBeGreaterThan(0)
    })
  }
)

defineSuite(
  'infra: detected server version',
  { features: [ServerFeature.KeyValue] },
  ({ test, capabilities }) => {
    test.skipIf(onMock(capabilities))(
      'comes from the cluster, not from a default',
      async ({ env }) => {
        // A version defaulting to 0.0.0 would gate every version-checked
        // feature off and stay green. Re-probing proves the snapshot came from
        // the server rather than from configuration.
        const probed = await probeCluster(env.cluster)
        expect(formatVersion(probed.version)).not.toBe('0.0.0')
        expect(probed.version.major).toBeGreaterThanOrEqual(6)

        if (process.env.CNCVER === undefined) {
          expect(classicOnly(capabilities).version).toEqual(probed.version)
        } else {
          expect(formatVersion(classicOnly(capabilities).version)).toBe(
            formatVersion(parseVersion(process.env.CNCVER) ?? probed.version)
          )
        }
      }
    )

    test.skipIf(onMock(capabilities))(
      'records the services the cluster reports',
      async ({ runState }) => {
        expect(classicOnly(runState.capabilities).services).toContain(
          'key_value'
        )
      }
    )

    test.skipIf(onMock(capabilities))(
      'reads the service list as the union across every node',
      async ({ env, runState }) => {
        // A service on any node is available to every client, so the service
        // gate reads the union. The mapping is the C++ core's; this asserts the
        // two agree. `index` (GSI) has no SDK service type, so it must be
        // dropped rather than guessed at.
        const CODES: Readonly<Record<string, string>> = {
          kv: 'key_value',
          n1ql: 'query',
          fts: 'search',
          cbas: 'analytics',
          eventing: 'eventing',
        }

        const reported = Object.values(env.consistency.nodeServices).flat()
        const expected = [
          ...new Set(reported.map((code) => CODES[code]).filter(Boolean)),
        ].sort()

        expect(
          [...(classicOnly(runState.capabilities).services ?? [])].sort()
        ).toEqual(expected)
        expect(classicOnly(runState.capabilities).services).not.toContain(
          'index'
        )
      }
    )
  }
)

defineSuite(
  'infra: collection strategy',
  { collection: CollectionStrategy.Both, features: [ServerFeature.KeyValue] },
  ({ test, strategy }) => {
    test('binds the strategy this block was emitted for', async ({
      collection,
      collectionLease,
      requirements,
    }) => {
      // Also checks that per-block fixture overrides do not bleed.
      expect(requirements.collection).toBe(strategy)
      if (strategy === CollectionStrategy.DefaultCollection) {
        expect(collection.name).toBe('_default')
      } else {
        expect(leaseStampMs(collectionLease.scopeName)).not.toBeNull()
        expect(collection.name).toBe(collectionLease.collectionName)
      }
    })
  }
)

defineSuite('infra: nightly tier', { tier: 'nightly' }, ({ test }) => {
  test('runs only when CNTIER admits it', ({ runState }) => {
    // Reaching this body means the tier gate let the suite through; asserting
    // that it was right to is the whole test.
    expect(TIER_RANK[runState.config.tier]).toBeGreaterThanOrEqual(
      TIER_RANK.nightly
    )
  })
})

describe('declarative skips', () => {
  it('holds the nightly suite back until its tier is asked for', () => {
    // Both directions. Under a lower tier the suite is skipped for the tier,
    // or for the missing cluster when there is none. Under CNTIER=nightly it
    // ran, so it is absent from the skip list.
    const nightly = skippedSuites().find(
      (s) => s.name === 'infra: nightly tier'
    )
    const state = inject('runState')

    if (state && TIER_RANK[state.config.tier] >= TIER_RANK.nightly) {
      expect(nightly).toBeUndefined()
      return
    }

    expect(nightly).toBeDefined()
    expect(['tier-excluded', 'no-cluster']).toContain(nightly?.kind)
    expect(nightly?.reason).not.toBe('')
  })
})
