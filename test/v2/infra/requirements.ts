// What a suite declares it needs. Read by `defineSuite` at collection time.

import { ALL_PROTOCOLS, ServerFeature, TestProtocol } from './capabilities'
import { Tier } from './config'
import type { DocBatchSpec } from './data/loader'
import type { KnownIssueId } from './knownissues'
import type { LimitationId } from './limitations'

export enum CollectionStrategy {
  /** `_default._default`; isolation by prefixed keys. Cheapest. */
  DefaultCollection = 'default',
  /**
   * A scope and collection created for this suite in this worker, empty on
   * acquisition. The lease mints a name never used before, so a run that died
   * before releasing cannot hand a suite its documents.
   */
  Named = 'named',
  /**
   * `_default._default` of a bucket created for this suite, so it is empty.
   * For suites that assert over the whole default collection, such as
   * `rangescan`. A bucket is expensive: prefer `Named` wherever the tests do
   * not care which collection they get.
   */
  CleanDefault = 'clean-default',
  /** Parametrise the suite over DefaultCollection and Named. */
  Both = 'both',
}

/**
 * What the `docs` fixture loads. `uid` is not declarable: it has to be unique
 * per batch, and a suite that could set it could collide two of its own.
 */
export type DocsRequirement = Omit<DocBatchSpec, 'uid' | 'signal'>

export interface SuiteRequirements {
  readonly features?: readonly ServerFeature[]
  readonly collection?: CollectionStrategy
  readonly tier?: Tier
  /** Declared to get the `docs` fixture; `{}` means the nine grid documents. */
  readonly docs?: DocsRequirement
  /**
   * Protocols this suite can run under. Default: all of them.
   *
   * Reach for this last: most protocol divergence is a missing feature, which
   * a `PROTOCOL_GAPS` entry already skips. This is for a suite asserting on
   * transport internals or protocol-specific semantics.
   */
  readonly protocols?: readonly TestProtocol[]
  /**
   * Mock backend defects that make this whole file unrunnable. See
   * `infra/limitations.ts`. Prefer the narrowest form, `ctx.limited()` with
   * `test.skipIf` or `describe.skipIf`, which keeps the rest of the file running.
   */
  readonly limitations?: readonly LimitationId[]
  /**
   * Open, ticketed defects that make this whole file unrunnable everywhere.
   * See `infra/knownissues.ts`. Prefer the narrowest form here too: this one
   * silences the real cluster as well.
   */
  readonly knownIssues?: readonly KnownIssueId[]
}

/** A suite's requirements with every default filled in and `Both` split out. */
export interface ResolvedRequirements {
  readonly suiteName: string
  readonly features: readonly ServerFeature[]
  /** Never `Both`: one resolved strategy per emitted describe block. */
  readonly collection: Exclude<CollectionStrategy, CollectionStrategy.Both>
  readonly tier: Tier
  readonly docs: DocsRequirement
  readonly protocols: readonly TestProtocol[]
  readonly limitations: readonly LimitationId[]
  readonly knownIssues: readonly KnownIssueId[]
}

export const DEFAULT_REQUIREMENTS: ResolvedRequirements = {
  suiteName: '<undeclared>',
  features: [],
  collection: CollectionStrategy.DefaultCollection,
  tier: 'fast',
  docs: {},
  protocols: ALL_PROTOCOLS,
  limitations: [],
  knownIssues: [],
}

/** The strategies a `Both` suite runs under, in the order they are emitted. */
export function strategiesFor(
  strategy: CollectionStrategy
): Exclude<CollectionStrategy, CollectionStrategy.Both>[] {
  return strategy === CollectionStrategy.Both
    ? [CollectionStrategy.DefaultCollection, CollectionStrategy.Named]
    : [strategy]
}

export function resolveRequirements(
  suiteName: string,
  reqs: SuiteRequirements,
  strategy: Exclude<CollectionStrategy, CollectionStrategy.Both>
): ResolvedRequirements {
  return {
    suiteName,
    features: reqs.features ?? [],
    collection: strategy,
    tier: reqs.tier ?? 'fast',
    docs: reqs.docs ?? {},
    protocols: reqs.protocols ?? ALL_PROTOCOLS,
    limitations: reqs.limitations ?? [],
    knownIssues: reqs.knownIssues ?? [],
  }
}
