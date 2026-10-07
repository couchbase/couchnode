import { AddressInfo } from 'net'
import { Server, createServer } from 'http'

import { afterEach, describe, expect, it } from 'vitest'

import { ConsistencyUtils } from '../infra/consistency'
import { PollTimeoutError } from '../infra/retry'

// Cluster-free tests for the management-port layer, driven by a local HTTP
// server that misbehaves on purpose.
//
// The hung-endpoint case matters most. `http.get` has no default socket
// timeout and `pollUntil` checks its deadline and signal only between attempts,
// so without the per-request timeout a host that accepts the connection and
// then goes quiet hangs the run forever.

const TIMEOUT_MS = 120
const DEADLINE_MS = 400

let servers: Server[] = []

afterEach(async () => {
  await Promise.all(
    servers.map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve()))
    )
  )
  servers = []
})

async function serve(
  handler: (path: string, respond: Responder) => void
): Promise<number> {
  const server = createServer((req, res) => {
    handler(req.url ?? '', {
      json: (body) => {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(body))
      },
      raw: (status, body) => {
        res.writeHead(status, { 'content-type': 'application/json' })
        res.end(body)
      },
      // Headers and nothing else, forever. The socket stays open, so this is
      // the case a client with no timeout cannot distinguish from a slow one.
      hang: () => res.writeHead(200, { 'content-type': 'application/json' }),
    })
  })
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  return (server.address() as AddressInfo).port
}

interface Responder {
  json(body: unknown): void
  raw(status: number, body: string): void
  hang(): void
}

function utils(port: number): ConsistencyUtils {
  return new ConsistencyUtils('127.0.0.1', 'user:pass', {
    httpTimeoutMs: TIMEOUT_MS,
    managementPort: port,
  })
}

// One node, so every wait below actually polls something.
//
// `configuredHostname` is unroutable and `hostname` is the test
// server, the shape a single node initialized without a hostname reports.
// Reading `configuredHostname` fails both the key assertion and discovery.
const ONE_NODE = {
  nodes: [
    {
      hostname: '127.0.0.1:8091',
      configuredHostname: 'configured-only.invalid:8091',
      services: ['kv'],
    },
  ],
}

/** Answers the node list and the per-node probe; 404 for anything else. */
function discovery(nodes: unknown) {
  return (path: string, respond: Responder): void => {
    if (path === '/pools/nodes') {
      respond.json(nodes)
      return
    }
    if (path === '/pools/default') {
      respond.json({ clusterName: 'selftest' })
      return
    }
    respond.raw(404, '{}')
  }
}

describe('management requests', () => {
  it('finds the cluster nodes', async () => {
    const port = await serve(discovery(ONE_NODE))

    const c = utils(port)
    await c.waitForConfig(false, { deadlineMs: DEADLINE_MS })

    // Keyed by `hostname`. `configuredHostname` is what a node was told to call
    // itself and is `127.0.0.1:8091` on any single node set up without one, so
    // reading it makes every wait dial loopback from whatever machine the tests
    // are on, which presents as the whole cluster propagating slowly.
    expect(c.nodeServices).toEqual({ '127.0.0.1:8091': ['kv'] })
  })

  it('fails discovery when a node cannot be reached, and names it', async () => {
    // Otherwise this surfaces later, as the first lease's ten-second
    // "not present on all nodes": a message about the cluster, for a fault in
    // the route to it.
    const port = await serve(
      discovery({
        nodes: [
          { hostname: '127.0.0.1:8091', services: ['kv'] },
          { hostname: 'unreachable.invalid:8091', services: ['kv'] },
        ],
      })
    )

    await expect(
      utils(port).waitForConfig(false, { deadlineMs: DEADLINE_MS })
    ).rejects.toThrow(/unreachable\.invalid/)
  })

  it('refuses a node with no hostname rather than falling back', async () => {
    const port = await serve(
      discovery({
        nodes: [{ configuredHostname: '127.0.0.1:8091', services: [] }],
      })
    )

    await expect(
      utils(port).waitForConfig(false, { deadlineMs: DEADLINE_MS })
    ).rejects.toThrow(/no hostname/)
  })

  it('gives up on an endpoint that never answers, rather than waiting forever', async () => {
    const port = await serve((_path, respond) => respond.hang())

    const started = Date.now()
    await expect(
      utils(port).waitForConfig(false, { deadlineMs: DEADLINE_MS })
    ).rejects.toThrow(PollTimeoutError)

    // What matters is that it returned at all; a generous ceiling suffices.
    expect(Date.now() - started).toBeLessThan(5_000)
  })

  it('names the hung request in the failure, not just the wait', async () => {
    const port = await serve((_path, respond) => respond.hang())

    await expect(
      utils(port).waitForConfig(false, { deadlineMs: DEADLINE_MS })
    ).rejects.toThrow(/did not respond within 120ms/)
  })

  it('reports a non-200 with its status and url', async () => {
    const port = await serve((_path, respond) =>
      respond.raw(503, '{"error":"nope"}')
    )

    await expect(
      utils(port).waitForConfig(false, { deadlineMs: DEADLINE_MS })
    ).rejects.toThrow(/\/pools\/nodes returned HTTP 503/)
  })

  it('reports a body that is not JSON', async () => {
    // A proxy answering with an HTML error page is the realistic version of
    // this, and `JSON.parse` alone would say only "Unexpected token".
    const port = await serve((_path, respond) =>
      respond.raw(200, '<html>gateway timeout</html>')
    )

    await expect(
      utils(port).waitForConfig(false, { deadlineMs: DEADLINE_MS })
    ).rejects.toThrow(/returned unparsable JSON/)
  })

  it('keeps waiting while a node has not caught up, then times out saying so', async () => {
    const port = await serve(discovery(ONE_NODE))

    const c = utils(port)
    await c.waitForConfig(false, { deadlineMs: DEADLINE_MS })

    await expect(
      c.waitUntilBucketPresent('never-arrives', { deadlineMs: DEADLINE_MS })
    ).rejects.toThrow(/reported HTTP 404, wanted 200/)
  })

  it('reads the cluster name', async () => {
    const port = await serve(discovery(ONE_NODE))

    await expect(utils(port).getClusterName()).resolves.toBe('selftest')
  })

  it('reads an unnamed cluster as no name', async () => {
    const port = await serve((_path, respond) =>
      respond.json({ clusterName: '' })
    )

    await expect(utils(port).getClusterName()).resolves.toBeNull()
  })

  it('stops promptly when the poll is cancelled', async () => {
    const port = await serve((_path, respond) => respond.hang())
    const controller = new AbortController()
    setTimeout(() => controller.abort(), TIMEOUT_MS * 2)

    // A hung request plus a cancelled poll: the signal is only checked
    // between attempts, so the per-request timeout is what lets it be reached.
    await expect(
      utils(port).waitForConfig(false, {
        deadlineMs: 60_000,
        signal: controller.signal,
      })
    ).rejects.toThrow(/Cancelled while waiting for/)
  })
})
