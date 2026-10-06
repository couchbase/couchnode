// `defineSuite`: a suite declares what it needs, and is gated at collection
// time from the run's capability snapshot.
//
// A missing feature skips, a service the cluster does not run skips with its
// own reason, a broken environment fails, and no cluster at all skips. Gates
// are declared per file (`features`), per block (`group()`) or per test
// (`lacking()` with `test.skipIf`). Titles never carry the reason, so a test
// keeps one name across targets; the reason goes to the run log and to the
// report (see `infra/skips.ts`).
//
// Cluster-free suites use `describe`/`it` directly and take no cluster fixture.

import { describe, inject, it } from 'vitest'

import {
  ClusterCapabilities,
  Gate,
  ServerFeature,
  TestProtocol,
  describeTarget,
  gateFeatures,
  supports,
} from './capabilities'
import { TIER_RANK, TestConfig, Tier } from './config'
import { test } from './fixtures'
import {
  CollectionStrategy,
  ResolvedRequirements,
  SuiteRequirements,
  resolveRequirements,
  strategiesFor,
} from './requirements'
import { KnownIssueId, gateKnownIssues } from './knownissues'
import { LimitationId, gateLimitations } from './limitations'
import { RunState } from './runstate'
import {
  NoticeChannel,
  recordKnownIssue,
  recordLimitation,
  recordNotice,
} from './runlog'
import { SkipGate, skipOptions, withSkipReasons } from './skips'

/**
 * Which channel a skipping gate is reported on. A table, so a `Gate` kind added
 * without a channel is a build error rather than a notice in the wrong channel.
 */
const CHANNEL_FOR_GATE: Readonly<
  Record<Exclude<Gate['kind'], 'ok' | 'env-degraded'>, NoticeChannel>
> = Object.freeze({
  'feature-missing': 'skip',
  'service-absent': 'skip',
  'no-cluster': 'skip',
  'tier-excluded': 'skip',
  'protocol-gap': 'skip',
  'feature-present': 'skip',
  'mock-limitation': 'limitation',
  'known-issue': 'known-issue',
})

function record(path: string | undefined, gate: SkipGate, suite: string): void {
  recordNotice(path, {
    channel: CHANNEL_FOR_GATE[gate.kind],
    suite,
    kind: gate.kind,
    reason: gate.reason,
  })
}

export interface SuiteContext {
  /** The fixture-aware `test`, with this suite's requirements bound. */
  readonly test: typeof test
  readonly capabilities: ClusterCapabilities
  readonly requirements: ResolvedRequirements
  readonly strategy: Exclude<CollectionStrategy, CollectionStrategy.Both>
  /** A nested `describe` with a gate of its own, evaluated at collection. */
  readonly group: (
    name: string,
    gate: readonly ServerFeature[] | GroupGate,
    body: () => void
  ) => void
  /**
   * Whether the cluster is missing any of these features, for a per-test gate:
   * `test.skipIf(lacking(ServerFeature.Xattr))`.
   *
   * Every predicate here answers with the gate that fired, or `false`. The gate
   * is truthy, and handed to `test.skipIf` it becomes the test's skip reason.
   * A predicate, not an early `return` in the body, which would report a pass.
   */
  readonly lacking: (...features: ServerFeature[]) => SkipGate | false
  /**
   * The inverse of `lacking`, for the rare test of what a server *without* a
   * feature does: whether the cluster has every one of these features, as the
   * gate that skips the test when it does.
   */
  readonly having: (...features: ServerFeature[]) => SkipGate | false
  /**
   * Whether this run's tier excludes work of the given tier, for the few tests
   * slower than the rest of their file.
   */
  readonly belowTier: (tier: Tier) => SkipGate | false
  /**
   * Whether this run's protocol is none of the given ones, for the otherwise
   * common suite with one or two protocol-bound tests:
   * `test.skipIf(notOn(TestProtocol.Classic))`.
   *
   * A feature absent under a protocol wants `lacking()`, which consults
   * `PROTOCOL_GAPS`. A test whose behavior is the same but whose error type or
   * context shape differs is not a skip at all: the assert helpers handle it.
   */
  readonly notOn: (...protocols: TestProtocol[]) => SkipGate | false
  /**
   * Whether a declared mock-backend defect applies to this run, for
   * `test.skipIf(limited('gocaves-subdoc-mutation-macros'))` and the
   * `describe.skipIf` form around a block.
   *
   * Calling it records the notice, so call it where the skip is declared, not
   * once at the top of the file to reuse the boolean. The run summary counts
   * declaration sites, not tests.
   */
  readonly limited: (...ids: LimitationId[]) => SkipGate | false
  /**
   * Whether a declared, ticketed defect in the code under test applies here,
   * for `test.skipIf(known('mutatein-expiry-lost'))` and the `describe.skipIf`
   * form around a block.
   *
   * Calling it records the notice, as for `limited`. **The one predicate here
   * that silences the real cluster too**, so reach for it last: when the
   * failure is understood, accepted and filed, not as a way to get to green.
   */
  readonly known: (...ids: KnownIssueId[]) => SkipGate | false
}

/**
 * A `group()` gate that needs to say more than a feature list. An object rather
 * than another parameter, so the body stays the call's last argument.
 */
export interface GroupGate {
  readonly features?: readonly ServerFeature[]
  /** Mock backend defects that make this whole block unrunnable. */
  readonly limitations?: readonly LimitationId[]
  /** Open, ticketed defects that make this whole block unrunnable anywhere. */
  readonly knownIssues?: readonly KnownIssueId[]
}

export interface SkippedSuite {
  readonly name: string
  readonly kind: Gate['kind']
  readonly reason: string
}

const skipped: SkippedSuite[] = []

/** Suites this file skipped, and why. Read by the infrastructure's own tests. */
export function skippedSuites(): readonly SkippedSuite[] {
  return skipped
}

export function defineSuite(
  name: string,
  reqs: SuiteRequirements,
  body: (ctx: SuiteContext) => void
): void {
  const state = inject('runState')

  for (const strategy of strategiesFor(
    reqs.collection ?? CollectionStrategy.DefaultCollection
  )) {
    const requirements = resolveRequirements(name, reqs, strategy)
    // `Both` emits one describe per strategy, so one body covers the default
    // collection and a named one.
    const suiteName =
      reqs.collection === CollectionStrategy.Both
        ? `${name} (${strategy})`
        : name

    emit(suiteName, requirements, state, body)
  }
}

function emit(
  suiteName: string,
  requirements: ResolvedRequirements,
  state: RunState | undefined,
  body: (ctx: SuiteContext) => void
): void {
  const gate = gateSuite(requirements, state)

  if (gate.kind === 'env-degraded') {
    // A failing test, not a skip. The extra title only appears when the run
    // is failing anyway.
    describe(suiteName, () => {
      it('environment', () => {
        throw new Error(gate.reason)
      })
    })
    return
  }

  if (gate.kind !== 'ok') {
    skipped.push({ name: suiteName, kind: gate.kind, reason: gate.reason })
    // To the run log, not the console: a worker's output is hidden when its
    // file passes. globalSetup's teardown prints the summary.
    record(state?.runLog, gate, suiteName)
    describe.skip(suiteName, skipOptions(gate), () => {
      body(
        contextFor(
          requirements,
          readyState(state).capabilities,
          state,
          suiteName
        )
      )
    })
    return
  }

  describe(suiteName, () => {
    test.override('requirements', requirements)
    body(
      contextFor(requirements, readyState(state).capabilities, state, suiteName)
    )
  })
}

function contextFor(
  requirements: ResolvedRequirements,
  capabilities: ClusterCapabilities,
  state: RunState | undefined,
  suiteName: string
): SuiteContext {
  const lacking = (...features: ServerFeature[]): SkipGate | false =>
    skipping(gateFeatures(capabilities, features))

  const having = (...features: ServerFeature[]): SkipGate | false => {
    if (gateFeatures(capabilities, features).kind !== 'ok') {
      return false
    }
    return {
      kind: 'feature-present',
      reason:
        `Test covers a server without [${features.join(', ')}], and the ` +
        `${describeTarget(capabilities)} has all of them.`,
      fields: { feature: features.join(',') },
    }
  }

  const notOn = (...protocols: TestProtocol[]): SkipGate | false => {
    if (protocols.includes(capabilities.protocol)) {
      return false
    }
    return {
      kind: 'protocol-gap',
      reason:
        `Test runs only over [${protocols.join(', ')}] and this run speaks ` +
        `'${capabilities.protocol}'.`,
      fields: {
        protocol: capabilities.protocol,
        declared: protocols.join(','),
      },
    }
  }

  const limited = (...ids: LimitationId[]): SkipGate | false => {
    const gate = skipping(gateLimitations(capabilities, ids))
    if (gate) {
      recordLimitation(state?.runLog, {
        suite: suiteName,
        kind: gate.kind,
        reason: gate.reason,
      })
    }
    return gate
  }

  const known = (...ids: KnownIssueId[]): SkipGate | false => {
    const gate = skipping(gateKnownIssues(ids))
    if (gate) {
      recordKnownIssue(state?.runLog, {
        suite: suiteName,
        kind: gate.kind,
        reason: gate.reason,
      })
    }
    return gate
  }

  // With no run state the suite is skipped anyway, but its tests are still
  // collected, so the fallback is the widest tier, which excludes nothing.
  const runTier: Tier = state?.kind === 'ready' ? state.config.tier : 'nightly'
  const belowTier = (tier: Tier): SkipGate | false => {
    if (TIER_RANK[tier] <= TIER_RANK[runTier]) {
      return false
    }
    return {
      kind: 'tier-excluded',
      reason:
        `Test is tier '${tier}' and CNTIER is '${runTier}'. ` +
        `Run it with CNTIER=${tier}.`,
      fields: { tier, run: runTier },
    }
  }

  return {
    test: withSkipReasons(test),
    capabilities,
    requirements,
    strategy: requirements.collection,
    lacking,
    having,
    belowTier,
    notOn,
    limited,
    known,
    group: (name, gate_, body) => {
      const {
        features = [],
        limitations = [],
        knownIssues = [],
      } = Array.isArray(gate_)
        ? { features: gate_ as readonly ServerFeature[] }
        : (gate_ as GroupGate)
      // Same order as `gateSuite`, for the reasons given there.
      const gate = firstGate(
        () => gateFeatures(capabilities, features),
        () => gateKnownIssues(knownIssues),
        () => gateLimitations(capabilities, limitations)
      )
      if (gate.kind === 'ok') {
        describe(name, body)
        return
      }
      if (gate.kind === 'env-degraded') {
        // Handled as `emit` does rather than asserted away, so a gate added to
        // the chain above cannot turn a broken environment into a quiet skip.
        describe(name, () => {
          it('environment', () => {
            throw new Error(gate.reason)
          })
        })
        return
      }
      const qualified = `${suiteName} > ${name}`
      skipped.push({ name: qualified, kind: gate.kind, reason: gate.reason })
      record(state?.runLog, gate, qualified)
      // Body collected so the block's tests report as skipped rather than
      // vanishing.
      describe.skip(name, skipOptions(gate), body)
    },
  }
}

/**
 * A gate as a predicate's answer: `false` when it lets the test run, the gate
 * itself when it skips. `env-degraded` throws at collection, failing the file,
 * so it can never become a skip.
 */
function skipping(gate: Gate): SkipGate | false {
  if (gate.kind === 'ok') {
    return false
  }
  if (gate.kind === 'env-degraded') {
    throw new Error(gate.reason)
  }
  return gate
}

/**
 * The snapshot a skipped suite's body is collected with when there is no real
 * one. Nothing is supported under it: `services: []` rather than undefined,
 * which means unasked and waves the service gate through.
 */
const NO_CAPABILITIES: ClusterCapabilities = {
  // Classic, because a couchbase2 placeholder would wave every feature without
  // a protocol gap through, which is backwards for this one.
  protocol: TestProtocol.Classic,
  version: { major: 0, minor: 0, patch: 0 },
  backend: 'none',
  overrides: {},
  services: [],
}

function readyState(state: RunState | undefined): {
  capabilities: ClusterCapabilities
} {
  return state?.kind === 'ready' ? state : { capabilities: NO_CAPABILITIES }
}

export function gateSuite(
  requirements: ResolvedRequirements,
  state: RunState | undefined
): Gate {
  if (!state) {
    return {
      kind: 'env-degraded',
      reason:
        `Suite '${requirements.suiteName}' needs a cluster, but no run state ` +
        'was provided, so it was collected without globalSetup. Failing rather ' +
        'than skipping, because a suite that skips silently when the harness ' +
        'did not start hides that nothing ran.',
    }
  }

  if (state.kind === 'no-cluster') {
    return { kind: 'no-cluster', reason: state.reason }
  }

  const tierGate = gateTier(requirements, state.config)
  if (tierGate.kind !== 'ok') {
    return tierGate
  }

  const protocolGate = gateProtocol(requirements, state.capabilities)
  if (protocolGate.kind !== 'ok') {
    return protocolGate
  }

  const provisioningGate = gateProvisioning(requirements, state.capabilities)
  if (provisioningGate.kind !== 'ok') {
    return provisioningGate
  }

  const featureGate = gateFeatures(state.capabilities, requirements.features)
  if (featureGate.kind !== 'ok') {
    return featureGate
  }

  // Both last, so a suite missing a feature says so rather than blaming a bug
  // list. Known issues ahead of limitations: a known issue holds on every
  // target, so the reason stays the same whichever backend the run used.
  const knownGate = gateKnownIssues(requirements.knownIssues)
  if (knownGate.kind !== 'ok') {
    return knownGate
  }

  return gateLimitations(state.capabilities, requirements.limitations)
}

function firstGate(...gates: readonly (() => Gate)[]): Gate {
  for (const gate of gates) {
    const verdict = gate()
    if (verdict.kind !== 'ok') {
      return verdict
    }
  }
  return { kind: 'ok' }
}

/**
 * A suite that declared itself protocol-bound, run under a protocol it excluded.
 * A `protocol-gap`, because a different cluster would not change it.
 */
function gateProtocol(
  requirements: ResolvedRequirements,
  capabilities: ClusterCapabilities
): Gate {
  if (requirements.protocols.includes(capabilities.protocol)) {
    return { kind: 'ok' }
  }
  return {
    kind: 'protocol-gap',
    reason:
      `Suite '${requirements.suiteName}' declares protocols ` +
      `[${requirements.protocols.join(', ')}] and this run speaks ` +
      `'${capabilities.protocol}'.`,
    fields: {
      protocol: capabilities.protocol,
      declared: requirements.protocols.join(','),
    },
  }
}

/**
 * A named-collection strategy needs collections or, before 7.0, bucket
 * management for the lease's bucket fallback. A backend with neither skips the
 * suite rather than failing it at acquisition.
 */
function gateProvisioning(
  requirements: ResolvedRequirements,
  capabilities: ClusterCapabilities
): Gate {
  if (requirements.collection === CollectionStrategy.DefaultCollection) {
    return { kind: 'ok' }
  }
  if (
    supports(capabilities, ServerFeature.Collections) ||
    supports(capabilities, ServerFeature.BucketManagement)
  ) {
    return { kind: 'ok' }
  }
  return {
    kind: 'feature-missing',
    reason:
      `Collection strategy '${requirements.collection}' needs either ` +
      'collections or, before 7.0, bucket management to fall back to, and ' +
      `the ${describeTarget(capabilities)} has neither.`,
    fields: { collection: requirements.collection },
  }
}

function gateTier(
  requirements: ResolvedRequirements,
  config: TestConfig
): Gate {
  if (TIER_RANK[requirements.tier] > TIER_RANK[config.tier]) {
    return {
      kind: 'tier-excluded',
      reason:
        `Suite is tier '${requirements.tier}' and CNTIER is '${config.tier}'. ` +
        `Run it with CNTIER=${requirements.tier}.`,
      fields: { tier: requirements.tier, run: config.tier },
    }
  }
  return { kind: 'ok' }
}
