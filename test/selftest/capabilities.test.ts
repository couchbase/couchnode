import { describe, expect, it } from 'vitest'

import {
  ALL_FEATURES,
  BACKEND_UNSUPPORTED,
  ClassicCapabilities,
  TestProtocol,
  FEATURE_MIN_VERSION,
  FEATURE_SERVICES,
  ServerFeature,
  explain,
  gateFeatures,
  gateSkips,
  parseVersion,
  supports,
} from '../infra/capabilities'

function caps(over: Partial<ClassicCapabilities> = {}): ClassicCapabilities {
  return {
    protocol: TestProtocol.Classic,
    version: { major: 7, minor: 6, patch: 0 },
    backend: 'none',
    overrides: {},
    services: [],
    ...over,
  }
}

describe('version parsing', () => {
  it('accepts the build-suffixed form the server reports', () => {
    expect(parseVersion('7.6.10-8025-enterprise')).toEqual({
      major: 7,
      minor: 6,
      patch: 10,
    })
  })

  it('accepts a plain version', () => {
    expect(parseVersion('6.5.1')).toEqual({ major: 6, minor: 5, patch: 1 })
  })

  it('rejects 0.0.0, so no version can mean "assume everything works"', () => {
    // No version value means "unknown"; a 0.0.0 read as "assume latest"
    // would pass every isAtLeast check.
    expect(parseVersion('0.0.0')).toBeUndefined()
  })

  it('rejects junk', () => {
    expect(parseVersion('')).toBeUndefined()
    expect(parseVersion('7.6')).toBeUndefined()
    expect(parseVersion('not-a-version')).toBeUndefined()
  })
})

describe('feature gating', () => {
  it('covers every feature with a minimum version', () => {
    // A Record, so a feature with no minimum is a compile error there and a
    // visible gap here rather than a runtime throw.
    for (const feature of ALL_FEATURES) {
      expect(FEATURE_MIN_VERSION[feature], feature).toBeDefined()
    }
  })

  it('allows a feature the version satisfies', () => {
    expect(supports(caps(), ServerFeature.Collections)).toBe(true)
  })

  it('refuses a feature the version predates', () => {
    const c = caps({ version: { major: 7, minor: 2, patch: 0 } })
    expect(supports(c, ServerFeature.RangeScan)).toBe(false)
    expect(explain(c, ServerFeature.RangeScan)).toBe(
      "Feature 'range_scan' requires Couchbase Server >= 7.5.0; " +
        'detected 7.2.0 (real server).'
    )
  })

  it('refuses a feature the backend does not implement, whatever the version', () => {
    const c = caps({ backend: 'gocaves' })
    expect(supports(c, ServerFeature.Query)).toBe(false)
    expect(explain(c, ServerFeature.Query)).toBe(
      "Feature 'query' is not implemented by the gocaves backend."
    )
  })

  it('keeps the eight features the mock was observed to implement', () => {
    const c = caps({ backend: 'gocaves' })
    for (const feature of [
      ServerFeature.KeyValue,
      ServerFeature.Subdoc,
      ServerFeature.Xattr,
      ServerFeature.Collections,
      ServerFeature.BucketManagement,
      ServerFeature.Replicas,
      ServerFeature.Transactions,
      ServerFeature.ServerDurability,
    ]) {
      expect(supports(c, feature), feature).toBe(true)
    }
  })

  it('treats a feature added to the enum as unsupported on the mock by default', () => {
    // The supported list is the short one, so a new feature defaults to
    // unsupported. The count is spelled out so widening it is a deliberate edit.
    const unsupported = BACKEND_UNSUPPORTED.gocaves
    expect(unsupported.length).toBe(ALL_FEATURES.length - 8)
  })

  it('admits a feature on the exact patch version it requires', () => {
    // Three features sit on 7.6.2, so the patch level must be compared.
    for (const feature of [
      ServerFeature.BinaryTransactions,
      ServerFeature.ServerGroups,
      ServerFeature.NumVbucketsSetting,
    ]) {
      const below = caps({ version: { major: 7, minor: 6, patch: 1 } })
      const exact = caps({ version: { major: 7, minor: 6, patch: 2 } })
      expect(supports(below, feature), `${feature} at 7.6.1`).toBe(false)
      expect(supports(exact, feature), `${feature} at 7.6.2`).toBe(true)
    }
  })

  it('expects cluster labels from 7.6.4, not from 7.6.0', () => {
    // The name is in `/pools/default` long before it is in the bucket
    // configuration the SDK reads, so a gate on 7.6.0 would assert labels a
    // 7.6.2 cluster has a name for and the SDK never records.
    const below = caps({ version: { major: 7, minor: 6, patch: 3 } })
    const exact = caps({ version: { major: 7, minor: 6, patch: 4 } })
    expect(supports(below, ServerFeature.ClusterLabels)).toBe(false)
    expect(supports(exact, ServerFeature.ClusterLabels)).toBe(true)
  })

  it('lets CNFEAT win over both the version and the backend', () => {
    const on = caps({
      backend: 'gocaves',
      overrides: { [ServerFeature.Query]: true },
    })
    expect(supports(on, ServerFeature.Query)).toBe(true)
    expect(explain(on, ServerFeature.Query)).toContain('forced on by CNFEAT')

    const off = caps({ overrides: { [ServerFeature.KeyValue]: false } })
    expect(supports(off, ServerFeature.KeyValue)).toBe(false)
    expect(explain(off, ServerFeature.KeyValue)).toContain(
      'forced off by CNFEAT'
    )
  })
})

describe('gates', () => {
  it('passes a suite whose features are all present', () => {
    expect(
      gateFeatures(caps(), [ServerFeature.KeyValue, ServerFeature.Collections])
    ).toEqual({ kind: 'ok' })
  })

  it('names the first missing feature', () => {
    const gate = gateFeatures(
      caps({ version: { major: 6, minor: 6, patch: 0 } }),
      [ServerFeature.KeyValue, ServerFeature.Collections]
    )
    expect(gate.kind).toBe('feature-missing')
    expect(gate.kind === 'feature-missing' && gate.reason).toContain(
      "Feature 'collections' requires"
    )
  })

  it('skips for every outcome except a degraded environment', () => {
    // A broken environment must not read as legitimate skips.
    expect(gateSkips({ kind: 'ok' })).toBe(false)
    expect(gateSkips({ kind: 'feature-missing', reason: '' })).toBe(true)
    expect(gateSkips({ kind: 'no-cluster', reason: '' })).toBe(true)
    expect(gateSkips({ kind: 'tier-excluded', reason: '' })).toBe(true)
    expect(gateSkips({ kind: 'env-degraded', reason: '' })).toBe(false)
  })
})

describe('service gating', () => {
  const DEPLOYED = ['key_value', 'query']

  it('covers every feature with a deployment answer', () => {
    // Total over the enum, so a new feature needs an entry; `null` is a stated
    // claim, because absence here is the permissive direction.
    for (const feature of ALL_FEATURES) {
      expect(FEATURE_SERVICES[feature], feature).not.toBeUndefined()
    }
  })

  it('allows a feature whose service the cluster runs', () => {
    expect(supports(caps({ services: DEPLOYED }), ServerFeature.Query)).toBe(
      true
    )
  })

  it('refuses a feature whose service no node runs, and says what is deployed', () => {
    const c = caps({ services: DEPLOYED })
    expect(supports(c, ServerFeature.Search)).toBe(false)
    expect(explain(c, ServerFeature.Search)).toBe(
      "Feature 'search' runs on the search service, which no node of this " +
        'cluster is running. Deployed: key_value, query.'
    )
  })

  it('reports an absent service as its own gate, not as a missing feature', () => {
    // A kv-only cluster is a legitimate deployment, not too old a version.
    const gate = gateFeatures(caps({ services: DEPLOYED }), [
      ServerFeature.KeyValue,
      ServerFeature.Search,
    ])
    expect(gate.kind).toBe('service-absent')
    expect(gate.kind === 'service-absent' && gate.reason).toContain(
      'runs on the search service'
    )
  })

  it('skips on an absent service rather than failing the run', () => {
    expect(gateSkips({ kind: 'service-absent', reason: '' })).toBe(true)
  })

  it('answers with the version when the cluster fails both checks', () => {
    // The version is checked first, as the more actionable answer.
    const c = caps({
      version: { major: 6, minor: 0, patch: 0 },
      services: ['key_value'],
    })
    const gate = gateFeatures(c, [ServerFeature.ScopeSearch])
    expect(gate.kind).toBe('feature-missing')
    expect(gate.kind === 'feature-missing' && gate.reason).toContain(
      'requires Couchbase Server >= 7.6.0'
    )
  })

  it('lets the backend answer before the deployment does', () => {
    // A mock is never probed, but a caller that hands one a service list must
    // still get the backend's answer, because it is the more specific fact.
    const c = caps({ backend: 'gocaves', services: ['key_value'] })
    expect(explain(c, ServerFeature.Search)).toContain(
      'not implemented by the gocaves backend'
    )
  })

  it('lets CNFEAT force a feature on against the deployment', () => {
    const c = caps({
      services: ['key_value'],
      overrides: { [ServerFeature.Search]: true },
    })
    expect(supports(c, ServerFeature.Search)).toBe(true)
    expect(gateFeatures(c, [ServerFeature.Search])).toEqual({ kind: 'ok' })
  })

  it('waves everything through when the services were never asked for', () => {
    // undefined is unasked, as on a mock, and must not read as an empty
    // deployment.
    const c = caps({ services: undefined })
    expect(supports(c, ServerFeature.Search)).toBe(true)
    expect(supports(c, ServerFeature.Analytics)).toBe(true)
  })

  it('never gates the features that ride on nodes a cluster cannot lack', () => {
    // Views are served by the data nodes and `view` never appears in the
    // cluster's own service list, so a gate on them would deny them always.
    // Key-value is the same argument, and a key-value transaction needs no
    // query node.
    for (const feature of [
      ServerFeature.KeyValue,
      ServerFeature.Views,
      ServerFeature.SpatialViews,
      ServerFeature.Transactions,
      ServerFeature.Collections,
      ServerFeature.BucketManagement,
    ]) {
      expect(FEATURE_SERVICES[feature], feature).toBeNull()
      expect(supports(caps({ services: [] }), feature), feature).toBe(true)
    }
  })

  it('maps each service-gated feature to a service the probe can report', () => {
    // The five the C++ core's cluster_describe inserts. A sixth would be a gate
    // that can never pass.
    const reportable = ['key_value', 'query', 'analytics', 'search', 'eventing']
    for (const feature of ALL_FEATURES) {
      const service = FEATURE_SERVICES[feature]
      if (service !== null) {
        expect(reportable, feature).toContain(service)
      }
    }
  })
})
