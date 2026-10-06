import { describe, expect, it } from 'vitest'

import {
  ClusterCapabilities,
  ServerFeature,
  TestProtocol,
} from '../infra/capabilities'
import { TestConfig, loadTestConfig } from '../infra/config'
import {
  CollectionStrategy,
  ResolvedRequirements,
  resolveRequirements,
  strategiesFor,
} from '../infra/requirements'
import { RunState } from '../infra/runstate'
import { gateSuite } from '../infra/suite'

const CAPS: ClusterCapabilities = {
  protocol: TestProtocol.Classic,
  version: { major: 7, minor: 2, patch: 0 },
  backend: 'none',
  overrides: {},
  services: ['key_value'],
}

function ready(config: TestConfig = loadTestConfig({})): RunState {
  return {
    kind: 'ready',
    config,
    capabilities: CAPS,
    connection: { connectionString: 'couchbase://localhost' },
    runId: 'testrun1',
    runLog: '',
    description: '7.2.0 real server',
  }
}

function reqs(over: Partial<ResolvedRequirements> = {}): ResolvedRequirements {
  return {
    ...resolveRequirements('a suite', {}, CollectionStrategy.DefaultCollection),
    ...over,
  }
}

describe('requirement resolution', () => {
  it('fills in the defaults', () => {
    const resolved = reqs()
    expect(resolved.features).toEqual([])
    expect(resolved.collection).toBe(CollectionStrategy.DefaultCollection)
    expect(resolved.tier).toBe('fast')
  })

  it('splits Both into the two strategies it runs under', () => {
    expect(strategiesFor(CollectionStrategy.Both)).toEqual([
      CollectionStrategy.DefaultCollection,
      CollectionStrategy.Named,
    ])
    expect(strategiesFor(CollectionStrategy.Named)).toEqual([
      CollectionStrategy.Named,
    ])
  })
})

describe('suite gating', () => {
  it('runs a suite whose features the cluster has', () => {
    expect(
      gateSuite(reqs({ features: [ServerFeature.KeyValue] }), ready())
    ).toEqual({ kind: 'ok' })
  })

  it('skips a suite needing a newer server, naming both versions', () => {
    const gate = gateSuite(
      reqs({ features: [ServerFeature.RangeScan] }),
      ready()
    )
    expect(gate.kind).toBe('feature-missing')
    expect(gate.kind !== 'ok' && gate.reason).toContain('>= 7.5.0')
    expect(gate.kind !== 'ok' && gate.reason).toContain('detected 7.2.0')
  })

  it('skips a suite whose service the cluster does not run', () => {
    // CAPS is a kv-only cluster, a legitimate deployment, not a server too
    // old for search.
    const gate = gateSuite(reqs({ features: [ServerFeature.Search] }), ready())
    expect(gate.kind).toBe('service-absent')
    expect(gate.kind !== 'ok' && gate.reason).toContain(
      'runs on the search service'
    )
    expect(gate.kind !== 'ok' && gate.reason).toContain('Deployed: key_value')
  })

  it('lets the tier decide before the service does', () => {
    const gate = gateSuite(
      reqs({ tier: 'nightly', features: [ServerFeature.Search] }),
      ready()
    )
    expect(gate.kind).toBe('tier-excluded')
  })

  it('skips a suite above the configured tier', () => {
    const gate = gateSuite(reqs({ tier: 'nightly' }), ready())
    expect(gate.kind).toBe('tier-excluded')
  })

  it('lets the tier decide before the features do', () => {
    // A nightly suite that also needs a missing feature reports the tier,
    // not the cluster.
    const gate = gateSuite(
      reqs({ tier: 'nightly', features: [ServerFeature.RangeScan] }),
      ready()
    )
    expect(gate.kind).toBe('tier-excluded')
  })

  it('skips when no cluster is configured, and says so before anything else', () => {
    const gate = gateSuite(reqs({ tier: 'nightly' }), {
      kind: 'no-cluster',
      config: loadTestConfig({ CNMOCK: 'none' }),
      runId: 'testrun1',
      runLog: '',
      reason: 'No cluster is configured.',
    })
    expect(gate.kind).toBe('no-cluster')
  })

  it('fails, rather than skips, when there is no run state at all', () => {
    // A project with no globalSetup: a suite needing a cluster must fail,
    // not silently skip.
    const gate = gateSuite(
      reqs({ features: [ServerFeature.KeyValue] }),
      undefined
    )
    expect(gate.kind).toBe('env-degraded')
    expect(gate.kind !== 'ok' && gate.reason).toContain('globalSetup')
  })
})
