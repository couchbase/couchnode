// Detects what we are actually talking to.
//
// The version is probed, `CNCVER` is only an override, and a probe that fails
// throws. There is no 0.0.0 fallback: it would gate every version-checked
// feature off and report the run green with coverage collapsed.

import binding, {
  CppManagementClusterDescribeResponse,
  CppServiceType,
} from '../../lib/binding'
import { errorFromCpp } from '../../lib/bindingutilities'
import { Cluster } from '../../lib/cluster'
import { InternalServerFailureError } from '../../lib/errors'
import {
  ClassicCapabilities,
  ClusterCapabilities,
  MockBackendKind,
  ServerFeature,
  ServerVersion,
  TestProtocol,
  compareVersions,
  describeGaps,
  formatVersion,
  isClassic,
  parseVersion,
} from './capabilities'
import { sleep } from './retry'

/** The environment is broken, as distinct from a feature being absent. */
export class ProbeError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message)
    this.name = 'ProbeError'
  }
}

export interface ProbeResult {
  /** The lowest version any node reports. */
  readonly version: ServerVersion
  readonly services: readonly string[]
  /** Every node's raw version string, in the order reported. */
  readonly nodeVersions: readonly string[]
}

const PROBE_TIMEOUT_MS = 10_000
/**
 * The cluster manager can answer one request with a 500 and the next with a
 * 200, and this read runs once for the whole run, so one bad answer would fail
 * every suite. A 500 is asked again; anything else will not clear on a retry.
 */
const PROBE_ATTEMPTS = 3
const PROBE_RETRY_DELAY_MS = 1000

export interface ProbeTarget {
  readonly connectionString: string
  readonly username?: string
  readonly password?: string
}

/**
 * Opens the connection the probe runs over. The failure is wrapped because
 * `Cluster.connect` to an unreachable endpoint rejects with a bare
 * `UnambiguousTimeoutError` whose context is `undefined` and names no endpoint.
 */
export async function openProbeConnection(
  target: ProbeTarget
): Promise<Cluster> {
  try {
    return await Cluster.connect(target.connectionString, {
      username: target.username,
      password: target.password,
      tracingConfig: { enableTracing: false },
    })
  } catch (err) {
    throw new ProbeError(
      `Could not connect to '${target.connectionString}' as ` +
        `${target.username ? `'${target.username}'` : '(no username)'} to probe ` +
        'the server version: ' +
        (err instanceof Error ? err.message : String(err)) +
        '. CNCSTR names a cluster, so this is a broken environment and the run ' +
        'fails here. It is deliberately not treated as "no cluster ' +
        'configured", which would skip and report green.',
      err
    )
  }
}

/**
 * Reads the cluster's own description over the SDK's transport rather than raw
 * HTTP to 8091, so TLS, ports, alternate addressing and credentials are handled
 * exactly as the tests' own connections handle them.
 */
export async function probeCluster(cluster: Cluster): Promise<ProbeResult> {
  let response: CppManagementClusterDescribeResponse
  try {
    response = await describeCluster(cluster)
  } catch (err) {
    throw new ProbeError(
      'Could not read the cluster description. The version cannot be ' +
        'established, so the run is failed rather than continued with ' +
        'everything gated off: ' +
        (err instanceof Error ? err.message : String(err)),
      err
    )
  }

  const summary = summarizeNodes(response.info?.nodes ?? [])

  return {
    ...summary,
    services: serviceNames(response.info?.services ?? []),
  }
}

async function describeCluster(
  cluster: Cluster
): Promise<CppManagementClusterDescribeResponse> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await new Promise<CppManagementClusterDescribeResponse>(
        (resolve, reject) => {
          cluster.conn.managementClusterDescribe(
            { timeout: PROBE_TIMEOUT_MS },
            (err, res) => (err ? reject(errorFromCpp(err)) : resolve(res))
          )
        }
      )
    } catch (err) {
      if (
        !(err instanceof InternalServerFailureError) ||
        attempt === PROBE_ATTEMPTS
      ) {
        throw err
      }
      await sleep(PROBE_RETRY_DELAY_MS)
    }
  }
}

export function summarizeNodes(
  nodes: readonly { hostname: string; version: string }[]
): { version: ServerVersion; nodeVersions: readonly string[] } {
  if (nodes.length === 0) {
    throw new ProbeError('The cluster reported no nodes.')
  }

  const parsed: ServerVersion[] = []
  for (const node of nodes) {
    const version = parseVersion(node.version)
    if (!version) {
      throw new ProbeError(
        `Node ${node.hostname} reported an unparsable version ` +
          `'${node.version}'. Refusing to guess: a version that cannot be ` +
          'read is not a version.'
      )
    }
    parsed.push(version)
  }

  // A mixed-version cluster has to gate on its lowest node: a feature the
  // oldest node lacks is not available, whichever node a request lands on.
  return {
    version: parsed.reduce((lowest, v) =>
      compareVersions(v, lowest) < 0 ? v : lowest
    ),
    nodeVersions: nodes.map((n) => n.version),
  }
}

export interface CapabilitiesInput {
  readonly backend: MockBackendKind
  readonly overrides: Readonly<Partial<Record<ServerFeature, boolean>>>
  /** `CNCVER`. Overrides the probed version; never substitutes for it. */
  readonly versionOverride?: ServerVersion
}

/**
 * The version a real cluster's features are gated on: `CNCVER` when set, else
 * what the cluster reports.
 *
 * An override above the cluster's version is refused: it can only open gates
 * for features the server lacks, so the tests behind them fail. The usual
 * cause is a `CNCVER` left exported from a run against a newer cluster.
 */
export function resolveVersion(
  probed: ServerVersion,
  override: ServerVersion | undefined
): ServerVersion {
  if (override === undefined) {
    return probed
  }
  if (compareVersions(override, probed) > 0) {
    throw new ProbeError(
      `CNCVER=${formatVersion(override)} is above the version the cluster ` +
        `reports (${formatVersion(probed)}). The version is probed, so CNCVER ` +
        'is not needed; unset it, or set it at or below the cluster version.'
    )
  }
  return override
}

export async function probeCapabilities(
  cluster: Cluster,
  input: CapabilitiesInput
): Promise<ClassicCapabilities> {
  const probed = await probeCluster(cluster)
  const distinct = new Set(probed.nodeVersions)

  return {
    protocol: TestProtocol.Classic,
    version: resolveVersion(probed.version, input.versionOverride),
    backend: input.backend,
    overrides: input.overrides,
    services: probed.services,
    mixedVersions: distinct.size > 1 ? probed.nodeVersions : undefined,
    probedVersion: probed.version,
  }
}

/**
 * Capabilities of a mock backend, whose version is declared, not probed.
 *
 * `services` is undefined (not asked) rather than empty, which would claim a
 * cluster running nothing and skip every non-key-value suite on the mock.
 */
export function backendCapabilities(
  version: ServerVersion,
  input: CapabilitiesInput
): ClassicCapabilities {
  return {
    protocol: TestProtocol.Classic,
    version: input.versionOverride ?? version,
    backend: input.backend,
    overrides: input.overrides,
  }
}

export function describeCapabilities(caps: ClusterCapabilities): string {
  if (!isClassic(caps)) {
    // No version, no backend, no service list to report, so the gap count is
    // the only thing that varies between two couchbase2 runs.
    return `Cloud Native Gateway (couchbase2 gaps: ${describeGaps(
      caps.protocol
    )})`
  }
  const target =
    caps.backend === 'none' ? 'real server' : `${caps.backend} backend`
  const services = caps.services?.length
    ? `, services: ${[...caps.services].sort().join(',')}`
    : ''
  const mixed = caps.mixedVersions
    ? ` (mixed-version cluster: ${caps.mixedVersions.join(', ')}; gating on the lowest)`
    : ''
  // Stated only when they disagree, which is exactly when the reader needs it:
  // every feature gate is resolving against a version the cluster is not.
  const probed =
    caps.probedVersion &&
    compareVersions(caps.probedVersion, caps.version) !== 0
      ? `, cluster reports ${formatVersion(caps.probedVersion)}`
      : ''
  return `${formatVersion(caps.version)} ${target}${services}${mixed}${probed}`
}

/**
 * `service_type` reaches JS as an opaque numeric enum, so the names come from
 * the addon's own table rather than from hardcoded numbers.
 */
function serviceNames(services: readonly CppServiceType[]): string[] {
  const byValue = new Map<CppServiceType, string>()
  for (const [name, value] of Object.entries(binding.service_type)) {
    byValue.set(value, name)
  }
  return services.map((s) => byValue.get(s) ?? `service_${String(s)}`)
}
