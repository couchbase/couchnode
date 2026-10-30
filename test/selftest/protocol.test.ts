// The protocol model. No ordinary run reaches a gateway, so the couchbase2
// half is only proven here; the classic half is pinned so it stays unchanged.

import { describe, expect, it } from 'vitest'

import {
  ClassicCapabilities,
  ClusterCapabilities,
  Couchbase2Capabilities,
  PROTOCOL_GAPS,
  ServerFeature,
  TestProtocol,
  classifyFeature,
  describeGaps,
  explain,
  gateFeatures,
  gateSkips,
  isClassic,
  protocolFromConnectionString,
  supports,
} from '../infra/capabilities'
import { TestConfigError, loadTestConfig } from '../infra/config'
import type { Cluster } from '../../lib/cluster'
import { BucketNotFoundError, TimeoutError } from '../../lib/errors'
import { ClassicProtocolAdapter, adapterFor } from '../infra/protocol/adapter'
import { Couchbase2ProtocolAdapter } from '../infra/protocol/couchbase2'
import { ConsistencyUtils } from '../infra/consistency'
import { PollTimeoutError } from '../infra/retry'

const classic: ClassicCapabilities = {
  protocol: TestProtocol.Classic,
  version: { major: 7, minor: 6, patch: 0 },
  backend: 'none',
  overrides: {},
  services: [],
}

const gateway: Couchbase2Capabilities = {
  protocol: TestProtocol.Couchbase2,
  overrides: {},
}

describe('protocol resolution', () => {
  it('reads the protocol off the connection string scheme', () => {
    expect(protocolFromConnectionString('couchbase2://localhost')).toBe(
      TestProtocol.Couchbase2
    )
    expect(protocolFromConnectionString('couchbase://localhost')).toBe(
      TestProtocol.Classic
    )
    expect(protocolFromConnectionString('couchbases://localhost')).toBe(
      TestProtocol.Classic
    )
  })

  it('does not mistake couchbases:// for couchbase2://', () => {
    // The two schemes share a prefix; an unanchored match would route every
    // TLS run through the gateway path.
    expect(protocolFromConnectionString('couchbases://host:11207')).toBe(
      TestProtocol.Classic
    )
  })

  it('treats an unknown scheme as classic rather than throwing', () => {
    // The SDK is the authority on what schemes it accepts.
    expect(protocolFromConnectionString('http://localhost:8091')).toBe(
      TestProtocol.Classic
    )
  })

  it('defaults to classic with no connection string at all', () => {
    expect(loadTestConfig({}).protocol).toBe(TestProtocol.Classic)
  })

  it('resolves from CNCSTR without being told', () => {
    const config = loadTestConfig({
      CNCSTR: 'couchbase2://gateway',
      CNMOCK: 'none',
    })
    expect(config.protocol).toBe(TestProtocol.Couchbase2)
  })

  it('has no override variable, so the scheme cannot be contradicted', () => {
    // No override, unlike `CNCVER`: the protocol is parsed from what the caller
    // typed, and claiming classic against a gateway would drive management
    // HTTP at a host with none, which `adapterFor` throws to prevent.
    const config = loadTestConfig({
      CNCSTR: 'couchbase2://gateway',
      CNMOCK: 'none',
      CNPROTO: 'classic',
    })
    expect(config.protocol).toBe(TestProtocol.Couchbase2)
  })

  it('rejects couchbase2 against a mock backend', () => {
    // There is no mock gateway, and a mock's backend list answering for
    // couchbase2 would produce a run of meaningless skips.
    expect(() =>
      loadTestConfig({ CNCSTR: 'couchbase2://gateway', CNMOCK: 'gocaves' })
    ).toThrow(TestConfigError)
    // Including against the default backend, which is the case someone hits by
    // pointing CNCSTR at a gateway and changing nothing else.
    expect(() => loadTestConfig({ CNCSTR: 'couchbase2://gateway' })).toThrow(
      /CNMOCK=none/
    )
  })
})

describe('the capability model under couchbase2', () => {
  it('narrows, so classic-only fields are unreachable without a guard', () => {
    // A function over the union, as real callers are: outside the guard
    // `caps.version` is a compile error.
    const versionOf = (caps: ClusterCapabilities): string =>
      isClassic(caps) ? `${caps.version.major}` : 'not knowable'

    expect(versionOf(gateway)).toBe('not knowable')
    expect(versionOf(classic)).toBe('7')
    expect(isClassic(gateway)).toBe(false)
    expect(isClassic(classic)).toBe(true)
  })

  it('reports a gapped feature as protocol-gap, not feature-missing', () => {
    const verdict = classifyFeature(gateway, ServerFeature.Views)
    expect(verdict.kind).toBe('protocol-gap')
    const gate = gateFeatures(gateway, [ServerFeature.Views])
    expect(gate.kind).toBe('protocol-gap')
    expect(gateSkips(gate)).toBe(true)
  })

  it('assumes an un-gapped feature is present, so the gateway fails loudly', () => {
    // Version-gating from CNCVER instead would skip silently and pass.
    expect(supports(gateway, ServerFeature.Query)).toBe(true)
    expect(classifyFeature(gateway, ServerFeature.Query).kind).toBe('ok')
  })

  it('is terminal: no version or backend axis is consulted', () => {
    // ScopeSearch carries a 7.6 minimum on the classic path. Under couchbase2
    // there is no version to compare it against, and the absence must read as
    // "not gated" rather than as "version 0".
    expect(supports(gateway, ServerFeature.ScopeSearch)).toBe(true)
  })

  it('still lets CNFEAT win, which is the gap map’s maintenance workflow', () => {
    // `CNFEAT=+user_management` against a live gateway runs the suite for real
    // and answers "has CNG caught up yet?" without editing PROTOCOL_GAPS first.
    const forced: Couchbase2Capabilities = {
      protocol: TestProtocol.Couchbase2,
      overrides: { [ServerFeature.UserManagement]: true },
    }
    expect(supports(forced, ServerFeature.UserManagement)).toBe(true)
    expect(supports(gateway, ServerFeature.UserManagement)).toBe(false)
  })

  it('names the feature and the way back in its skip reason', () => {
    const reason = explain(gateway, ServerFeature.UserManagement)
    expect(reason).toContain('user_management')
    expect(reason).toContain('CNFEAT=+user_management')
  })

  it('says a gap is unplanned, not impossible', () => {
    // A gap records the present plan, not a verdict on the future, and
    // the CNFEAT hint is how to check whether the plan has changed.
    const reason = explain(gateway, ServerFeature.Views)
    expect(reason).toContain('Nothing is currently being built')
    expect(reason).not.toContain('permanent')
    expect(reason).toContain('CNFEAT=+views')
  })
})

describe('the gap map', () => {
  it('is empty for classic, which has no protocol-level gaps by definition', () => {
    expect(Object.keys(PROTOCOL_GAPS[TestProtocol.Classic])).toHaveLength(0)
  })

  it('summarizes as a count CI can track', () => {
    expect(describeGaps(TestProtocol.Couchbase2)).toMatch(/^\d+ features$/)
    expect(describeGaps(TestProtocol.Classic)).toBe('0 features')
  })

  it('every entry carries a note, so no skip is unexplained', () => {
    for (const gap of Object.values(PROTOCOL_GAPS[TestProtocol.Couchbase2])) {
      expect(gap.note.length).toBeGreaterThan(0)
    }
  })
})

describe('the classic path is unchanged', () => {
  it('resolves features exactly as before the protocol axis existed', () => {
    expect(supports(classic, ServerFeature.KeyValue)).toBe(true)
    expect(classifyFeature(classic, ServerFeature.KeyValue).kind).toBe('ok')
  })

  it('never reports protocol-gap, because classic has no gap entries', () => {
    for (const feature of Object.values(ServerFeature)) {
      expect(classifyFeature(classic, feature).kind).not.toBe('protocol-gap')
    }
  })

  it('still reports a version shortfall as a version shortfall', () => {
    const old: ClassicCapabilities = {
      ...classic,
      version: { major: 6, minor: 6, patch: 0 },
    }
    expect(classifyFeature(old, ServerFeature.RangeScan).kind).toBe(
      'version-too-low'
    )
  })
})

describe('the adapter registry', () => {
  const consistency = {} as ConsistencyUtils
  const cluster = {} as Cluster

  it('hands back the classic adapter for the classic protocol', () => {
    const adapter = adapterFor(TestProtocol.Classic, consistency, cluster)
    expect(adapter).toBeInstanceOf(ClassicProtocolAdapter)
    expect(adapter.protocol).toBe(TestProtocol.Classic)
  })

  it('hands back the gateway adapter for couchbase2, never classic', () => {
    // A fallback would run per-node management HTTP against a gateway with no
    // management port, and report the timeouts as ordinary flake.
    const adapter = adapterFor(TestProtocol.Couchbase2, consistency, cluster)
    expect(adapter).toBeInstanceOf(Couchbase2ProtocolAdapter)
    expect(adapter.protocol).toBe(TestProtocol.Couchbase2)
  })

  it('forwards every readiness member to the consistency helpers', () => {
    // The adapter only delegates; an unwired member fails here.
    const calls: string[] = []
    const stub = new Proxy(
      {},
      {
        get: (_t, name: string) => async () => {
          calls.push(name)
        },
      }
    ) as ConsistencyUtils
    const adapter = new ClassicProtocolAdapter(stub)

    return Promise.all([
      adapter.waitUntilBucketPresent('b'),
      adapter.waitUntilBucketDropped('b'),
      adapter.waitUntilScopePresent('b', 's'),
      adapter.waitUntilScopeDropped('b', 's'),
      adapter.waitUntilCollectionPresent('b', 's', 'c'),
      adapter.waitUntilCollectionDropped('b', 's', 'c'),
      adapter.waitUntilDesignDocumentPresent('b', 'd'),
      adapter.waitUntilDesignDocumentDropped('b', 'd'),
    ]).then(() => {
      expect(calls).toEqual([
        'waitUntilBucketPresent',
        'waitUntilBucketDropped',
        'waitUntilScopePresent',
        'waitUntilScopeDropped',
        'waitUntilCollectionPresent',
        'waitUntilCollectionDropped',
        'waitUntilDesignDocumentPresent',
        'waitUntilDesignDocumentDropped',
      ])
    })
  })
})

describe('the couchbase2 adapter', () => {
  const FAST = { deadlineMs: 300 }

  /**
   * A cluster whose managers answer from `answers`, one per call, the last
   * repeating. An `Error` is thrown; anything else is returned.
   */
  function gateway(answers: { bucket?: unknown[]; scopes?: unknown[] }) {
    const next = async (list: unknown[] | undefined) => {
      const answer = list && list.length > 1 ? list.shift() : list?.[0]
      if (answer instanceof Error) {
        throw answer
      }
      return answer
    }
    return {
      buckets: () => ({ getBucket: () => next(answers.bucket) }),
      bucket: () => ({
        collections: () => ({ getAllScopes: () => next(answers.scopes) }),
      }),
    } as unknown as Cluster
  }

  const scopes = (...names: [string, string[]][]) =>
    names.map(([name, collections]) => ({
      name,
      collections: collections.map((c) => ({ name: c })),
    }))

  it('waits for a bucket through its manager, reading other errors as not yet', async () => {
    const adapter = new Couchbase2ProtocolAdapter(
      gateway({
        bucket: [new BucketNotFoundError(), new TimeoutError(), { name: 'b' }],
      })
    )
    await adapter.waitUntilBucketPresent('b', FAST)
  })

  it('reads a bucket not found as dropped', async () => {
    const adapter = new Couchbase2ProtocolAdapter(
      gateway({ bucket: [{ name: 'b' }, new BucketNotFoundError()] })
    )
    await adapter.waitUntilBucketDropped('b', FAST)
  })

  it('waits for a scope and a collection in the scope listing', async () => {
    const adapter = new Couchbase2ProtocolAdapter(
      gateway({
        scopes: [
          scopes(['_default', ['_default']]),
          scopes(['_default', ['_default']], ['s', []]),
          scopes(['_default', ['_default']], ['s', ['c']]),
        ],
      })
    )
    await adapter.waitUntilScopePresent('b', 's', FAST)
    await adapter.waitUntilCollectionPresent('b', 's', 'c', FAST)
  })

  it('names what it waited for and what it last saw when it times out', async () => {
    const adapter = new Couchbase2ProtocolAdapter(
      gateway({ scopes: [scopes(['s', ['c']])] })
    )
    const err = await adapter
      .waitUntilCollectionDropped('b', 's', 'c', FAST)
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PollTimeoutError)
    expect((err as Error).message).toMatch(
      /collection s\.c on b to be dropped through the gateway.*still listed/
    )
  })

  it('refuses the design document waits, which no couchbase2 suite reaches', async () => {
    const adapter = new Couchbase2ProtocolAdapter(gateway({}))
    await expect(adapter.waitUntilDesignDocumentPresent()).rejects.toThrow(
      /no couchbase2 equivalent/
    )
    await expect(adapter.waitUntilDesignDocumentDropped()).rejects.toThrow(
      /no couchbase2 equivalent/
    )
  })
})
