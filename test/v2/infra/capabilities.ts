// What the cluster under test can do, as data.
//
// Pure (no cluster, no I/O, no environment reads), so the gating rules can be
// unit tested without a server. Detection lives in
// `probe.ts`, configuration in `config.ts`.
//
// The minimum version of every feature is a `Record` entry, so a feature added
// to the enum without a minimum is a compile error rather than a runtime one.

/** A three-part server version. Build numbers and edition suffixes are dropped. */
export interface ServerVersion {
  readonly major: number
  readonly minor: number
  readonly patch: number
}

export function formatVersion(v: ServerVersion): string {
  return `${v.major}.${v.minor}.${v.patch}`
}

/** Negative if a < b, zero if equal, positive if a > b. */
export function compareVersions(a: ServerVersion, b: ServerVersion): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch
}

export function versionAtLeast(v: ServerVersion, min: ServerVersion): boolean {
  return compareVersions(v, min) >= 0
}

/**
 * Parses a version from a server or from `CNCVER`, including the suffixed form
 * the cluster reports ("7.6.10-8025-enterprise"). Returns undefined rather than
 * throwing so callers word their own error. `0.0.0` is rejected: an unknown
 * version is an error, not a value.
 */
export function parseVersion(raw: string): ServerVersion | undefined {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(raw.trim())
  if (!m) {
    return undefined
  }
  const version = {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
  }
  if (version.major === 0 && version.minor === 0 && version.patch === 0) {
    return undefined
  }
  return version
}

const V = (major: number, minor: number, patch: number): ServerVersion => ({
  major,
  minor,
  patch,
})

export type MockBackendKind = 'gocaves' | 'none'

/**
 * The wire protocol a run is exercising, resolved from the `CNCSTR` scheme,
 * the same input the SDK dispatches on. See `TestConfig.protocol`.
 */
export enum TestProtocol {
  Classic = 'classic',
  Couchbase2 = 'couchbase2',
}

export const ALL_PROTOCOLS: readonly TestProtocol[] = Object.freeze(
  Object.values(TestProtocol)
)

/** Unknown schemes resolve to `Classic`: the SDK decides what it accepts. */
export function protocolFromConnectionString(cs: string): TestProtocol {
  return /^couchbase2:\/\//i.test(cs.trim())
    ? TestProtocol.Couchbase2
    : TestProtocol.Classic
}

/**
 * The string values are the names `CNFEAT` accepts, as in `CNFEAT=+range_scan`.
 */
export enum ServerFeature {
  KeyValue = 'kv',
  Ssl = 'ssl',
  Views = 'views',
  SpatialViews = 'spatial_views',
  Query = 'query',
  Subdoc = 'subdoc',
  Xattr = 'xattr',
  Search = 'search',
  Analytics = 'analytics',
  Collections = 'collections',
  Replicas = 'replicas',
  UserManagement = 'user_management',
  BucketManagement = 'bucket_management',
  GetMeta = 'get_meta',
  AnalyticsPendingMutations = 'analytics_pending_mutations',
  UserGroupManagement = 'user_group_management',
  PreserveExpiry = 'preserve_expiry',
  Eventing = 'eventing',
  Transactions = 'transactions',
  ServerDurability = 'server_durability',
  RangeScan = 'range_scan',
  SubdocReadReplica = 'subdoc_read_replica',
  BucketDedup = 'bucket_dedup',
  UpdateCollectionMaxExpiry = 'update_collection_max_expiry',
  NegativeCollectionMaxExpiry = 'negative_collection_max_expiry',
  StorageBackend = 'storage_backend',
  NotLockedKVStatus = 'kv_not_locked',
  VectorSearch = 'vector_search',
  ScopeSearch = 'scope_search',
  ScopeSearchIndexManagement = 'scope_search_index_management',
  ScopeEventingFunctionManagement = 'scope_eventing_function_management',
  BinaryTransactions = 'binary_transactions',
  ServerGroups = 'server_groups',
  NumVbucketsSetting = 'num_vbuckets_setting',
  /**
   * `clusterName` and `clusterUUID` in the bucket configuration, which is
   * where the SDK reads the cluster labels on its spans and metrics from
   * (MB-63870). `/pools/default` has carried the name for longer, so a
   * cluster below this version can have a name and still produce no labels.
   */
  ClusterLabels = 'cluster_labels',
}

export const ALL_FEATURES: readonly ServerFeature[] = Object.freeze(
  Object.values(ServerFeature)
)

export function featureFromName(name: string): ServerFeature | undefined {
  return ALL_FEATURES.find((f) => f === name)
}

/**
 * Minimum server version per feature. A feature the server has always had
 * gets 0.0.0: the floor, not "unknown".
 */
export const FEATURE_MIN_VERSION: Readonly<
  Record<ServerFeature, ServerVersion>
> = Object.freeze({
  [ServerFeature.KeyValue]: V(0, 0, 0),
  [ServerFeature.Ssl]: V(0, 0, 0),
  [ServerFeature.Views]: V(0, 0, 0),
  [ServerFeature.SpatialViews]: V(0, 0, 0),
  [ServerFeature.Query]: V(0, 0, 0),
  [ServerFeature.Subdoc]: V(0, 0, 0),
  [ServerFeature.Xattr]: V(0, 0, 0),
  [ServerFeature.Search]: V(0, 0, 0),
  [ServerFeature.Replicas]: V(0, 0, 0),
  [ServerFeature.BucketManagement]: V(0, 0, 0),
  [ServerFeature.GetMeta]: V(0, 0, 0),
  [ServerFeature.Analytics]: V(6, 0, 0),
  [ServerFeature.UserManagement]: V(6, 0, 0),
  [ServerFeature.UserGroupManagement]: V(6, 5, 0),
  [ServerFeature.AnalyticsPendingMutations]: V(6, 5, 0),
  [ServerFeature.ServerDurability]: V(6, 5, 0),
  [ServerFeature.Collections]: V(7, 0, 0),
  [ServerFeature.PreserveExpiry]: V(7, 0, 0),
  [ServerFeature.Eventing]: V(7, 0, 0),
  [ServerFeature.Transactions]: V(7, 0, 0),
  [ServerFeature.StorageBackend]: V(7, 0, 0),
  [ServerFeature.BucketDedup]: V(7, 2, 0),
  [ServerFeature.RangeScan]: V(7, 5, 0),
  [ServerFeature.SubdocReadReplica]: V(7, 5, 0),
  [ServerFeature.UpdateCollectionMaxExpiry]: V(7, 5, 0),
  [ServerFeature.NegativeCollectionMaxExpiry]: V(7, 6, 0),
  [ServerFeature.NotLockedKVStatus]: V(7, 6, 0),
  [ServerFeature.VectorSearch]: V(7, 6, 0),
  [ServerFeature.ScopeSearch]: V(7, 6, 0),
  [ServerFeature.ScopeSearchIndexManagement]: V(7, 6, 0),
  [ServerFeature.ScopeEventingFunctionManagement]: V(7, 6, 0),
  [ServerFeature.BinaryTransactions]: V(7, 6, 2),
  [ServerFeature.ServerGroups]: V(7, 6, 2),
  [ServerFeature.NumVbucketsSetting]: V(7, 6, 2),
  [ServerFeature.ClusterLabels]: V(7, 6, 4),
})

/**
 * What GoCAVES implements, as observed by running every suite against the
 * pinned release. An allow list, so a new feature is unsupported on the mock
 * until a run shows otherwise. `Ssl`, `GetMeta` and
 * `StorageBackend` are left out because no suite has proven them; features
 * above 7.0.0 are left out because GoCAVES reports 7.0.0, so recheck this list
 * when the pin moves.
 *
 * The missing services fail in ways that look like SDK errors when a suite
 * forgets to gate: query answers every statement with HTTP 501 and an empty
 * body (`RequestCanceledError`; its N1QL engine is a stub), analytics fails to
 * parse the statement, search returns an internal server failure, and
 * eventing reports the service as absent.
 *
 * `BucketManagement` works but enforces no RAM quota (a 999999 MB bucket is
 * accepted), so a green run here says nothing about whether `exclusive` files
 * can safely overlap. Only a real cluster tests that.
 */
const GOCAVES_SUPPORTED: readonly ServerFeature[] = [
  ServerFeature.KeyValue,
  ServerFeature.Subdoc,
  ServerFeature.Xattr,
  ServerFeature.Collections,
  ServerFeature.BucketManagement,
  ServerFeature.Replicas,
  ServerFeature.Transactions,
  ServerFeature.ServerDurability,
]

/** Features a backend does not implement, whatever version it claims. */
export const BACKEND_UNSUPPORTED: Readonly<
  Record<MockBackendKind, readonly ServerFeature[]>
> = Object.freeze({
  gocaves: Object.freeze(
    ALL_FEATURES.filter((f) => !GOCAVES_SUPPORTED.includes(f))
  ),
  none: Object.freeze([]),
})

/**
 * Why a feature is unavailable under a protocol. The states differ by what you
 * do about them:
 *
 * - `not-yet` is a worklist. When the gateway gains the surface, deleting the
 *   entry is the whole change and the suites run with no edits.
 * - `not-planned` means nothing is being built towards it. It is the one that
 *   may pair with a suite-level `protocols` marker; a `not-yet` must not,
 *   because a marked suite does not come back on its own.
 */
export interface ProtocolGap {
  readonly status: 'not-yet' | 'not-planned'
  readonly note: string
}

/**
 * Derived from the protostellar protos (which admin services exist), not from
 * a run against a gateway, so a run against CNG verifies them. To check an
 * entry, `CNFEAT=+<feature>` overrides this map and runs the suite for real.
 * `classic` is empty: it can serve every feature.
 */
export const PROTOCOL_GAPS: Readonly<
  Record<TestProtocol, Readonly<Partial<Record<ServerFeature, ProtocolGap>>>>
> = Object.freeze({
  [TestProtocol.Classic]: Object.freeze({}),
  [TestProtocol.Couchbase2]: Object.freeze({
    [ServerFeature.Views]: Object.freeze({
      status: 'not-planned',
      note: 'there is no design-document admin service, so views fixtures cannot be provisioned',
    }),
    [ServerFeature.SpatialViews]: Object.freeze({
      status: 'not-planned',
      note: 'spatial views are deprecated and share the absent design-document admin service',
    }),
    [ServerFeature.UserManagement]: Object.freeze({
      status: 'not-yet',
      note: 'no admin/user service',
    }),
    [ServerFeature.UserGroupManagement]: Object.freeze({
      status: 'not-yet',
      note: 'no admin/user service',
    }),
    [ServerFeature.Eventing]: Object.freeze({
      status: 'not-yet',
      note: 'no admin service for eventing',
    }),
    [ServerFeature.ScopeEventingFunctionManagement]: Object.freeze({
      status: 'not-yet',
      note: 'no admin service for eventing',
    }),
  }),
})

export function gapFor(
  protocol: TestProtocol,
  feature: ServerFeature
): ProtocolGap | undefined {
  return PROTOCOL_GAPS[protocol][feature]
}

/** `2 not-planned, 4 not-yet`: a number CI can track as the gateway matures. */
export function describeGaps(protocol: TestProtocol): string {
  const entries = Object.values(PROTOCOL_GAPS[protocol])
  const unplanned = entries.filter((g) => g.status === 'not-planned').length
  return `${unplanned} not-planned, ${entries.length - unplanned} not-yet`
}

/**
 * A service as the cluster's own service list names it: the five the C++
 * core's `cluster_describe` maps from `/pools/default`. There is no index
 * service, so query gates on `n1ql` alone. `view` is never reported even
 * though the binding's enum has it, which is why views are ungated below.
 */
export type ServiceName =
  | 'key_value'
  | 'query'
  | 'analytics'
  | 'search'
  | 'eventing'

/**
 * Independent of version: a cluster with no search node cannot serve search,
 * and without this gate its suite would fail at the first index creation as if
 * the SDK were broken. Total over the enum, so `null` (no deployment gate) is
 * a decision rather than a default.
 */
export const FEATURE_SERVICES: Readonly<
  Record<ServerFeature, ServiceName | null>
> = Object.freeze({
  [ServerFeature.Query]: 'query',
  [ServerFeature.Search]: 'search',
  [ServerFeature.VectorSearch]: 'search',
  [ServerFeature.ScopeSearch]: 'search',
  [ServerFeature.ScopeSearchIndexManagement]: 'search',
  [ServerFeature.Analytics]: 'analytics',
  [ServerFeature.AnalyticsPendingMutations]: 'analytics',
  [ServerFeature.Eventing]: 'eventing',
  [ServerFeature.ScopeEventingFunctionManagement]: 'eventing',
  // Ungated, each deliberately.
  [ServerFeature.KeyValue]: null,
  [ServerFeature.Ssl]: null,
  [ServerFeature.Views]: null,
  [ServerFeature.SpatialViews]: null,
  [ServerFeature.Subdoc]: null,
  [ServerFeature.Xattr]: null,
  [ServerFeature.Collections]: null,
  [ServerFeature.Replicas]: null,
  [ServerFeature.UserManagement]: null,
  [ServerFeature.BucketManagement]: null,
  [ServerFeature.GetMeta]: null,
  [ServerFeature.UserGroupManagement]: null,
  [ServerFeature.PreserveExpiry]: null,
  // Key-value transactions need no query node, so the suite that wants query
  // transactions declares `Query` alongside this rather than inheriting a gate
  // that would take the key-value coverage with it.
  [ServerFeature.Transactions]: null,
  [ServerFeature.BinaryTransactions]: null,
  [ServerFeature.ServerDurability]: null,
  [ServerFeature.RangeScan]: null,
  [ServerFeature.SubdocReadReplica]: null,
  [ServerFeature.BucketDedup]: null,
  [ServerFeature.UpdateCollectionMaxExpiry]: null,
  [ServerFeature.NegativeCollectionMaxExpiry]: null,
  [ServerFeature.StorageBackend]: null,
  [ServerFeature.NotLockedKVStatus]: null,
  [ServerFeature.ServerGroups]: null,
  [ServerFeature.NumVbucketsSetting]: null,
  [ServerFeature.ClusterLabels]: null,
})

interface CapabilitiesCommon {
  /** From `CNFEAT`. Wins over every other axis, including the protocol. */
  readonly overrides: Readonly<Partial<Record<ServerFeature, boolean>>>
}

export interface ClassicCapabilities extends CapabilitiesCommon {
  readonly protocol: TestProtocol.Classic
  readonly version: ServerVersion
  readonly backend: MockBackendKind
  /**
   * Services the cluster reports as deployed, by SDK service name.
   * `undefined` means not asked (a mock is never probed) and gates nothing;
   * `[]` means asked and none came back.
   */
  readonly services?: readonly string[]
  /** Node versions as reported, when they were not all identical. */
  readonly mixedVersions?: readonly string[]
  /**
   * What the cluster reported, when `CNCVER` replaced it, so the run header can
   * show both and a deliberate override is distinguishable from a stale one.
   */
  readonly probedVersion?: ServerVersion
}

/**
 * What is knowable under `couchbase2`: the overrides, and nothing else. The
 * gateway exposes topology but no version or service list, and there is no
 * mock gateway. A separate union member rather than optional fields, so
 * reading `caps.version` on a couchbase2 run does not compile.
 */
export interface Couchbase2Capabilities extends CapabilitiesCommon {
  readonly protocol: TestProtocol.Couchbase2
}

/** Computed once per run, then read-only. */
export type ClusterCapabilities = ClassicCapabilities | Couchbase2Capabilities

export function isClassic(
  caps: ClusterCapabilities
): caps is ClassicCapabilities {
  return caps.protocol === TestProtocol.Classic
}

/**
 * Why a feature is or is not available, as one value. `supports`, `explain`
 * and `gateFeatures` all derive from it, so precedence lives in one place.
 */
export type FeatureVerdict =
  | { readonly kind: 'ok' }
  | { readonly kind: 'forced-on' }
  | { readonly kind: 'forced-off' }
  | { readonly kind: 'backend-missing' }
  | { readonly kind: 'version-too-low'; readonly min: ServerVersion }
  | { readonly kind: 'service-absent'; readonly service: ServiceName }
  | { readonly kind: 'protocol-gap'; readonly gap: ProtocolGap }

/**
 * Precedence: `CNFEAT` override, then protocol, then backend, version and
 * deployment. Under `couchbase2` the protocol check is terminal: a feature
 * with no gap entry is assumed present, so a wrong assumption fails loudly
 * rather than skipping.
 * Version comes before deployment because it is the more actionable answer.
 */
export function classifyFeature(
  caps: ClusterCapabilities,
  feature: ServerFeature
): FeatureVerdict {
  const override = caps.overrides[feature]
  if (override !== undefined) {
    return { kind: override ? 'forced-on' : 'forced-off' }
  }
  if (caps.protocol === TestProtocol.Couchbase2) {
    const gap = gapFor(caps.protocol, feature)
    return gap ? { kind: 'protocol-gap', gap } : { kind: 'ok' }
  }
  if (BACKEND_UNSUPPORTED[caps.backend].includes(feature)) {
    return { kind: 'backend-missing' }
  }
  const min = FEATURE_MIN_VERSION[feature]
  if (!versionAtLeast(caps.version, min)) {
    return { kind: 'version-too-low', min }
  }
  const service = FEATURE_SERVICES[feature]
  if (
    service !== null &&
    caps.services !== undefined &&
    !caps.services.includes(service)
  ) {
    return { kind: 'service-absent', service }
  }
  return { kind: 'ok' }
}

export function supports(
  caps: ClusterCapabilities,
  feature: ServerFeature
): boolean {
  const kind = classifyFeature(caps, feature).kind
  return kind === 'ok' || kind === 'forced-on'
}

export function describeTarget(caps: ClusterCapabilities): string {
  if (!isClassic(caps)) {
    return 'Cloud Native Gateway'
  }
  return caps.backend === 'none' ? 'real server' : `${caps.backend} backend`
}

/**
 * Human-readable "detected X, required Y", used verbatim as the skip reason.
 */
export function explain(
  caps: ClusterCapabilities,
  feature: ServerFeature
): string {
  const verdict = classifyFeature(caps, feature)
  // The protocol-independent verdicts first. Returning for all of them narrows
  // `verdict` for the classic block below, so that switch stays exhaustive.
  switch (verdict.kind) {
    case 'forced-on':
      return `Feature '${feature}' is forced on by CNFEAT.`
    case 'forced-off':
      return `Feature '${feature}' is forced off by CNFEAT.`
    case 'protocol-gap':
      return (
        `Feature '${feature}' is not available over ${caps.protocol}: ` +
        `${verdict.gap.note}. ` +
        (verdict.gap.status === 'not-planned'
          ? 'Nothing is currently being built towards this; ' +
            `if that has changed, run it anyway with CNFEAT=+${feature}.`
          : 'This gap is expected to close as the gateway matures; ' +
            `run it anyway with CNFEAT=+${feature}.`)
      )
  }
  if (!isClassic(caps)) {
    // Only `ok` can reach here: every remaining verdict is produced by the
    // classic path, which a couchbase2 run never enters.
    return `Feature '${feature}' has no recorded gap under ${caps.protocol}.`
  }
  switch (verdict.kind) {
    case 'backend-missing':
      return `Feature '${feature}' is not implemented by the ${caps.backend} backend.`
    case 'version-too-low':
      return (
        `Feature '${feature}' requires Couchbase Server >= ` +
        `${formatVersion(verdict.min)}; detected ` +
        `${formatVersion(caps.version)} (${describeTarget(caps)}).`
      )
    case 'service-absent':
      return (
        `Feature '${feature}' runs on the ${verdict.service} service, which no ` +
        `node of this cluster is running. Deployed: ` +
        `${describeServices(caps.services)}.`
      )
    case 'ok':
      return `Feature '${feature}' is supported by ${formatVersion(
        caps.version
      )} (${describeTarget(caps)}).`
  }
}

function describeServices(services: readonly string[] | undefined): string {
  if (services === undefined || services.length === 0) {
    return 'none reported'
  }
  return [...services].sort().join(', ')
}

/**
 * The outcome of a gate check. Every kind skips except `env-degraded`, which
 * fails: a configured cluster that could not be reached is never a skip.
 * The skip kinds are kept apart because each wants different triage (an old
 * server, an undeployed service, no cluster, a tier, a protocol, a mock bug,
 * a ticketed defect). `fields` is the structured half of the skip line
 * `infra/skips.ts` renders.
 */
export type Gate =
  | { readonly kind: 'ok' }
  | {
      readonly kind: 'feature-missing'
      readonly reason: string
      readonly fields?: GateFields
    }
  | {
      readonly kind: 'service-absent'
      readonly reason: string
      readonly fields?: GateFields
    }
  | {
      readonly kind: 'no-cluster'
      readonly reason: string
      readonly fields?: GateFields
    }
  | {
      readonly kind: 'tier-excluded'
      readonly reason: string
      readonly fields?: GateFields
    }
  /**
   * The inverse of `feature-missing`, for a test of what a server without a
   * feature does. Only ever per test, through `having()`.
   */
  | {
      readonly kind: 'feature-present'
      readonly reason: string
      readonly fields?: GateFields
    }
  | { readonly kind: 'env-degraded'; readonly reason: string }
  /**
   * The protocol under test cannot serve what the suite needs, whichever
   * cluster it points at. See `PROTOCOL_GAPS`.
   */
  | {
      readonly kind: 'protocol-gap'
      readonly reason: string
      readonly fields?: GateFields
    }
  /**
   * A mock backend gets one operation wrong, below the granularity of a
   * feature (subdoc works, but `mutateIn` ignores expiry). Never fires against
   * a real cluster. See `infra/limitations.ts`.
   */
  | {
      readonly kind: 'mock-limitation'
      readonly reason: string
      readonly fields?: GateFields
    }
  /**
   * An open, ticketed defect in the software under test. The only kind that
   * skips on a real cluster. See `infra/knownissues.ts`.
   */
  | {
      readonly kind: 'known-issue'
      readonly reason: string
      readonly fields?: GateFields
    }

/** `key=value` detail on a skipping gate. See `infra/skips.ts`. */
export type GateFields = Readonly<Record<string, string>>

export function gateSkips(gate: Gate): boolean {
  return gate.kind !== 'ok' && gate.kind !== 'env-degraded'
}

/** A table, so a new verdict must be mapped. */
const GATE_FOR_VERDICT: Readonly<
  Record<
    Exclude<FeatureVerdict['kind'], 'ok' | 'forced-on'>,
    'feature-missing' | 'service-absent' | 'protocol-gap'
  >
> = Object.freeze({
  'forced-off': 'feature-missing',
  'backend-missing': 'feature-missing',
  'version-too-low': 'feature-missing',
  'service-absent': 'service-absent',
  'protocol-gap': 'protocol-gap',
})

/** First unsupported feature decides; `ok` when every feature is present. */
export function gateFeatures(
  caps: ClusterCapabilities,
  features: readonly ServerFeature[]
): Gate {
  for (const feature of features) {
    const verdict = classifyFeature(caps, feature)
    if (verdict.kind === 'ok' || verdict.kind === 'forced-on') {
      continue
    }
    return {
      kind: GATE_FOR_VERDICT[verdict.kind],
      reason: explain(caps, feature),
      fields: verdictFields(caps, feature, verdict),
    }
  }
  return { kind: 'ok' }
}

/**
 * The feature, then whatever the verdict compared, so a report can tell
 * version gates apart from a backend that lacks the feature.
 */
function verdictFields(
  caps: ClusterCapabilities,
  feature: ServerFeature,
  verdict: Exclude<FeatureVerdict, { kind: 'ok' } | { kind: 'forced-on' }>
): GateFields {
  switch (verdict.kind) {
    case 'forced-off':
      return { feature, forced: 'off' }
    case 'protocol-gap':
      return {
        feature,
        protocol: caps.protocol,
        status: verdict.gap.status,
      }
  }
  if (!isClassic(caps)) {
    return { feature, protocol: caps.protocol }
  }
  switch (verdict.kind) {
    case 'backend-missing':
      return { feature, mock: caps.backend }
    case 'version-too-low':
      return {
        feature,
        required: formatVersion(verdict.min),
        observed: formatVersion(caps.version),
        server: caps.backend === 'none' ? 'real' : caps.backend,
      }
    case 'service-absent':
      return {
        feature,
        service: verdict.service,
        deployed: [...(caps.services ?? [])].sort().join(','),
      }
  }
}
