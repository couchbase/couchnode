// GoCAVES: fetch the release binary, spawn it pointed at a control socket it
// connects back on, ask it for a cluster, and hand back the connection string
// it mints.
//
// The protocol is undocumented. As `GOCAVES_VERSION` speaks it:
//
//     us:    listen on 127.0.0.1:0, spawn `gocaves --control-port=<port>`
//     caves: connects back, sends {"type":"hello"}\0
//     us:    {"type":"createcluster","id":"<uuid>"}\0
//     caves: {"type":"createdcluster","connstr":"couchbase://host:port,...",
//             "mgmt_addrs":["http://127.0.0.1:...", ...]}\0
//
// Every frame is NUL-terminated in both directions; a reader that waits for a
// newline blocks silently.
//
// An unrecognized command type is fatal to the session, not to the command:
// GoCAVES logs `unsupported packet type` and disconnects with no error frame,
// so the socket's close handler rejects every in-flight request.
//
// Each session is its own mock (OS-assigned port, uuid cluster id), so
// concurrent runs share nothing.

import { ChildProcess, spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { createWriteStream } from 'fs'
import { chmod, rename, stat, unlink } from 'fs/promises'
import { get as httpsGet } from 'https'
import { AddressInfo, Server, Socket, createServer } from 'net'
import { arch, platform, tmpdir } from 'os'
import { join } from 'path'

import { ServerVersion, parseVersion } from '../capabilities'
import { MockBackend, MockConnection } from './backend'
import { killChild } from './child'

/**
 * The pinned release. `BACKEND_UNSUPPORTED.gocaves` and `infra/limitations.ts`
 * describe this tag, and `limitations.ts` is held to it, so a bump forces a
 * re-check of both.
 */
export const GOCAVES_VERSION = 'v0.0.1-74'

const GOCAVES_URL_BASE =
  'https://github.com/couchbaselabs/gocaves/releases/download'

/**
 * GoCAVES emulates 7.0.0 and says so on `/pools`. `start()` reads that; this is
 * the fallback when `/pools` does not answer, since there is no "unknown"
 * version and failing the run over a mgmt endpoint would be out of proportion.
 */
const ASSUMED_VERSION: ServerVersion = { major: 7, minor: 0, patch: 0 }

/** What GoCAVES accepts on mgmt and kv; the same as a real test cluster's. */
const GOCAVES_USERNAME = 'Administrator'
const GOCAVES_PASSWORD = 'password'

const LAUNCH_TIMEOUT_MS = 30_000
const COMMAND_TIMEOUT_MS = 10_000
/** How long the version probe may take before the assumed version is used. */
const VERSION_PROBE_TIMEOUT_MS = 5_000

export interface GoCavesOptions {
  /** `CNCAVESPATH`. An already-downloaded binary to use as-is. */
  readonly binaryPath?: string
  /** `CNCAVESURL`. The release download base, without the version. */
  readonly urlBase?: string
  /** `CNCAVESVER`. The release tag, e.g. `v0.0.1-74`. */
  readonly version?: string
}

type CommandResolver = (err: Error | null, payload?: CavesFrame) => void

interface CavesFrame {
  readonly type?: string
  readonly connstr?: string
  readonly mgmt_addrs?: readonly string[]
}

/** One launched process plus the handles that keep the event loop alive with it. */
interface Session {
  readonly child: ChildProcess
  readonly server: Server
  readonly socket: Socket
  readonly pending: CommandResolver[]
}

export class GoCavesBackend implements MockBackend {
  readonly kind = 'gocaves' as const

  private session: Session | null = null
  private probedVersion: ServerVersion | undefined
  private log: string[] = []

  constructor(private readonly options: GoCavesOptions = {}) {}

  /**
   * What the running mock reported, or the assumed version before `start()`.
   * Read rather than declared, so a release that moves the emulated version
   * moves version gating with it.
   */
  version(): ServerVersion {
    return this.probedVersion ?? ASSUMED_VERSION
  }

  /** Exposed so a test can prove the child died. */
  get pid(): number | undefined {
    return this.session?.child.pid
  }

  async start(): Promise<MockConnection> {
    const binary = await this.ensureBinary()

    let session: Session | undefined
    try {
      session = await this.launch(binary)
      // Inside the try: a failure here would otherwise orphan the child.
      const created = await this.send(session, {
        type: 'createcluster',
        id: randomUUID(),
      })
      if (created.type !== 'createdcluster' || !created.connstr) {
        throw new Error(
          `gocaves did not create a cluster: ${JSON.stringify(created)}`
        )
      }
      this.session = session
      this.probedVersion = await probeVersion(created.mgmt_addrs ?? [])
      return {
        connectionString: created.connstr,
        username: GOCAVES_USERNAME,
        password: GOCAVES_PASSWORD,
      }
    } catch (err) {
      if (session) {
        await teardown(session)
      }
      this.session = null
      const detail = this.log.length
        ? `\ngocaves output:\n${this.log.slice(-20).join('')}`
        : ''
      throw new Error(
        `gocaves failed to start: ` +
          `${err instanceof Error ? err.message : String(err)}${detail}`
      )
    }
  }

  async stop(): Promise<void> {
    const session = this.session
    this.session = null
    if (session) {
      await teardown(session)
    }
  }

  async command(
    name: string,
    payload?: Readonly<Record<string, unknown>>
  ): Promise<unknown> {
    if (!this.session) {
      throw new Error(`gocaves is not running; cannot send '${name}'`)
    }
    return this.send(this.session, {
      ...payload,
      type: name,
    })
  }

  /**
   * Fetched to a private name and renamed into place. Writing straight to the
   * checked path would let a concurrent process execute a partial binary, and
   * a killed download would leave that partial behind for every later run.
   */
  private async ensureBinary(): Promise<string> {
    const version = this.options.version ?? GOCAVES_VERSION
    const asset = assetName()
    // The version is in the cached filename, so bumping the release tag cannot
    // silently reuse the binary the machine already has.
    const path =
      this.options.binaryPath ?? join(tmpdir(), `gocaves-${version}-${asset}`)
    const url = `${this.options.urlBase ?? GOCAVES_URL_BASE}/${version}/${asset}`

    try {
      const stats = await stat(path)
      if (stats.isFile() && stats.size > 0) {
        return path
      }
    } catch {
      // Not there, or not readable: fetch it.
    }

    if (this.options.binaryPath) {
      throw new Error(
        `CNCAVESPATH points at '${path}', which is not a readable file. ` +
          'Unset it to have the release binary downloaded instead.'
      )
    }

    const temp = `${path}.${process.pid}.tmp`
    console.log(`downloading ${url} to ${path}`)
    try {
      await download(url, temp)
      await chmod(temp, 0o755)
      try {
        await rename(temp, path)
      } catch (err) {
        // Another process won the race and its copy may already be executing,
        // which on some platforms refuses to be replaced. Both copies are the
        // same release asset, so losing the race is as good as winning it.
        const landed = await stat(path).catch(() => undefined)
        if (!landed?.isFile()) {
          throw err
        }
      }
    } finally {
      await unlink(temp).catch(() => undefined)
    }

    return path
  }

  /** Resolves once GoCAVES has connected back and greeted us. */
  private launch(binary: string): Promise<Session> {
    return new Promise<Session>((resolve, reject) => {
      const pending: CommandResolver[] = []
      let settled = false
      let child: ChildProcess | undefined
      let socket: Socket | undefined

      const server = createServer()

      // Hoisted rather than an arrow so the timer below can reference it before
      // it appears, which lets the timer be a const that `fail` can clear.
      function fail(err: Error): void {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timer)
        socket?.destroy()
        server.close()
        if (child) {
          void killChild(child)
        }
        reject(err)
      }

      const timer = setTimeout(
        () =>
          fail(
            new Error(`gocaves did not greet us within ${LAUNCH_TIMEOUT_MS}ms`)
          ),
        LAUNCH_TIMEOUT_MS
      )

      server.on('error', fail)

      server.on('connection', (conn: Socket) => {
        socket = conn
        // One connection is the whole protocol, so stop listening: a live
        // listener would keep the event loop referenced for the rest of the run.
        server.close()

        let buffer = Buffer.alloc(0)
        let greeted = false

        conn.on('data', (data: Buffer) => {
          buffer = Buffer.concat([buffer, data])
          for (;;) {
            const nul = buffer.indexOf(0)
            if (nul < 0) {
              break
            }
            const raw = buffer.subarray(0, nul).toString()
            buffer = buffer.subarray(nul + 1)

            let frame: CavesFrame
            try {
              frame = JSON.parse(raw) as CavesFrame
            } catch (err) {
              const error = err instanceof Error ? err : new Error(String(err))
              if (!greeted) {
                fail(error)
                return
              }
              pending.shift()?.(error)
              continue
            }

            if (!greeted) {
              greeted = true
              if (frame.type !== 'hello') {
                fail(
                  new Error(
                    `gocaves opened with '${frame.type}' rather than 'hello'`
                  )
                )
                return
              }
              settled = true
              clearTimeout(timer)
              resolve({
                child: child as ChildProcess,
                server,
                socket: conn,
                pending,
              })
              continue
            }

            const handler = pending.shift()
            if (!handler) {
              console.error('gocaves: reply with no pending command:', raw)
              continue
            }
            handler(null, frame)
          }
        })

        const disconnected = (err: Error): void => {
          if (!settled) {
            fail(err)
            return
          }
          // The only thing that fails an unrecognized command, which GoCAVES
          // answers by disconnecting; left pending, it would hang the run.
          for (const handler of pending.splice(0, pending.length)) {
            handler(err)
          }
        }
        conn.on('error', disconnected)
        conn.on('close', () =>
          disconnected(new Error('gocaves closed the control socket'))
        )
      })

      server.listen(0, '127.0.0.1', () => {
        const port = (server.address() as AddressInfo).port
        // `spawn` can throw synchronously (ENOEXEC on macOS arrives as a throw,
        // not an `error` event). Escaping this callback, it would become an
        // uncaught exception and the launch would wait out its timeout.
        try {
          child = spawn(binary, [`--control-port=${port}`], {
            stdio: ['ignore', 'pipe', 'pipe'],
          })
        } catch (err) {
          fail(
            new Error(
              `failed to spawn ${binary}: ` +
                `${err instanceof Error ? err.message : String(err)}`
            )
          )
          return
        }
        child.on('error', (err) =>
          fail(new Error(`failed to spawn ${binary}: ${err.message}`))
        )
        // GoCAVES logs to both streams, and its log is the only account of why
        // a startup failed: the socket can report no more than that the
        // greeting never arrived.
        const capture = (data: Buffer): void => {
          this.log.push(data.toString())
        }
        child.stdout?.on('data', capture)
        child.stderr?.on('data', capture)
        child.on('exit', (code, signal) => {
          if (!settled) {
            fail(
              new Error(
                `gocaves exited during startup (code=${code}, signal=${signal})`
              )
            )
          }
        })
      })
    })
  }

  private send(
    session: Session,
    frame: Record<string, unknown>
  ): Promise<CavesFrame> {
    return new Promise<CavesFrame>((resolve, reject) => {
      // Every command carries a deadline: an unanswered one (a typo in its
      // name, say) would otherwise hang the run at the call.
      const timer = setTimeout(
        () =>
          settle(
            new Error(
              `gocaves did not answer '${String(frame.type)}' within ` +
                `${COMMAND_TIMEOUT_MS}ms`
            )
          ),
        COMMAND_TIMEOUT_MS
      )
      let done = false
      function settle(err: Error | null, payload?: CavesFrame): void {
        if (done) {
          return
        }
        done = true
        clearTimeout(timer)
        if (err) {
          reject(err)
        } else {
          resolve(payload as CavesFrame)
        }
      }

      session.pending.push(settle)
      session.socket.write(
        Buffer.concat([Buffer.from(JSON.stringify(frame)), Buffer.from([0])]),
        (err) => {
          if (err) {
            settle(err)
          }
        }
      )
    })
  }
}

function assetName(): string {
  const machine = arch()
  switch (platform()) {
    case 'linux':
      return machine === 'arm64' ? 'gocaves-linux-arm64' : 'gocaves-linux-amd64'
    case 'darwin':
      return machine === 'arm64' ? 'gocaves-macos-arm64' : 'gocaves-macos'
    case 'win32':
      return 'gocaves-windows.exe'
    default:
      throw new Error(
        `no gocaves release asset for platform '${platform()}'. Point CNCSTR ` +
          'at a real cluster, or set CNMOCK=none.'
      )
  }
}

/**
 * What the mock says it is. A failure here is not a startup failure: the mock
 * is running, and `version()` falls back to the assumed version.
 */
async function probeVersion(
  mgmtAddrs: readonly string[]
): Promise<ServerVersion | undefined> {
  const base = mgmtAddrs[0]
  if (!base) {
    return undefined
  }
  const auth = Buffer.from(`${GOCAVES_USERNAME}:${GOCAVES_PASSWORD}`).toString(
    'base64'
  )
  try {
    const res = await fetch(`${base}/pools`, {
      headers: { authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(VERSION_PROBE_TIMEOUT_MS),
    })
    if (!res.ok) {
      return undefined
    }
    const body = (await res.json()) as { implementationVersion?: string }
    return body.implementationVersion
      ? parseVersion(body.implementationVersion)
      : undefined
  } catch {
    return undefined
  }
}

/** Follows redirects, which the GitHub release URL always issues. */
function download(url: string, destination: string, depth = 0): Promise<void> {
  if (depth > 5) {
    return Promise.reject(
      new Error(`too many redirects fetching the gocaves binary from ${url}`)
    )
  }
  return new Promise<void>((resolve, reject) => {
    const req = httpsGet(url, (res) => {
      const status = res.statusCode ?? 0
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume()
        download(
          new URL(res.headers.location, url).toString(),
          destination,
          depth + 1
        ).then(resolve, reject)
        return
      }
      if (status !== 200) {
        res.resume()
        reject(
          new Error(`failed to download gocaves from ${url}: HTTP ${status}`)
        )
        return
      }
      const file = createWriteStream(destination)
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
      file.on('error', reject)
    })
    req.on('error', reject)
  })
}

async function teardown(session: Session): Promise<void> {
  session.socket.destroy()
  session.server.close()
  for (const handler of session.pending.splice(0, session.pending.length)) {
    handler(new Error('gocaves stopped'))
  }
  await killChild(session.child)
}
