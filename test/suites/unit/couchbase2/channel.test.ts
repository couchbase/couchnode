import * as grpc from '@grpc/grpc-js'
import { execFileSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { rootCertificates as mozillaRootCertificates } from 'tls'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  Authenticator,
  CertificateAuthenticator,
  JwtAuthenticator,
  PasswordAuthenticator,
} from '../../../../lib/authenticators'
import {
  authenticatorKind,
  authorizationHeader,
  callMetadata,
  CAPELLA_ROOT_CA,
  channelOptions,
  channelSettings,
  ChannelSettings,
  CLIENT_IDLE_TIMEOUT_MS,
  describeChannel,
  IP_TARGET_SERVER_NAME,
  MAX_RECEIVE_MESSAGE_LENGTH,
  openChannel,
  rootCertificates,
  targetIp,
} from '../../../../lib/couchbase2/channel'
import { parseConnStr } from '../../../../lib/couchbase2/connstr'
import { InvalidArgumentError } from '../../../../lib/errors'
import { CouchbaseLogger } from '../../../../lib/logger'

const PASSWORD = new PasswordAuthenticator('Administrator', 'password')

function settings(
  connStr: string,
  auth: Authenticator = PASSWORD,
  trustStorePath?: string
): ChannelSettings {
  return channelSettings(parseConnStr(connStr), auth, trustStorePath)
}

function causeOf(fn: () => unknown): string | undefined {
  try {
    fn()
  } catch (e) {
    expect(e).toBeInstanceOf(InvalidArgumentError)
    return (e as InvalidArgumentError).cause?.message
  }
  return undefined
}

// Settings, credentials and metadata, without a server.
describe('#couchbase2 channel settings', () => {
  it('should verify against the default roots by default', () => {
    const s = settings('couchbase2://h')
    expect(s.target).toBe('h:18098')
    expect(s.verifyPeer).toBe(true)
    expect(s.trustCertificatePath).toBeUndefined()
    expect(s.includeMozillaRoots).toBe(true)
    expect(s.clientCertificatePath).toBeUndefined()
    expect(s.clientKeyPath).toBeUndefined()
    expect(s.userAgent).toMatch(/^couchbase-node\/\S+; node\//)
  })

  it('should not verify with tls_verify=none', () => {
    expect(settings('couchbase2://h?tls_verify=none').verifyPeer).toBe(false)
  })

  it("should take the cluster's trust store over the connstr's", () => {
    expect(
      settings('couchbase2://h?trust_certificate=/x.pem').trustCertificatePath
    ).toBe('/x.pem')
    expect(
      settings('couchbase2://h?trust_certificate=/x.pem', PASSWORD, '/y.pem')
        .trustCertificatePath
    ).toBe('/y.pem')
  })

  it("should present a certificate authenticator's pair", () => {
    const s = settings(
      'couchbase2://h',
      new CertificateAuthenticator('/c.pem', '/k.pem')
    )
    expect([s.clientCertificatePath, s.clientKeyPath]).toEqual([
      '/c.pem',
      '/k.pem',
    ])
  })

  it('should refuse half a client identity', () => {
    expect(
      causeOf(() =>
        settings('couchbase2://h', { certificatePath: '/c.pem', keyPath: '' })
      )
    ).toContain('both a certificate and a private key')
  })

  it('should send a password as Basic and a token as Bearer', () => {
    expect(authorizationHeader(PASSWORD)).toBe(
      'Basic QWRtaW5pc3RyYXRvcjpwYXNzd29yZA=='
    )
    expect(authorizationHeader(new JwtAuthenticator('a.b.c'))).toBe(
      'Bearer a.b.c'
    )
    expect(
      authorizationHeader(new CertificateAuthenticator('/c.pem', '/k.pem'))
    ).toBeUndefined()
    expect(authorizationHeader(undefined)).toBeUndefined()
  })

  it('should put a header in the call metadata only when there is one', () => {
    expect(callMetadata('Basic x').get('authorization')).toEqual(['Basic x'])
    expect(callMetadata(undefined).get('authorization')).toEqual([])
  })

  it('should set keepalive, the receive limit and the user agent', () => {
    const s = settings('couchbase2://h')
    expect(channelOptions(s)).toEqual({
      'grpc.keepalive_time_ms': 30000,
      'grpc.keepalive_timeout_ms': 5000,
      'grpc.keepalive_permit_without_calls': 1,
      'grpc.client_idle_timeout_ms': CLIENT_IDLE_TIMEOUT_MS,
      'grpc.max_receive_message_length': MAX_RECEIVE_MESSAGE_LENGTH,
      'grpc.primary_user_agent': s.userAgent,
    })
  })

  // Newer Node versions refuse an IP as the TLS server name.
  it('should send a server name other than the IP to an IP target', () => {
    for (const host of ['127.0.0.1', '[::1]']) {
      expect(
        channelOptions(settings(`couchbase2://${host}`))[
          'grpc.ssl_target_name_override'
        ]
      ).toBe(IP_TARGET_SERVER_NAME)
    }
  })

  it.each([
    ['127.0.0.1:18098', '127.0.0.1'],
    ['[::1]:18098', '::1'],
    ['localhost:18098', undefined],
    ['gateway.example.com:443', undefined],
  ])('should read the IP of the target %s', (target, ip) => {
    expect(targetIp(target)).toBe(ip)
  })

  it.each([
    [
      'couchbase2://h',
      PASSWORD,
      'tls verification: "Capella and Mozilla roots", client ' +
        'certificate: false, authentication: "password"',
    ],
    [
      'couchbase2://h?disable_mozilla_ca_certificates=true',
      new JwtAuthenticator('t'),
      'tls verification: "Capella root", client certificate: false, ' +
        'authentication: "JWT"',
    ],
    [
      'couchbase2://h?trust_certificate=/ca.pem',
      new CertificateAuthenticator('c.pem', 'k.pem'),
      'tls verification: "trust certificate", client certificate: ' +
        'true, authentication: "certificate"',
    ],
    [
      'couchbase2://h?tls_verify=none',
      undefined,
      'tls verification: "none", client certificate: false, ' +
        'authentication: "none"',
    ],
  ])('should describe %s without its credentials', (connStr, auth, text) => {
    const s = channelSettings(parseConnStr(connStr), auth)
    expect(describeChannel(s, authenticatorKind(auth))).toBe(text)
  })
})

describe('#couchbase2 root certificates', () => {
  let dir: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'cb2roots-'))
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('should trust the Capella root and the Mozilla roots by default', () => {
    const roots = rootCertificates(settings('couchbase2://h')).toString()
    expect(roots.startsWith(CAPELLA_ROOT_CA)).toBe(true)
    expect(roots).toContain(mozillaRootCertificates[0])
    expect(roots.match(/BEGIN CERTIFICATE/g)).toHaveLength(
      mozillaRootCertificates.length + 1
    )
  })

  it('should keep the Capella root without the Mozilla roots', () => {
    const roots = rootCertificates(
      settings('couchbase2://h?disable_mozilla_ca_certificates=true')
    )
    expect(roots.toString()).toBe(CAPELLA_ROOT_CA)
  })

  it('should replace both with a trust store', () => {
    const store = join(dir, 'ca.pem')
    writeFileSync(store, 'PEM')
    expect(
      rootCertificates(settings('couchbase2://h', PASSWORD, store)).toString()
    ).toBe('PEM')
  })

  it('should refuse a trust store it cannot use', () => {
    const empty = join(dir, 'empty.pem')
    writeFileSync(empty, '  \n')
    expect(
      causeOf(() =>
        rootCertificates(settings('couchbase2://h', PASSWORD, empty))
      )
    ).toContain('is empty')
    expect(
      causeOf(() =>
        rootCertificates(
          settings('couchbase2://h', PASSWORD, join(dir, 'missing.pem'))
        )
      )
    ).toContain('Cannot read the configured trust store')
  })
})

interface Pki {
  dir: string
  ca: string
  localhost: string
  localhostKey: string
  ip: string
  ipKey: string
  gateway: string
  gatewayKey: string
  client: string
  clientKey: string
}

// Each argument list is written as one string; none of them has a space.
function makePki(): Pki {
  const dir = mkdtempSync(join(tmpdir(), 'cb2pki-'))
  const openssl = (args: string) =>
    execFileSync('openssl', args.split(' '), { cwd: dir, stdio: 'ignore' })
  const key = 'rsa:2048 -nodes -days 2'
  openssl(`req -x509 -newkey ${key} -keyout ca.key -out ca.crt -subj /CN=ca`)
  const extensions = {
    localhost: 'subjectAltName=DNS:localhost\nextendedKeyUsage=serverAuth\n',
    ip: 'subjectAltName=IP:127.0.0.1\nextendedKeyUsage=serverAuth\n',
    client: 'extendedKeyUsage=clientAuth\n',
  }
  for (const [name, ext] of Object.entries(extensions)) {
    writeFileSync(join(dir, `${name}.ext`), ext)
    openssl(
      `req -newkey rsa:2048 -nodes -keyout ${name}.key -out ${name}.csr ` +
        `-subj /CN=${name}`
    )
    openssl(
      `x509 -req -in ${name}.csr -CA ca.crt -CAkey ca.key -CAcreateserial ` +
        `-out ${name}.crt -days 2 -extfile ${name}.ext`
    )
  }
  // What a gateway makes for itself when it is given no certificate:
  // self-signed, naming another host.
  openssl(
    `req -x509 -newkey ${key} -keyout gateway.key -out gateway.crt ` +
      '-subj /O=Couchbase/CN=stellar-gateway ' +
      '-addext basicConstraints=critical,CA:FALSE ' +
      '-addext extendedKeyUsage=serverAuth'
  )
  const at = (f: string) => join(dir, f)
  return {
    dir,
    ca: at('ca.crt'),
    localhost: at('localhost.crt'),
    localhostKey: at('localhost.key'),
    ip: at('ip.crt'),
    ipKey: at('ip.key'),
    gateway: at('gateway.crt'),
    gatewayKey: at('gateway.key'),
    client: at('client.crt'),
    clientKey: at('client.key'),
  }
}

const ECHO_PATH = '/test.Echo/Echo'
const identity = (b: Buffer) => b

// Answers with the authorization and user agent the call carried.
async function startServer(
  key: string,
  chain: string,
  clientCa?: string
): Promise<{ port: number; server: grpc.Server }> {
  const server = new grpc.Server()
  server.addService(
    {
      Echo: {
        path: ECHO_PATH,
        requestStream: false,
        responseStream: false,
        requestSerialize: identity,
        requestDeserialize: identity,
        responseSerialize: identity,
        responseDeserialize: identity,
      },
    },
    {
      Echo: (
        call: grpc.ServerUnaryCall<Buffer, Buffer>,
        callback: grpc.sendUnaryData<Buffer>
      ) => {
        const [authorization] = call.metadata.get('authorization')
        const [userAgent] = call.metadata.get('user-agent')
        callback(null, Buffer.from(`${authorization}|${userAgent}`))
      },
    }
  )
  const credentials = grpc.ServerCredentials.createSsl(
    clientCa ? readFileSync(clientCa) : null,
    [{ private_key: readFileSync(key), cert_chain: readFileSync(chain) }],
    clientCa !== undefined
  )
  const port = await new Promise<number>((resolve, reject) =>
    server.bindAsync('localhost:0', credentials, (err, p) =>
      err ? reject(err) : resolve(p)
    )
  )
  return { port, server }
}

function capture(): { logger: CouchbaseLogger; warnings: string[] } {
  const warnings: string[] = []
  const logger = new CouchbaseLogger({
    warn: (message: string) => {
      warnings.push(message)
    },
  })
  return { logger, warnings }
}

async function call(
  s: ChannelSettings,
  authorization: string | undefined,
  logger = capture().logger
): Promise<string> {
  const channel = openChannel(s, logger)
  const client = new grpc.Client(s.target, grpc.credentials.createInsecure(), {
    channelOverride: channel,
  })
  try {
    return await new Promise<string>((resolve, reject) => {
      client.makeUnaryRequest(
        ECHO_PATH,
        identity,
        identity,
        Buffer.alloc(0),
        callMetadata(authorization),
        { deadline: Date.now() + 10000 },
        (err, reply) => (err ? reject(err) : resolve(String(reply)))
      )
    })
  } finally {
    client.close()
    channel.close()
  }
}

// A real TLS server in this process, with certificates made for the suite.
// The certificates, or undefined where openssl cannot make them (absent, or
// without -addext), which skips the suite.
function tryMakePki(): Pki | undefined {
  try {
    return makePki()
  } catch {
    return undefined
  }
}

const madePki = tryMakePki()

describe.skipIf(!madePki)('#couchbase2 channel over TLS', () => {
  const pki = madePki as Pki
  const servers: grpc.Server[] = []

  async function serve(key: string, chain: string, clientCa?: string) {
    const { port, server } = await startServer(key, chain, clientCa)
    servers.push(server)
    return port
  }

  afterAll(() => {
    for (const server of servers) {
      server.forceShutdown()
    }
    rmSync(pki.dir, { recursive: true, force: true })
  })

  it('should verify against a trust store and send the metadata', async () => {
    const port = await serve(pki.localhostKey, pki.localhost)
    const s = settings(`couchbase2://localhost:${port}`, PASSWORD, pki.ca)
    const [authorization, userAgent] = (
      await call(s, authorizationHeader(PASSWORD))
    ).split('|')
    expect(authorization).toBe('Basic QWRtaW5pc3RyYXRvcjpwYXNzd29yZA==')
    expect(userAgent.startsWith(s.userAgent)).toBe(true)
  })

  it('should fail the call on an untrusted certificate', async () => {
    const port = await serve(pki.gatewayKey, pki.gateway)
    const s = settings(
      `couchbase2://localhost:${port}?disable_mozilla_ca_certificates=true`
    )
    await expect(call(s, undefined)).rejects.toMatchObject({
      code: grpc.status.UNAVAILABLE,
    })
  })

  // `gateway` is self-signed and names another host; `localhost` is signed
  // by a CA the server does not send.
  it.each(['gateway', 'localhost'] as const)(
    'should reach a %s certificate with tls_verify=none, and warn',
    async (name) => {
      const key = name === 'gateway' ? pki.gatewayKey : pki.localhostKey
      const chain = name === 'gateway' ? pki.gateway : pki.localhost
      const port = await serve(key, chain)
      const { logger, warnings } = capture()
      const s = settings(`couchbase2://127.0.0.1:${port}?tls_verify=none`)
      const reply = await call(s, authorizationHeader(PASSWORD), logger)
      expect(reply.startsWith('Basic ')).toBe(true)
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toContain('verification is DISABLED')
    }
  )

  it('should verify an IP target against the IP', async () => {
    const port = await serve(pki.ipKey, pki.ip)
    const s = settings(`couchbase2://127.0.0.1:${port}`, PASSWORD, pki.ca)
    const reply = await call(s, authorizationHeader(PASSWORD))
    expect(reply.startsWith('Basic ')).toBe(true)
  })

  it('should fail an IP target whose certificate names a host', async () => {
    const port = await serve(pki.localhostKey, pki.localhost)
    const s = settings(`couchbase2://127.0.0.1:${port}`, PASSWORD, pki.ca)
    await expect(call(s, undefined)).rejects.toMatchObject({
      code: grpc.status.UNAVAILABLE,
    })
  })

  it('should present a certificate authenticator', async () => {
    const port = await serve(pki.localhostKey, pki.localhost, pki.ca)
    const auth = new CertificateAuthenticator(pki.client, pki.clientKey)
    const s = settings(`couchbase2://localhost:${port}`, auth, pki.ca)
    const reply = await call(s, authorizationHeader(auth))
    expect(reply.split('|')[0]).toBe('undefined')
  })

  it('should open and close a channel repeatedly', async () => {
    const port = await serve(pki.localhostKey, pki.localhost)
    const s = settings(`couchbase2://localhost:${port}`, PASSWORD, pki.ca)
    for (let i = 0; i < 20; ++i) {
      await call(s, authorizationHeader(PASSWORD))
    }
  })
})
