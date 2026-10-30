// The couchbase2 protocol: every wait asks the SDK, through the gateway the run
// connects to.
//
// The cluster behind the gateway is never polled directly: a deployment often
// publishes only the gateway, and a pruned install has no addon for a classic
// connection. So a wait proves the change is visible through the gateway, not
// that every node agrees; key-value readiness is a separate wait the leases
// already make.
//
// An error other than the one that answers the question reads as "not yet"
// until the deadline.

import type { Cluster } from '../../../lib/cluster'
import { BucketNotFoundError } from '../../../lib/errors'
import { Couchbase2Capabilities, TestProtocol } from '../capabilities'
import type { ConsistencyOptions } from '../consistency'
import type { CapabilitiesInput } from '../probe'
import { ProbeError } from '../probe'
import { pollUntil } from '../retry'
import type { ProtocolAdapter } from './adapter'

/** The same ceiling as the classic default, for the same waits. */
const DEFAULT_DEADLINE_MS = 10_000
/** The same per-request ceiling as the classic checker's HTTP requests. */
const REQUEST_TIMEOUT_MS = 5_000
const POLL_INTERVAL_MS = 100
const READY_TIMEOUT_MS = 10_000

export class Couchbase2ProtocolAdapter implements ProtocolAdapter {
  readonly protocol = TestProtocol.Couchbase2

  constructor(private readonly cluster: Cluster) {}

  /**
   * The gateway exposes no version or service list, so there is nothing to
   * probe but whether it answers. That is checked rather than assumed, so a
   * wrong `CNCSTR` fails the run here and not in every suite's setup.
   */
  async probe(
    cluster: Cluster,
    input: CapabilitiesInput
  ): Promise<Couchbase2Capabilities> {
    try {
      await cluster.waitUntilReady(READY_TIMEOUT_MS)
    } catch (err) {
      throw new ProbeError(
        'The gateway did not report ready: ' +
          (err instanceof Error ? err.message : String(err)),
        err
      )
    }
    return { protocol: TestProtocol.Couchbase2, overrides: input.overrides }
  }

  waitUntilBucketPresent(b: string, o?: ConsistencyOptions): Promise<void> {
    return this.waitFor(`bucket ${b} to be listed`, true, o, () =>
      this.bucketPresent(b)
    )
  }
  waitUntilBucketDropped(b: string, o?: ConsistencyOptions): Promise<void> {
    return this.waitFor(`bucket ${b} to be dropped`, false, o, () =>
      this.bucketPresent(b)
    )
  }
  waitUntilScopePresent(
    b: string,
    s: string,
    o?: ConsistencyOptions
  ): Promise<void> {
    return this.waitFor(`scope ${s} on ${b} to be listed`, true, o, () =>
      this.scopePresent(b, s)
    )
  }
  waitUntilScopeDropped(
    b: string,
    s: string,
    o?: ConsistencyOptions
  ): Promise<void> {
    return this.waitFor(`scope ${s} on ${b} to be dropped`, false, o, () =>
      this.scopePresent(b, s)
    )
  }
  waitUntilCollectionPresent(
    b: string,
    s: string,
    c: string,
    o?: ConsistencyOptions
  ): Promise<void> {
    return this.waitFor(
      `collection ${s}.${c} on ${b} to be listed`,
      true,
      o,
      () => this.collectionPresent(b, s, c)
    )
  }
  waitUntilCollectionDropped(
    b: string,
    s: string,
    c: string,
    o?: ConsistencyOptions
  ): Promise<void> {
    return this.waitFor(
      `collection ${s}.${c} on ${b} to be dropped`,
      false,
      o,
      () => this.collectionPresent(b, s, c)
    )
  }

  // Views have no admin service over couchbase2 (`ServerFeature.Views` is a
  // protocol gap), so nothing should reach these. One that does throws, rather
  // than passing at once and letting a views test fail on its own.
  waitUntilDesignDocumentPresent(): Promise<void> {
    return Promise.reject(unsupported('waitUntilDesignDocumentPresent'))
  }
  waitUntilDesignDocumentDropped(): Promise<void> {
    return Promise.reject(unsupported('waitUntilDesignDocumentDropped'))
  }

  private async bucketPresent(bucketName: string): Promise<boolean> {
    try {
      await this.cluster
        .buckets()
        .getBucket(bucketName, { timeout: REQUEST_TIMEOUT_MS })
      return true
    } catch (err) {
      if (err instanceof BucketNotFoundError) {
        return false
      }
      throw err
    }
  }

  private async scopePresent(
    bucketName: string,
    scopeName: string
  ): Promise<boolean> {
    const scopes = await this.scopes(bucketName)
    return scopes.some((scope) => scope.name === scopeName)
  }

  private async collectionPresent(
    bucketName: string,
    scopeName: string,
    collectionName: string
  ): Promise<boolean> {
    const scopes = await this.scopes(bucketName)
    const scope = scopes.find((s) => s.name === scopeName)
    return scope?.collections.some((c) => c.name === collectionName) ?? false
  }

  private scopes(bucketName: string) {
    return this.cluster
      .bucket(bucketName)
      .collections()
      .getAllScopes({ timeout: REQUEST_TIMEOUT_MS })
  }

  private async waitFor(
    what: string,
    want: boolean,
    opts: ConsistencyOptions = {},
    check: () => Promise<boolean>
  ): Promise<void> {
    await pollUntil<true>(
      `${what} through the gateway`,
      async (ctx) => {
        let seen: boolean
        try {
          seen = await check()
        } catch (err) {
          ctx.note(
            `the gateway answered ${err instanceof Error ? err.message : String(err)}`
          )
          return undefined
        }
        if (seen === want) {
          return true
        }
        ctx.note(want ? 'not listed yet' : 'still listed')
        return undefined
      },
      {
        deadlineMs: opts.deadlineMs ?? DEFAULT_DEADLINE_MS,
        intervalMs: POLL_INTERVAL_MS,
        signal: opts.signal,
      }
    )
  }
}

function unsupported(wait: string): Error {
  return new Error(
    `${wait} has no couchbase2 equivalent: views are a protocol gap, so no ` +
      'suite under couchbase2 should reach it.'
  )
}
