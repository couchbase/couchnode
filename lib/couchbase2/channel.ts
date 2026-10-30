import * as grpc from '@grpc/grpc-js'
import { readFileSync } from 'fs'
import { isIP } from 'net'
import {
  checkServerIdentity,
  rootCertificates as mozillaRootCertificates,
} from 'tls'

import type {
  Authenticator,
  ICertificateAuthenticator,
  IJwtAuthenticator,
  IPasswordAuthenticator,
} from '../authenticators'
import { InvalidArgumentError } from '../errors'
import type { CouchbaseLogger } from '../logger'
import { generateClientString } from '../utilities_internal'
import { SDK_VERSION } from '../version'
import type { Couchbase2ConnStr } from './connstr'

/**
 * How often an idle connection is pinged, in milliseconds.
 *
 * @internal
 */
export const KEEPALIVE_TIME_MS = 30000

/**
 * How long a ping may go unanswered before the connection is dropped, in
 * milliseconds.
 *
 * @internal
 */
export const KEEPALIVE_TIMEOUT_MS = 5000

/**
 * The largest message the channel accepts. gRPC's default of 4 MiB is smaller
 * than the largest document Couchbase serves.
 *
 * @internal
 */
export const MAX_RECEIVE_MESSAGE_LENGTH = 25 * 1024 * 1024

/**
 * The TLS server name sent when the target is an IP address. grpc-js sends the
 * target's host as the server name, and newer Node versions refuse an IP
 * there, so an IP target names this instead and its certificate is checked
 * against the IP by {@link channelCredentials}.
 *
 * @internal
 */
export const IP_TARGET_SERVER_NAME = 'gateway.invalid'

/**
 * The Capella root, which a couchbase2 channel trusts by default as a classic
 * connection does.
 *
 * @internal
 */
export const CAPELLA_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIDFTCCAf2gAwIBAgIRANLVkgOvtaXiQJi0V6qeNtswDQYJKoZIhvcNAQELBQAw
JDESMBAGA1UECgwJQ291Y2hiYXNlMQ4wDAYDVQQLDAVDbG91ZDAeFw0xOTEyMDYy
MjEyNTlaFw0yOTEyMDYyMzEyNTlaMCQxEjAQBgNVBAoMCUNvdWNoYmFzZTEOMAwG
A1UECwwFQ2xvdWQwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCfvOIi
enG4Dp+hJu9asdxEMRmH70hDyMXv5ZjBhbo39a42QwR59y/rC/sahLLQuNwqif85
Fod1DkqgO6Ng3vecSAwyYVkj5NKdycQu5tzsZkghlpSDAyI0xlIPSQjoORA/pCOU
WOpymA9dOjC1bo6rDyw0yWP2nFAI/KA4Z806XeqLREuB7292UnSsgFs4/5lqeil6
rL3ooAw/i0uxr/TQSaxi1l8t4iMt4/gU+W52+8Yol0JbXBTFX6itg62ppb/Eugmn
mQRMgL67ccZs7cJ9/A0wlXencX2ohZQOR3mtknfol3FH4+glQFn27Q4xBCzVkY9j
KQ20T1LgmGSngBInAgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYE
FJQOBPvrkU2In1Sjoxt97Xy8+cKNMA4GA1UdDwEB/wQEAwIBhjANBgkqhkiG9w0B
AQsFAAOCAQEARgM6XwcXPLSpFdSf0w8PtpNGehmdWijPM3wHb7WZiS47iNen3oq8
m2mm6V3Z57wbboPpfI+VEzbhiDcFfVnK1CXMC0tkF3fnOG1BDDvwt4jU95vBiNjY
xdzlTP/Z+qr0cnVbGBSZ+fbXstSiRaaAVcqQyv3BRvBadKBkCyPwo+7svQnScQ5P
Js7HEHKVms5tZTgKIw1fbmgR2XHleah1AcANB+MAPBCcTgqurqr5G7W2aPSBLLGA
fRIiVzm7VFLc7kWbp7ENH39HVG6TZzKnfl9zJYeiklo5vQQhGSMhzBsO70z4RRzi
DPFAN/4qZAgD5q3AFNIq2WWADFQGSwVJhg==
-----END CERTIFICATE-----
`

/**
 * What the channel is built from, read once at connect. It holds paths, not
 * secrets: the authorization header is kept apart, by {@link callMetadata}.
 *
 * @internal
 */
export interface ChannelSettings {
  /**
   * The gateway's address, `host:port`.
   */
  target: string

  /**
   * False when `tls_verify=none`: the channel encrypts but trusts whatever
   * certificate the gateway presents.
   */
  verifyPeer: boolean

  /**
   * A PEM file whose certificates replace the default roots.
   */
  trustCertificatePath?: string

  /**
   * Whether the default roots include Node's bundled Mozilla roots beside
   * the Capella root.
   */
  includeMozillaRoots: boolean

  /**
   * A certificate authenticator's certificate chain, presented as the
   * channel's own identity.
   */
  clientCertificatePath?: string

  /**
   * A certificate authenticator's private key.
   */
  clientKeyPath?: string

  /**
   * The `user-agent` the channel sends.
   */
  userAgent: string
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
 * Collects the channel's settings from the connection string, the
 * authenticator and the cluster's security options. A trust store set on the
 * cluster wins over the connection string's, as on classic.
 *
 * @internal
 */
export function channelSettings(
  connStr: Couchbase2ConnStr,
  auth: Authenticator | undefined,
  trustStorePath?: string
): ChannelSettings {
  const certAuth = auth as ICertificateAuthenticator | undefined
  const certificatePath = certAuth?.certificatePath || undefined
  const keyPath = certAuth?.keyPath || undefined
  if (!certificatePath !== !keyPath) {
    throw invalid(
      'Client certificate authentication needs both a certificate and a ' +
        'private key; only one was configured.'
    )
  }
  return {
    target: connStr.target,
    verifyPeer: connStr.tlsVerify !== 'none',
    trustCertificatePath: trustStorePath || connStr.trustCertificate,
    includeMozillaRoots: !connStr.disableMozillaCaCertificates,
    clientCertificatePath: certificatePath,
    clientKeyPath: keyPath,
    userAgent: `couchbase-node/${SDK_VERSION}; ${generateClientString()}`,
  }
}

/**
 * The `authorization` header the authenticator implies: Bearer for a JWT,
 * Basic for a username and password, none for a certificate, whose identity
 * is the channel's client certificate.
 *
 * @internal
 */
export function authorizationHeader(
  auth: Authenticator | undefined
): string | undefined {
  const jwtAuth = auth as IJwtAuthenticator | undefined
  if (jwtAuth?.token) {
    return `Bearer ${jwtAuth.token}`
  }
  const passAuth = auth as IPasswordAuthenticator | undefined
  if (passAuth?.username || passAuth?.password) {
    const token = Buffer.from(
      `${passAuth.username}:${passAuth.password}`
    ).toString('base64')
    return `Basic ${token}`
  }
  return undefined
}

/**
 * The kind of credentials the authenticator carries, or undefined for none.
 *
 * @internal
 */
export function authenticatorKind(
  auth: Authenticator | undefined
): 'JWT' | 'password' | 'certificate' | undefined {
  if ((auth as IJwtAuthenticator | undefined)?.token) {
    return 'JWT'
  }
  const passAuth = auth as IPasswordAuthenticator | undefined
  if (passAuth?.username || passAuth?.password) {
    return 'password'
  }
  if ((auth as ICertificateAuthenticator | undefined)?.certificatePath) {
    return 'certificate'
  }
  return undefined
}

/**
 * The metadata every call carries. The password or token travels per call,
 * not as call credentials, as the C++ client sends it.
 *
 * @internal
 */
export function callMetadata(authorization: string | undefined): grpc.Metadata {
  const metadata = new grpc.Metadata()
  if (authorization) {
    metadata.set('authorization', authorization)
  }
  return metadata
}

/**
 * Reads a configured file. One that cannot be read, or is empty, is an error,
 * never a fall back to the default roots, which would trust more issuers than
 * the configuration asked for.
 *
 * @internal
 */
function readRequired(path: string, what: string): Buffer {
  let contents: Buffer
  try {
    contents = readFileSync(path)
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    throw invalid(`Cannot read the configured ${what} '${path}': ${reason}`)
  }
  if (contents.toString().trim().length === 0) {
    throw invalid(`The configured ${what} '${path}' is empty.`)
  }
  return contents
}

/**
 * The roots a verifying channel trusts, as one PEM. A trust store replaces the
 * default set, which is the Capella root plus, unless disabled, Node's bundled
 * Mozilla roots.
 *
 * @internal
 */
export function rootCertificates(settings: ChannelSettings): Buffer {
  if (settings.trustCertificatePath) {
    return readRequired(settings.trustCertificatePath, 'trust store')
  }
  const pems = [CAPELLA_ROOT_CA]
  if (settings.includeMozillaRoots) {
    pems.push(...mozillaRootCertificates.map((pem) => `${pem}\n`))
  }
  return Buffer.from(pems.join(''))
}

/**
 * The target's host when it is an IP address, without brackets, or undefined.
 *
 * @internal
 */
export function targetIp(target: string): string | undefined {
  const host = target.slice(0, target.lastIndexOf(':')).replace(/^\[|\]$/g, '')
  return isIP(host) ? host : undefined
}

/**
 * The channel's TLS credentials. With verification off, neither the
 * gateway's certificate nor its host name is checked; a configured client
 * identity is still presented. With it on, an IP target's certificate is
 * checked against the IP rather than {@link IP_TARGET_SERVER_NAME}.
 *
 * @internal
 */
export function channelCredentials(
  settings: ChannelSettings,
  logger: CouchbaseLogger
): grpc.ChannelCredentials {
  let privateKey: Buffer | null = null
  let certChain: Buffer | null = null
  if (settings.clientCertificatePath && settings.clientKeyPath) {
    privateKey = readRequired(settings.clientKeyPath, 'client key')
    certChain = readRequired(
      settings.clientCertificatePath,
      'client certificate'
    )
  }
  if (!settings.verifyPeer) {
    logger.warn(
      'couchbase2: TLS certificate verification is DISABLED ' +
        '(tls_verify=none); the connection is encrypted but unauthenticated ' +
        'and can be intercepted. Do not use this outside development.'
    )
    return grpc.credentials.createSsl(null, privateKey, certChain, {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined,
    })
  }
  const ip = targetIp(settings.target)
  return grpc.credentials.createSsl(
    rootCertificates(settings),
    privateKey,
    certChain,
    ip
      ? { checkServerIdentity: (_, cert) => checkServerIdentity(ip, cert) }
      : {}
  )
}

/**
 * The channel's options: keepalive, the receive limit and the user agent, and
 * for an IP target the server name to send instead of the IP.
 *
 * @internal
 */
export function channelOptions(settings: ChannelSettings): grpc.ChannelOptions {
  return {
    'grpc.keepalive_time_ms': KEEPALIVE_TIME_MS,
    'grpc.keepalive_timeout_ms': KEEPALIVE_TIMEOUT_MS,
    'grpc.keepalive_permit_without_calls': 1,
    'grpc.max_receive_message_length': MAX_RECEIVE_MESSAGE_LENGTH,
    'grpc.primary_user_agent': settings.userAgent,
    ...(targetIp(settings.target)
      ? { 'grpc.ssl_target_name_override': IP_TARGET_SERVER_NAME }
      : {}),
  }
}

/**
 * Opens the channel every stub shares. It connects lazily, on the first call,
 * and reconnects for as long as it is open.
 *
 * @internal
 */
export function openChannel(
  settings: ChannelSettings,
  logger: CouchbaseLogger
): grpc.Channel {
  return new grpc.Channel(
    settings.target,
    channelCredentials(settings, logger),
    channelOptions(settings)
  )
}
