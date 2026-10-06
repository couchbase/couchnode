// Management operations return before every node agrees, so a create followed
// by a use is a race. These helpers block until *all* nodes report the
// resource. The 10s default deadline allows for collection visibility lagging
// across nodes.

import { IncomingMessage, get as httpGet } from 'http'

import { PollOptions, pollUntil } from './retry'

const DEFAULT_MANAGEMENT_PORT = 8091
const VIEWS_PORT = 8092
const DEFAULT_DEADLINE_MS = 10_000

// `http.get` has no default socket timeout, and `pollUntil` checks its deadline
// only between attempts, so a host that accepts the connection and then stops
// answering would hang the wait. `waitForConfig` runs before any test, so no
// test timeout would catch it. Well under the default deadline, so a wait
// overruns by at most one request.
const DEFAULT_HTTP_TIMEOUT_MS = 5_000

/** How long the cluster name read keeps asking through a server error. */
const CLUSTER_NAME_DEADLINE_MS = 15_000

class HttpStatusError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'HttpStatusError'
  }
}

/** `hostname:port` to the service list that node reports. */
export type NodeServices = Readonly<Record<string, readonly string[]>>

interface ScopesResponse {
  scopes: { name: string; collections: { name: string }[] }[]
}

export interface ConsistencyOptions {
  readonly deadlineMs?: number
  readonly signal?: AbortSignal
}

/**
 * Overrides for testing this class without a cluster: a short timeout, and a
 * port other than the 8091 a developer's own cluster is using. Production call
 * sites pass neither.
 */
export interface ConsistencyUtilsOptions {
  /** Per-request ceiling; see `DEFAULT_HTTP_TIMEOUT_MS`. */
  readonly httpTimeoutMs?: number
  readonly managementPort?: number
}

export class ConsistencyUtils {
  private nodes: NodeServices = {}
  private readonly httpTimeoutMs: number
  private readonly managementPort: number

  constructor(
    private readonly hostname: string,
    private readonly auth: string,
    opts: ConsistencyUtilsOptions = {}
  ) {
    this.httpTimeoutMs = opts.httpTimeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS
    this.managementPort = opts.managementPort ?? DEFAULT_MANAGEMENT_PORT
  }

  /** The nodes found by `waitForConfig`, keyed by the address they answer on. */
  get nodeServices(): NodeServices {
    return this.nodes
  }

  /**
   * Discovers the cluster's nodes. Every wait below checks all of them, so
   * this has to succeed first. A mock backend has no management port, so it
   * gets an empty node set and every wait becomes a no-op.
   */
  async waitForConfig(
    isMock: boolean,
    opts: ConsistencyOptions = {}
  ): Promise<void> {
    if (isMock) {
      this.nodes = {}
      return
    }

    this.nodes = await pollUntil(
      `the cluster config at ${this.hostname}`,
      async (ctx) => {
        const nodes = await this.getConfig(ctx.signal)
        const count = Object.keys(nodes).length
        if (count === 0) {
          ctx.note('config reported zero nodes')
          return undefined
        }
        return nodes
      },
      {
        deadlineMs: opts.deadlineMs ?? DEFAULT_DEADLINE_MS,
        intervalMs: 100,
        signal: opts.signal,
        retryErrors: true,
      }
    )
  }

  /**
   * The cluster's nodes, each probed once so this machine is known to reach
   * it. Without the probe an unreachable node surfaces as a ten-second "not
   * present on all nodes" timeout, blaming propagation for a routing problem.
   *
   * Uses `hostname`, not `configuredHostname`: a single node initialized
   * without a hostname reports `configuredHostname: 127.0.0.1:8091`, which no
   * client off that machine can use. A runner reaching the cluster by a
   * different route than the nodes use for each other (port map, NAT, load
   * balancer) would need `alternateAddresses` instead.
   */
  async getConfig(signal?: AbortSignal): Promise<NodeServices> {
    const body = await this.request<{
      nodes: {
        configuredHostname?: string
        hostname?: string
        services: string[]
      }[]
    }>(this.hostname, this.managementPort, '/pools/nodes', signal)

    const nodes: Record<string, readonly string[]> = {}
    for (const node of body.nodes ?? []) {
      if (!node.hostname) {
        // No fallback to `configuredHostname`; see above.
        throw new Error(
          '/pools/nodes returned a node with no hostname, so there is no ' +
            `address to poll it at: ${JSON.stringify(node)}`
        )
      }
      nodes[node.hostname] = node.services
    }

    // Probed at the host and port the waits use.
    for (const node of Object.keys(nodes)) {
      await this.request(
        hostOf(node),
        this.managementPort,
        '/pools/default',
        signal
      )
    }

    return nodes
  }

  /**
   * Retried on a 5xx or a failed connection, because the cluster manager
   * answers `/pools/default` with a transient 500 often enough to matter.
   */
  async getClusterName(): Promise<string | null> {
    const body = await pollUntil<{ clusterName?: string }>(
      'the cluster name from /pools/default',
      async (ctx) => {
        try {
          return await this.request<{ clusterName?: string }>(
            this.hostname,
            this.managementPort,
            '/pools/default',
            ctx.signal
          )
        } catch (err) {
          if (err instanceof HttpStatusError && err.status < 500) {
            throw err
          }
          ctx.note(err instanceof Error ? err.message : String(err))
          return undefined
        }
      },
      { deadlineMs: CLUSTER_NAME_DEADLINE_MS, intervalMs: 1_000 }
    )
    return body.clusterName ?? null
  }

  async waitUntilUserPresent(
    userName: string,
    domain = 'local',
    opts: ConsistencyOptions = {}
  ): Promise<void> {
    await this.waitForStatus(
      `/settings/rbac/users/${domain}/${userName}`,
      this.managementPort,
      200,
      `user ${userName} to be present on all nodes`,
      opts
    )
  }

  async waitUntilUserDropped(
    userName: string,
    domain = 'local',
    opts: ConsistencyOptions = {}
  ): Promise<void> {
    await this.waitForStatus(
      `/settings/rbac/users/${domain}/${userName}`,
      this.managementPort,
      404,
      `user ${userName} to be dropped on all nodes`,
      opts
    )
  }

  async waitUntilGroupPresent(
    groupName: string,
    opts: ConsistencyOptions = {}
  ): Promise<void> {
    await this.waitForStatus(
      `/settings/rbac/groups/${groupName}`,
      this.managementPort,
      200,
      `group ${groupName} to be present on all nodes`,
      opts
    )
  }

  async waitUntilGroupDropped(
    groupName: string,
    opts: ConsistencyOptions = {}
  ): Promise<void> {
    await this.waitForStatus(
      `/settings/rbac/groups/${groupName}`,
      this.managementPort,
      404,
      `group ${groupName} to be dropped on all nodes`,
      opts
    )
  }

  async waitUntilBucketPresent(
    bucketName: string,
    opts: ConsistencyOptions = {}
  ): Promise<void> {
    await this.waitForStatus(
      `/pools/default/buckets/${bucketName}`,
      this.managementPort,
      200,
      `bucket ${bucketName} to be present on all nodes`,
      opts
    )
  }

  async waitUntilBucketDropped(
    bucketName: string,
    opts: ConsistencyOptions = {}
  ): Promise<void> {
    await this.waitForStatus(
      `/pools/default/buckets/${bucketName}`,
      this.managementPort,
      404,
      `bucket ${bucketName} to be dropped on all nodes`,
      opts
    )
  }

  async waitUntilDesignDocumentPresent(
    bucketName: string,
    designDocumentName: string,
    opts: ConsistencyOptions = {}
  ): Promise<void> {
    await this.waitForStatus(
      `/${bucketName}/_design/${designDocumentName}`,
      VIEWS_PORT,
      200,
      `design document ${designDocumentName} on ${bucketName} to be present on all nodes`,
      opts
    )
  }

  async waitUntilDesignDocumentDropped(
    bucketName: string,
    designDocumentName: string,
    opts: ConsistencyOptions = {}
  ): Promise<void> {
    await this.waitForStatus(
      `/${bucketName}/_design/${designDocumentName}`,
      VIEWS_PORT,
      404,
      `design document ${designDocumentName} on ${bucketName} to be dropped on all nodes`,
      opts
    )
  }

  async waitUntilViewPresent(
    bucketName: string,
    designDocumentName: string,
    viewName: string,
    opts: ConsistencyOptions = {}
  ): Promise<void> {
    await this.waitForStatus(
      `/${bucketName}/_design/${designDocumentName}/_view/${viewName}`,
      VIEWS_PORT,
      200,
      `view ${viewName} on ${designDocumentName} to be present on all nodes`,
      opts
    )
  }

  async waitUntilViewDropped(
    bucketName: string,
    designDocumentName: string,
    viewName: string,
    opts: ConsistencyOptions = {}
  ): Promise<void> {
    await this.waitForStatus(
      `/${bucketName}/_design/${designDocumentName}/_view/${viewName}`,
      VIEWS_PORT,
      404,
      `view ${viewName} on ${designDocumentName} to be dropped on all nodes`,
      opts
    )
  }

  async waitUntilScopePresent(
    bucketName: string,
    scopeName: string,
    opts: ConsistencyOptions = {}
  ): Promise<void> {
    await this.waitForBody<ScopesResponse>(
      `/pools/default/buckets/${bucketName}/scopes`,
      this.managementPort,
      (body) => body.scopes.some((s) => s.name === scopeName),
      `scope ${scopeName} on ${bucketName} to be present on all nodes`,
      opts
    )
  }

  async waitUntilScopeDropped(
    bucketName: string,
    scopeName: string,
    opts: ConsistencyOptions = {}
  ): Promise<void> {
    await this.waitForBody<ScopesResponse>(
      `/pools/default/buckets/${bucketName}/scopes`,
      this.managementPort,
      (body) => !body.scopes.some((s) => s.name === scopeName),
      `scope ${scopeName} on ${bucketName} to be dropped on all nodes`,
      opts
    )
  }

  async waitUntilCollectionPresent(
    bucketName: string,
    scopeName: string,
    collectionName: string,
    opts: ConsistencyOptions = {}
  ): Promise<void> {
    await this.waitForBody<ScopesResponse>(
      `/pools/default/buckets/${bucketName}/scopes`,
      this.managementPort,
      (body) => hasCollection(body, scopeName, collectionName),
      `collection ${scopeName}.${collectionName} on ${bucketName} to be present on all nodes`,
      opts
    )
  }

  async waitUntilCollectionDropped(
    bucketName: string,
    scopeName: string,
    collectionName: string,
    opts: ConsistencyOptions = {}
  ): Promise<void> {
    await this.waitForBody<ScopesResponse>(
      `/pools/default/buckets/${bucketName}/scopes`,
      this.managementPort,
      (body) => !hasCollection(body, scopeName, collectionName),
      `collection ${scopeName}.${collectionName} on ${bucketName} to be dropped on all nodes`,
      opts
    )
  }

  private pollOptions(opts: ConsistencyOptions): PollOptions {
    return {
      deadlineMs: opts.deadlineMs ?? DEFAULT_DEADLINE_MS,
      intervalMs: 100,
      signal: opts.signal,
      retryErrors: true,
    }
  }

  private async waitForStatus(
    path: string,
    port: number,
    expected: number,
    what: string,
    opts: ConsistencyOptions
  ): Promise<void> {
    await pollUntil(
      what,
      async (ctx) => {
        for (const node of Object.keys(this.nodes)) {
          const status = await this.requestStatus(
            hostOf(node),
            port,
            path,
            ctx.signal
          )
          if (status !== expected) {
            ctx.note(`${node} reported HTTP ${status}, wanted ${expected}`)
            return undefined
          }
        }
        return true
      },
      this.pollOptions(opts)
    )
  }

  private async waitForBody<T>(
    path: string,
    port: number,
    predicate: (body: T) => boolean,
    what: string,
    opts: ConsistencyOptions
  ): Promise<void> {
    await pollUntil(
      what,
      async (ctx) => {
        for (const node of Object.keys(this.nodes)) {
          const body = await this.request<T>(
            hostOf(node),
            port,
            path,
            ctx.signal
          )
          if (!predicate(body)) {
            ctx.note(`${node} does not match yet`)
            return undefined
          }
        }
        return true
      },
      this.pollOptions(opts)
    )
  }

  private requestStatus(
    hostname: string,
    port: number,
    path: string,
    signal?: AbortSignal
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const req = httpGet(
        {
          hostname,
          port,
          path,
          auth: this.auth,
          timeout: this.httpTimeoutMs,
          signal,
        },
        (res) => {
          res.resume()
          resolve(res.statusCode ?? 0)
        }
      )
      req.on('timeout', () =>
        req.destroy(timedOut(hostname, port, path, this.httpTimeoutMs))
      )
      req.on('error', (err) => reject(err))
      req.end()
    })
  }

  private request<T>(
    hostname: string,
    port: number,
    path: string,
    signal?: AbortSignal
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const req = httpGet(
        {
          hostname,
          port,
          path,
          auth: this.auth,
          timeout: this.httpTimeoutMs,
          signal,
        },
        (res: IncomingMessage) => {
          if (res.statusCode !== 200) {
            res.resume()
            reject(
              new HttpStatusError(
                `GET http://${hostname}:${port}${path} returned HTTP ${res.statusCode}`,
                res.statusCode ?? 0
              )
            )
            return
          }
          const chunks: Buffer[] = []
          res.on('data', (chunk: Buffer) => chunks.push(chunk))
          res.on('end', () => {
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString()) as T)
            } catch (err) {
              reject(
                new Error(
                  `GET http://${hostname}:${port}${path} returned unparsable JSON: ` +
                    `${err instanceof Error ? err.message : String(err)}`
                )
              )
            }
          })
          res.on('error', reject)
        }
      )
      // The socket timeout covers the response body as well as the headers, so
      // a host that answers and then stalls mid-body is bounded too.
      req.on('timeout', () =>
        req.destroy(timedOut(hostname, port, path, this.httpTimeoutMs))
      )
      req.on('error', (err) => reject(err))
      req.end()
    })
  }
}

/**
 * Names the request that ran out of time. `req.destroy(err)` re-emits this on
 * the request's own `error`, so it reaches the poll as the last error and gets
 * reported in `PollTimeoutError` rather than as an anonymous socket hang-up.
 */
function timedOut(
  hostname: string,
  port: number,
  path: string,
  timeoutMs: number
): Error {
  const err = new Error(
    `GET http://${hostname}:${port}${path} did not respond within ` +
      `${timeoutMs}ms`
  )
  err.name = 'ManagementRequestTimeoutError'
  return err
}

function hasCollection(
  body: ScopesResponse,
  scopeName: string,
  collectionName: string
): boolean {
  const scope = body.scopes.find((s) => s.name === scopeName)
  return !!scope?.collections.some((c) => c.name === collectionName)
}

/** The config reports `host:port`; every request needs the host alone. */
function hostOf(node: string): string {
  return node.split(':')[0]
}
