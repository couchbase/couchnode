import { ConnSpec } from '../connspec'
import { InvalidArgumentError } from '../errors'

/**
 * The scheme a couchbase2 connection string carries.
 *
 * @internal
 */
export const COUCHBASE2_SCHEME = 'couchbase2'

/**
 * The gateway's port when the connection string gives none.
 *
 * @internal
 */
export const DEFAULT_PORT = 18098

/**
 * How the gateway's certificate is checked: `peer` verifies it, `none`
 * encrypts without verifying.
 *
 * @internal
 */
export type TlsVerifyMode = 'peer' | 'none'

/**
 * What a couchbase2 connection string says, once checked.
 *
 * @internal
 */
export interface Couchbase2ConnStr {
  /**
   * The gateway's host as written, an IPv6 literal in brackets.
   */
  host: string

  /**
   * The gateway's port, {@link DEFAULT_PORT} when none was written.
   */
  port: number

  /**
   * The address as gRPC takes it, `host:port`.
   */
  target: string

  /**
   * The `tls_verify` option, `peer` by default.
   */
  tlsVerify: TlsVerifyMode

  /**
   * The `trust_certificate` option, or the legacy `trust_store_path`.
   */
  trustCertificate?: string

  /**
   * The `disable_mozilla_ca_certificates` option, false by default.
   */
  disableMozillaCaCertificates: boolean

  /**
   * The `log_redaction` option, false by default.
   */
  logRedaction: boolean

  /**
   * Options a couchbase2 connection does not use, by name.
   */
  ignoredOptions: string[]

  /**
   * Values that could not be read, each leaving its option at the default.
   */
  warnings: string[]
}

const BOOLEAN_VALUES: { [value: string]: boolean } = {
  true: true,
  yes: true,
  on: true,
  false: false,
  no: false,
  off: false,
}

/**
 * An InvalidArgumentError whose cause carries the message.
 *
 * @internal
 */
function invalid(message: string): InvalidArgumentError {
  return new InvalidArgumentError(new Error(message))
}

/**
 * Reads a boolean option, or adds a warning and returns undefined when the
 * value is not one.
 *
 * @internal
 */
function parseBoolean(
  name: string,
  value: string,
  warnings: string[]
): boolean | undefined {
  if (value in BOOLEAN_VALUES) {
    return BOOLEAN_VALUES[value]
  }
  warnings.push(
    `unable to parse "${name}" (value "${value}" cannot be interpreted as ` +
      'a boolean)'
  )
  return undefined
}

/**
 * A repeated option takes its last value, as the classic parser does.
 *
 * @internal
 */
function lastValue(value: string | string[]): string {
  return typeof value === 'string' ? value : value[value.length - 1]
}

/**
 * The part between the scheme and the path, where credentials would sit.
 *
 * @internal
 */
function authority(connStr: string): string {
  const afterScheme = connStr.slice(connStr.indexOf('://') + 3)
  return afterScheme.split(/[/?]/, 1)[0]
}

/**
 * Reads a couchbase2 connection string. The gateway balances the load over
 * the cluster itself, so a second host is refused rather than dropped, as
 * are a bucket and credentials, which the classic form allowed.
 *
 * @internal
 */
export function parseConnStr(connStr: string): Couchbase2ConnStr {
  let spec: ConnSpec
  try {
    spec = ConnSpec.parse(connStr)
  } catch {
    throw invalid(`The connection string '${connStr}' names no host.`)
  }

  if (spec.scheme !== COUCHBASE2_SCHEME) {
    throw invalid(
      `Expected a ${COUCHBASE2_SCHEME}:// connection string, got '${connStr}'.`
    )
  }
  if (authority(connStr).includes('@')) {
    throw invalid(
      'Credentials go in the authenticator, not the connection string.'
    )
  }
  if (spec.hosts.length !== 1) {
    throw invalid(
      `A ${COUCHBASE2_SCHEME}:// connection string takes one host, the ` +
        `gateway, which spreads the load over the cluster itself; got ` +
        `'${authority(connStr)}'.`
    )
  }
  if (spec.bucket) {
    throw invalid(
      `A ${COUCHBASE2_SCHEME}:// connection string names no bucket; got ` +
        `'${spec.bucket}'.`
    )
  }

  const [host, writtenPort] = spec.hosts[0]
  if (!host) {
    throw invalid(`The connection string '${connStr}' names no host.`)
  }
  if (writtenPort > 65535) {
    throw invalid(
      `The connection string '${connStr}' has an invalid port, ${writtenPort}.`
    )
  }
  const port = writtenPort || DEFAULT_PORT

  const parsed: Couchbase2ConnStr = {
    host,
    port,
    target: `${host}:${port}`,
    tlsVerify: 'peer',
    disableMozillaCaCertificates: false,
    logRedaction: false,
    ignoredOptions: [],
    warnings: [],
  }

  let legacyTrustStore: string | undefined
  for (const [name, value] of Object.entries(spec.options)) {
    const last = lastValue(value)
    if (name === 'tls_verify') {
      if (last === 'peer' || last === 'none') {
        parsed.tlsVerify = last
      } else {
        parsed.warnings.push(
          `unable to parse "tls_verify" (value "${last}" is not a valid TLS ` +
            'verification mode)'
        )
      }
    } else if (name === 'trust_certificate') {
      parsed.trustCertificate = last
    } else if (name === 'trust_store_path') {
      legacyTrustStore = last
    } else if (name === 'disable_mozilla_ca_certificates') {
      const enabled = parseBoolean(name, last, parsed.warnings)
      if (enabled !== undefined) {
        parsed.disableMozillaCaCertificates = enabled
      }
    } else if (name === 'log_redaction') {
      const enabled = parseBoolean(name, last, parsed.warnings)
      if (enabled !== undefined) {
        parsed.logRedaction = enabled
      }
    } else {
      parsed.ignoredOptions.push(name)
    }
  }
  // trust_store_path is the legacy name; trust_certificate wins when both
  // are given, as on classic.
  if (parsed.trustCertificate === undefined && legacyTrustStore) {
    parsed.trustCertificate = legacyTrustStore
  }

  return parsed
}
