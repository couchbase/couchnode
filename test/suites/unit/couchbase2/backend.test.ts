import * as grpc from '@grpc/grpc-js'
import { execFileSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { inspect } from 'util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  CertificateAuthenticator,
  JwtAuthenticator,
  PasswordAuthenticator,
} from '../../../../lib/authenticators'
import { Cluster, ConnectOptions } from '../../../../lib/cluster'
import {
  Couchbase2Backend,
  WAIT_UNTIL_READY,
} from '../../../../lib/couchbase2/backend'
import { mapStatus } from '../../../../lib/couchbase2/errormapping'
import {
  ClusterState,
  WaitUntilReadyOptions,
} from '../../../../lib/diagnosticstypes'
import { loadSchema } from '../../../../lib/couchbase2/schema'
import { GenericErrorContext } from '../../../../lib/errorcontexts'
import {
  CouchbaseError,
  InvalidArgumentError,
  RequestCanceledError,
  UnambiguousTimeoutError,
} from '../../../../lib/errors'
import { ServiceType } from '../../../../lib/generaltypes'
import { CouchbaseLogger } from '../../../../lib/logger'

const PASSWORD = new PasswordAuthenticator('Administrator', 'password')

function capture(): { logger: CouchbaseLogger; warnings: string[] } {
  const warnings: string[] = []
  const logger = new CouchbaseLogger({
    warn: (message: string) => {
      warnings.push(message)
    },
  })
  return { logger, warnings }
}

type Line = [string, string]

function captureAll(): { logger: CouchbaseLogger; lines: Line[] } {
  const lines: Line[] = []
  const logger = new CouchbaseLogger({
    debug: (m: string) => lines.push(['debug', m]),
    info: (m: string) => lines.push(['info', m]),
    warn: (m: string) => lines.push(['warn', m]),
  })
  return { logger, lines }
}

function contextOf(err: unknown): GenericErrorContext {
  expect((err as CouchbaseError).context).toBeInstanceOf(GenericErrorContext)
  return (err as CouchbaseError).context as GenericErrorContext
}

// A fixture, so a failed assertion cannot leave the connection open: every
// cluster it opened is closed at teardown, and closing one twice is harmless.
const test = it.extend<{
  openCluster: (connStr: string, options: ConnectOptions) => Promise<Cluster>
}>({
  // eslint-disable-next-line no-empty-pattern
  openCluster: async ({}, use) => {
    const opened: Cluster[] = []
    await use(async (connStr, options) => {
      const cluster = await Cluster.connect(connStr, options)
      opened.push(cluster)
      return cluster
    })
    await Promise.all(opened.map((cluster) => cluster.close()))
  },
})

// Construction alone sends nothing, so these need no server.

describe('#couchbase2 backend construction', () => {
  it('should log ignored options and unreadable values once', async () => {
    const { logger, warnings } = capture()
    const backend = new Couchbase2Backend({
      connStr: 'couchbase2://localhost:1?kv_timeout=10&tls_verify=maybe',
      auth: PASSWORD,
      logger,
      ignoredConnectOptions: ['dnsConfig'],
    })
    await backend.close()
    expect(warnings).toEqual([
      'couchbase2: ignoring options a couchbase2 connection does not use: ' +
        'dnsConfig, kv_timeout',
      'couchbase2: unable to parse "tls_verify" (value "maybe" is not a ' +
        'valid TLS verification mode)',
    ])
  })

  it('should log nothing when every option is used', async () => {
    const { logger, warnings } = capture()
    const backend = new Couchbase2Backend({
      connStr: 'couchbase2://localhost:1',
      auth: PASSWORD,
      logger,
    })
    expect(backend.target).toBe('localhost:1')
    await backend.close()
    expect(warnings).toEqual([])
  })

  it('should log how it connects, and its close, at info', async () => {
    const { logger, lines } = captureAll()
    const backend = new Couchbase2Backend({
      connStr: 'couchbase2://localhost:1',
      auth: PASSWORD,
      logger,
    })
    backend.streams.add({ cancel: () => undefined })
    await backend.close()
    const info = lines.filter(([l]) => l === 'info').map(([, m]) => m)
    expect(info).toHaveLength(2)
    expect(info[0]).toMatch(
      new RegExp(
        '^couchbase2: open cluster, SDK version: "\\S+", grpc-js ' +
          'version: "\\d+\\.\\d+\\.\\d+", Node version: "v\\S+", ' +
          'gateway: "localhost:1", tls verification: "Capella and Mozilla ' +
          'roots", client certificate: false, authentication: "password", ' +
          'log redaction: false$'
      )
    )
    expect(info[0]).not.toContain('password@')
    expect(info[0]).not.toContain(
      Buffer.from('Administrator:password').toString('base64')
    )
    expect(info[1]).toBe(
      'couchbase2: closing the connection to localhost:1, ' +
        'canceling 1 open stream(s)'
    )
  })

  it('should log new credentials by kind alone', async () => {
    const { logger, lines } = captureAll()
    const backend = new Couchbase2Backend({
      connStr: 'couchbase2://localhost:1',
      auth: new JwtAuthenticator('one'),
      logger,
    })
    backend.updateCredentials(new JwtAuthenticator('two'))
    await backend.close()
    expect(lines).toContainEqual([
      'info',
      "couchbase2: updated the cluster's JWT credentials",
    ])
    expect(lines.some(([, m]) => m.includes('two'))).toBe(false)
  })

  it('should warn once for each value the SDK does not recognize', async () => {
    const { logger, lines } = captureAll()
    const backend = new Couchbase2Backend({
      connStr: 'couchbase2://localhost:1',
      auth: PASSWORD,
      logger,
    })
    const fail = (value: string) =>
      backend.context(WAIT_UNTIL_READY, 5000).onFailure({
        ...mapStatus(grpc.status.DATA_LOSS, 'lost', undefined, true),
        unrecognized: value,
      })
    fail('gRPC status DATA_LOSS')
    fail('gRPC status DATA_LOSS')
    fail('precondition violation "NEW"')
    await backend.close()
    expect(lines.filter(([l]) => l === 'warn').map(([, m]) => m)).toEqual([
      'couchbase2: the gateway sent gRPC status DATA_LOSS, which this SDK ' +
        'version does not recognize, so the error raised for it is a ' +
        'general one. A newer SDK may map it.',
      'couchbase2: the gateway sent precondition violation "NEW", which ' +
        'this SDK version does not recognize, so the error raised for it ' +
        'is a general one. A newer SDK may map it.',
    ])
  })

  test('should show a cluster with no credentials or channel', async ({
    openCluster,
  }) => {
    const cluster = await openCluster('couchbase2://localhost:1', {
      authenticator: PASSWORD,
    })
    const basic = Buffer.from('Administrator:password').toString('base64')
    const serialized = JSON.parse(JSON.stringify(cluster)) as {
      _auth: unknown
      _backend: unknown
    }
    expect(serialized._auth).toBe('***hidden***')
    expect(serialized._backend).toEqual({ target: 'localhost:1' })
    expect(JSON.stringify(cluster)).not.toContain(basic)
    expect(inspect(cluster, { depth: 10 })).not.toContain(basic)
  })

  it('should refuse a connection string it cannot use', () => {
    expect(
      () =>
        new Couchbase2Backend({
          connStr: 'couchbase2://a,b',
          auth: PASSWORD,
          logger: capture().logger,
        })
    ).toThrow(InvalidArgumentError)
  })

  it('should cancel open streams on close, once', async () => {
    const backend = new Couchbase2Backend({
      connStr: 'couchbase2://localhost:1',
      auth: PASSWORD,
      logger: capture().logger,
    })
    let canceled = 0
    backend.streams.add({ cancel: () => canceled++ })
    await backend.close()
    await backend.close()
    expect(canceled).toBe(1)
    expect(backend.streams.size).toBe(0)
    expect(backend.closed).toBe(true)
  })

  it('should cancel a wait on a closed backend without sending it', async () => {
    const backend = new Couchbase2Backend({
      connStr: 'couchbase2://localhost:1',
      auth: PASSWORD,
      logger: capture().logger,
    })
    await backend.close()
    const err = await backend.waitUntilReady(5000).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RequestCanceledError)
    expect(contextOf(err).last_dispatched_to).toBe('')
  })

  it('should send a new password on the calls made after it', async () => {
    const backend = new Couchbase2Backend({
      connStr: 'couchbase2://localhost:1',
      auth: PASSWORD,
      logger: capture().logger,
    })
    backend.updateCredentials(new PasswordAuthenticator('user', 'secret'))
    expect(backend.metadata.get('authorization')).toEqual([
      `Basic ${Buffer.from('user:secret').toString('base64')}`,
    ])
    await backend.close()
  })

  it('should send a new JWT on the calls made after it', async () => {
    const backend = new Couchbase2Backend({
      connStr: 'couchbase2://localhost:1',
      auth: new JwtAuthenticator('one'),
      logger: capture().logger,
    })
    backend.updateCredentials(new JwtAuthenticator('two'))
    expect(backend.metadata.get('authorization')).toEqual(['Bearer two'])
    await backend.close()
  })

  it.each([
    ['a JWT', new JwtAuthenticator('token')],
    ['a certificate', new CertificateAuthenticator('cert.pem', 'key.pem')],
  ])('should refuse to replace a password with %s', async (_name, auth) => {
    const backend = new Couchbase2Backend({
      connStr: 'couchbase2://localhost:1',
      auth: PASSWORD,
      logger: capture().logger,
    })
    expect(() => backend.updateCredentials(auth)).toThrow(InvalidArgumentError)
    expect(backend.metadata.get('authorization')).toEqual([
      `Basic ${Buffer.from('Administrator:password').toString('base64')}`,
    ])
    await backend.close()
  })
})

// A directory holding a self-signed localhost certificate, or undefined where
// openssl cannot make one (absent, or without -addext), which skips the suite.
function makeCertificate(): string | undefined {
  const dir = mkdtempSync(join(tmpdir(), 'cb2backend-'))
  try {
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '2',
        '-keyout',
        'localhost.key',
        '-out',
        'localhost.crt',
        '-subj',
        '/CN=localhost',
        '-addext',
        'subjectAltName=DNS:localhost',
      ],
      { cwd: dir, stdio: 'ignore' }
    )
    return dir
  } catch {
    rmSync(dir, { recursive: true, force: true })
    return undefined
  }
}

const certificateDir = makeCertificate()

// A health service over TLS in this process. Each Check answers with the
// next status in the script, repeating the last.
describe.skipIf(!certificateDir)('#couchbase2 backend against a server', () => {
  const dir = certificateDir as string
  let ca: string
  let server: grpc.Server
  let port: number
  let script: string[] = []
  let checks = 0
  let authorizations: string[] = []

  beforeAll(async () => {
    ca = join(dir, 'localhost.crt')

    server = new grpc.Server()
    server.addService(loadSchema().grpc.health.v1.Health.service, {
      Check: (
        call: grpc.ServerUnaryCall<unknown, unknown>,
        callback: grpc.sendUnaryData<unknown>
      ) => {
        const [authorization] = call.metadata.get('authorization')
        authorizations.push(String(authorization))
        const status = script[Math.min(checks, script.length - 1)]
        checks++
        callback(null, { status })
      },
      Watch: () => undefined,
    })
    const credentials = grpc.ServerCredentials.createSsl(
      null,
      [
        {
          private_key: readFileSync(join(dir, 'localhost.key')),
          cert_chain: readFileSync(ca),
        },
      ],
      false
    )
    port = await new Promise<number>((resolve, reject) =>
      server.bindAsync('localhost:0', credentials, (err, p) =>
        err ? reject(err) : resolve(p)
      )
    )
  })

  afterAll(() => {
    server?.forceShutdown()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  function backend(statuses: string[]): Couchbase2Backend {
    script = statuses
    checks = 0
    authorizations = []
    return new Couchbase2Backend({
      connStr: `couchbase2://localhost:${port}?trust_certificate=${ca}`,
      auth: PASSWORD,
      logger: capture().logger,
    })
  }

  it('should be ready once the gateway is serving', async () => {
    const b = backend(['SERVING'])
    try {
      await b.waitUntilReady(5000)
      expect(checks).toBe(1)
      expect(authorizations).toEqual([
        `Basic ${Buffer.from('Administrator:password').toString('base64')}`,
      ])
    } finally {
      await b.close()
    }
  })

  it('should retry until the gateway is serving', async () => {
    const b = backend(['NOT_SERVING', 'UNKNOWN', 'SERVING'])
    try {
      await b.waitUntilReady(5000)
      expect(checks).toBe(3)
    } finally {
      await b.close()
    }
  })

  it('should time out with the history of a gateway that never serves', async () => {
    const b = backend(['NOT_SERVING'])
    try {
      const err = await b.waitUntilReady(300).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(UnambiguousTimeoutError)
      const context = contextOf(err)
      expect(context.retry_reasons).toEqual(['service_not_available'])
      expect(context.retry_attempts).toBeGreaterThan(0)
      expect(context.last_error).toContain('the gateway reports NOT_SERVING')
      expect(context.last_dispatched_to).toBe(`localhost:${port}`)
    } finally {
      await b.close()
    }
  })

  it('should log the connection, and warn when the gateway goes away', async () => {
    // A server of its own, so that shutting it down leaves the others alone.
    const own = new grpc.Server()
    own.addService(loadSchema().grpc.health.v1.Health.service, {
      Check: (
        _call: grpc.ServerUnaryCall<unknown, unknown>,
        callback: grpc.sendUnaryData<unknown>
      ) => callback(null, { status: 'SERVING' }),
      Watch: () => undefined,
    })
    const ownPort = await new Promise<number>((resolve, reject) =>
      own.bindAsync(
        'localhost:0',
        grpc.ServerCredentials.createSsl(
          null,
          [
            {
              private_key: readFileSync(join(dir, 'localhost.key')),
              cert_chain: readFileSync(ca),
            },
          ],
          false
        ),
        (err, p) => (err ? reject(err) : resolve(p))
      )
    )
    const { logger, lines } = captureAll()
    const b = new Couchbase2Backend({
      connStr: `couchbase2://localhost:${ownPort}?trust_certificate=${ca}`,
      auth: PASSWORD,
      logger,
    })
    try {
      await b.waitUntilReady(5000)
      expect(lines).toContainEqual([
        'info',
        `couchbase2: connected to the gateway at localhost:${ownPort}`,
      ])
      own.forceShutdown()
      const deadline = Date.now() + 5000
      while (!lines.some(([l]) => l === 'warn') && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 20))
      }
      expect(lines.filter(([l]) => l === 'warn')).toEqual([
        [
          'warn',
          `couchbase2: lost the connection to the gateway at ` +
            `localhost:${ownPort}; reconnecting on the next request`,
        ],
      ])
    } finally {
      own.forceShutdown()
      await b.close()
    }
  })

  // Guards against CXXCBC-919, a race in the grpc C core on repeated channel
  // teardown, which grpc-js does not share.
  it('should open and close repeatedly', async () => {
    for (let i = 0; i < 25; i++) {
      const b = backend(['SERVING'])
      await b.waitUntilReady(5000)
      await b.close()
    }
  })

  test('should connect, wait and close through Cluster', async ({
    openCluster,
  }) => {
    script = ['SERVING']
    checks = 0
    const warnings: string[] = []
    const cluster = await openCluster(
      `couchbase2://localhost:${port}?trust_certificate=${ca}`,
      {
        authenticator: PASSWORD,
        timeouts: { connectTimeout: 1000 },
        logger: {
          warn: (message: string) => {
            warnings.push(message)
          },
        },
      }
    )
    await cluster.waitUntilReady(5000)
    expect(checks).toBe(1)
    expect(warnings).toEqual([
      'couchbase2: ignoring options a couchbase2 connection does not ' +
        'use: timeouts.connectTimeout',
    ])
    await cluster.close()
    const err = await cluster.waitUntilReady(5000).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RequestCanceledError)
  })
  test("should wait on a bucket through the gateway's health", async ({
    openCluster,
  }) => {
    script = ['SERVING']
    checks = 0
    const cluster = await openCluster(
      `couchbase2://localhost:${port}?trust_certificate=${ca}`,
      { authenticator: PASSWORD }
    )
    await cluster.bucket('default').waitUntilReady(5000)
    expect(checks).toBe(1)
  })

  test.for<[string, number, WaitUntilReadyOptions]>([
    ['a non positive timeout', 0, {}],
    ['an Offline desired state', 5000, { desiredState: ClusterState.Offline }],
    [
      'an unknown service type',
      5000,
      { serviceTypes: ['test-service' as ServiceType] },
    ],
  ])(
    'should refuse %s before asking the gateway',
    async ([, timeout, options], { openCluster }) => {
      checks = 0
      const cluster = await openCluster(
        `couchbase2://localhost:${port}?trust_certificate=${ca}`,
        { authenticator: PASSWORD }
      )
      await expect(
        cluster.waitUntilReady(timeout, options)
      ).rejects.toBeInstanceOf(InvalidArgumentError)
      await expect(
        cluster.bucket('default').waitUntilReady(timeout, options)
      ).rejects.toBeInstanceOf(InvalidArgumentError)
      expect(checks).toBe(0)
    }
  )

  test('should ask nothing for an empty list of services', async ({
    openCluster,
  }) => {
    checks = 0
    const cluster = await openCluster(
      `couchbase2://localhost:${port}?trust_certificate=${ca}`,
      { authenticator: PASSWORD }
    )
    await cluster.waitUntilReady(5000, { serviceTypes: [] })
    expect(checks).toBe(0)
  })
})
