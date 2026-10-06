// Every environment variable is parsed and validated here, so a bad value
// fails the run naming the variable, instead of failing later as an unmatched
// string or an assertion inside a constructor.

import {
  MockBackendKind,
  ServerFeature,
  ServerVersion,
  TestProtocol,
  featureFromName,
  parseVersion,
  protocolFromConnectionString,
} from './capabilities'

/** Suite cost tier. `slow`/`nightly` suites run on fewer triggers. */
export type Tier = 'fast' | 'slow' | 'nightly'

const TIERS: readonly Tier[] = ['fast', 'slow', 'nightly']
const BACKENDS: readonly MockBackendKind[] = ['gocaves', 'none']

/** Rank of a tier, so `CNTIER=slow` selects fast + slow but not nightly. */
export const TIER_RANK: Readonly<Record<Tier, number>> = {
  fast: 0,
  slow: 1,
  nightly: 2,
}

export interface TestConfig {
  /** `CNCSTR`. Absent means no real cluster; the mock backend decides what runs. */
  readonly connectionString?: string
  /** `CNCVER`. An override for a probed version, never a substitute for one. */
  readonly versionOverride?: ServerVersion
  readonly bucket: string
  readonly username?: string
  readonly password?: string
  /** `CNFEAT`, parsed. Unknown feature names are rejected, not stored. */
  readonly featureOverrides: Readonly<Partial<Record<ServerFeature, boolean>>>
  /**
   * `CNMOCK`. Which backend to start when no connection string is given.
   * Defaults to `gocaves`.
   */
  readonly mockBackend: MockBackendKind
  /**
   * `CNCAVESPATH`, `CNCAVESURL` and `CNCAVESVER`. The version has its own
   * variable because `infra/limitations.ts` is pinned to it, so overriding it
   * is a deliberate act rather than a side effect of another URL.
   */
  readonly gocavesPath?: string
  readonly gocavesUrl?: string
  readonly gocavesVersion?: string
  /** `CNTIER`. Highest tier to run. */
  readonly tier: Tier
  /**
   * The wire protocol this run exercises, from the `CNCSTR` scheme the SDK
   * itself dispatches on, so the harness cannot disagree with the client. No
   * override variable: it could only contradict an unambiguous input.
   */
  readonly protocol: TestProtocol
}

export class TestConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TestConfigError'
  }
}

export type Env = Readonly<Record<string, string | undefined>>

function parseFeatureOverrides(
  raw: string
): Partial<Record<ServerFeature, boolean>> {
  const overrides: Partial<Record<ServerFeature, boolean>> = {}

  for (const entry of raw.split(',')) {
    const spec = entry.trim()
    if (spec === '') {
      continue
    }

    const sign = spec[0]
    if (sign !== '+' && sign !== '-') {
      throw new TestConfigError(
        `CNFEAT entry '${spec}' must start with '+' or '-' ` +
          `(for example '+range_scan,-eventing').`
      )
    }
    const enabled = sign === '+'
    const name = spec.slice(1)

    if (name === '*') {
      // The wildcard is expanded eagerly rather than kept as a flag, so a
      // later explicit entry overrides it and the result is one flat record.
      for (const feature of Object.values(ServerFeature)) {
        overrides[feature] = enabled
      }
      continue
    }

    const feature = featureFromName(name)
    if (!feature) {
      throw new TestConfigError(
        `CNFEAT names unknown feature '${name}'. An unknown name could ` +
          `never match any gate, so a typo would disable nothing and ` +
          `report nothing.`
      )
    }
    overrides[feature] = enabled
  }

  return overrides
}

function parseEnum<T extends string>(
  name: string,
  raw: string,
  allowed: readonly T[]
): T {
  const value = raw.trim()
  if (!isOneOf(value, allowed)) {
    throw new TestConfigError(
      `${name}='${raw}' is not one of ${allowed.join(' | ')}.`
    )
  }
  return value
}

function isOneOf<T extends string>(
  value: string,
  allowed: readonly T[]
): value is T {
  return (allowed as readonly string[]).includes(value)
}

export function loadTestConfig(env: Env = process.env): TestConfig {
  const connectionString = env.CNCSTR?.trim() || undefined

  let versionOverride: ServerVersion | undefined
  if (env.CNCVER !== undefined) {
    if (!connectionString) {
      throw new TestConfigError(
        'CNCVER was set without CNCSTR. A server version override needs a ' +
          'cluster to override it for.'
      )
    }
    const parsed = parseVersion(env.CNCVER)
    if (!parsed) {
      throw new TestConfigError(
        `CNCVER='${env.CNCVER}' is not a usable server version. ` +
          `Expected major.minor.patch, and 0.0.0 is rejected: there is no ` +
          `version that means "unknown".`
      )
    }
    versionOverride = parsed
  }

  const mockBackend =
    env.CNMOCK !== undefined
      ? parseEnum('CNMOCK', env.CNMOCK, BACKENDS)
      : 'gocaves'

  const protocol = connectionString
    ? protocolFromConnectionString(connectionString)
    : TestProtocol.Classic

  // There is no mock gateway: couchbase2 runs against a real CNG or not at all.
  if (protocol === TestProtocol.Couchbase2 && mockBackend !== 'none') {
    throw new TestConfigError(
      `A couchbase2:// connection string needs CNMOCK=none: there is no mock ` +
        `gateway, so '${mockBackend}' cannot serve this protocol. Point CNCSTR ` +
        `at a real Cloud Native Gateway.`
    )
  }

  return {
    connectionString,
    versionOverride,
    bucket: env.CNBUCKET?.trim() || 'default',
    username: env.CNUSER,
    password: env.CNPASS,
    featureOverrides:
      env.CNFEAT !== undefined ? parseFeatureOverrides(env.CNFEAT) : {},
    mockBackend,
    gocavesPath: env.CNCAVESPATH?.trim() || undefined,
    gocavesUrl: env.CNCAVESURL?.trim() || undefined,
    gocavesVersion: env.CNCAVESVER?.trim() || undefined,
    tier:
      env.CNTIER !== undefined
        ? parseEnum('CNTIER', env.CNTIER, TIERS)
        : 'fast',
    protocol,
  }
}

export function hasNoCluster(config: TestConfig): boolean {
  return !config.connectionString && config.mockBackend === 'none'
}
