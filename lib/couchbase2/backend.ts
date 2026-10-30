import * as grpc from '@grpc/grpc-js'
import { inspect } from 'util'

import type { Authenticator } from '../authenticators'
import type { ImplementedBackend } from '../backends'
import type { WaitUntilReadyOptions } from '../diagnosticstypes'
import { FeatureNotAvailableError, InvalidArgumentError } from '../errors'
import type { CouchbaseLogger } from '../logger'
import type { ObservableRequestHandler } from '../observabilityhandler'
import { enableLogRedaction } from '../redaction'
import {
  authenticatorKind,
  authorizationHeader,
  callMetadata,
  channelSettings,
  openChannel,
} from './channel'
import { Couchbase2Buckets } from './buckets'
import { Couchbase2Collections } from './collections'
import { parseConnStr } from './connstr'
import type { HealthClient } from './generated/grpc/health/v1/Health'
import { Couchbase2Kv } from './kv'
import { Couchbase2Op, RequestContext } from './requestcontext'
import { retryUnary } from './retry'
import { loadSchema } from './schema'
import { OpenStreams } from './streaming'
import type { GatewayAddress } from './tracing'

/**
 * The health check behind `waitUntilReady`. It changes nothing, so it may
 * be sent any number of times.
 *
 * @internal
 */
export const WAIT_UNTIL_READY: Couchbase2Op = {
  name: 'wait_until_ready',
  readOnly: true,
  idempotent: true,
}

/**
 * What a couchbase2 cluster is built from.
 *
 * @internal
 */
export interface Couchbase2BackendOptions {
  /**
   * The `couchbase2://` connection string.
   */
  connStr: string

  /**
   * The cluster's authenticator.
   */
  auth: Authenticator | undefined

  /**
   * The cluster's trust store, which wins over the connection string's.
   */
  trustStorePath?: string

  /**
   * Where the connection's warnings and each retry are logged.
   */
  logger: CouchbaseLogger

  /**
   * The cluster options that were set and that a couchbase2 connection does
   * not use, by name.
   */
  ignoredConnectOptions?: string[]

  /**
   * The cluster's `logRedaction` option, which wins over the connection
   * string's.
   */
  logRedaction?: boolean
}

/**
 * A failed call, as grpc-js would report it, for a gateway that answered
 * the health check without being ready. `UNAVAILABLE` retries it.
 */
function notServing(status: string): grpc.ServiceError {
  const details = `the gateway reports ${status}`
  return Object.assign(new Error(details), {
    code: grpc.status.UNAVAILABLE,
    details,
    metadata: new grpc.Metadata(),
  })
}

/**
 * An authenticator kind as an error message names it.
 */
function describeAuth(kind: ReturnType<typeof authenticatorKind>): string {
  return kind ? `a ${kind} authenticator` : 'no authenticator'
}

/**
 * A couchbase2 cluster's connection: the channel to the gateway, the
 * metadata every call carries, the streams open on it, and whether it has
 * been closed.
 *
 * Nothing is sent at construction. The channel connects on the first call
 * and reconnects for as long as it is open, so readiness is only ever
 * checked by {@link waitUntilReady}.
 *
 * @internal
 */
export class Couchbase2Backend implements ImplementedBackend {
  /**
   * The gateway's address, `host:port`.
   */
  readonly target: string

  /**
   * The metadata every call carries.
   */
  readonly metadata: grpc.Metadata

  /**
   * The streams open on the channel, canceled when it closes.
   */
  readonly streams = new OpenStreams()

  /**
   * Key-value operations.
   */
  readonly kv: Couchbase2Kv

  /**
   * Bucket management.
   */
  readonly buckets: Couchbase2Buckets

  /**
   * Scope and collection management.
   */
  readonly collections: Couchbase2Collections

  private readonly _channel: grpc.Channel
  private readonly _address: GatewayAddress
  private readonly _logger: CouchbaseLogger
  private readonly _health: HealthClient
  private readonly _authKind: ReturnType<typeof authenticatorKind>
  private _closed = false

  /**
   * Reads the connection string and opens the channel. A connection string
   * or a TLS setting that cannot be used throws `InvalidArgumentError`.
   * Options that are read and not used are logged once, at warn.
   */
  constructor(options: Couchbase2BackendOptions) {
    const connStr = parseConnStr(options.connStr)
    const settings = channelSettings(
      connStr,
      options.auth,
      options.trustStorePath
    )
    this._logger = options.logger
    this.target = settings.target
    this._address = {
      host: connStr.host.replace(/^\[(.*)\]$/, '$1'),
      port: connStr.port,
    }
    this.metadata = callMetadata(authorizationHeader(options.auth))
    this._authKind = authenticatorKind(options.auth)
    if (options.logRedaction ?? connStr.logRedaction) {
      enableLogRedaction()
    }

    const ignored = [
      ...(options.ignoredConnectOptions ?? []),
      ...connStr.ignoredOptions,
    ]
    if (ignored.length > 0) {
      this._logger.warn(
        `couchbase2: ignoring options a couchbase2 connection does not use: ` +
          `${ignored.join(', ')}`
      )
    }
    for (const warning of connStr.warnings) {
      this._logger.warn(`couchbase2: ${warning}`)
    }

    // The schema is read from the proto files and can throw, so it is loaded
    // before the channel is opened, leaving nothing open when it does.
    const schema = loadSchema()
    this._channel = openChannel(settings, this._logger)
    // Every stub shares the channel, which carries the real credentials.
    const stubOptions = { channelOverride: this._channel }
    const insecure = grpc.credentials.createInsecure()
    this._health = new schema.grpc.health.v1.Health(
      this.target,
      insecure,
      stubOptions
    )
    this.kv = new Couchbase2Kv(
      this,
      new schema.couchbase.kv.v1.KvService(this.target, insecure, stubOptions)
    )
    this.buckets = new Couchbase2Buckets(
      this,
      new schema.couchbase.admin.bucket.v1.BucketAdminService(
        this.target,
        insecure,
        stubOptions
      )
    )
    this.collections = new Couchbase2Collections(
      this,
      new schema.couchbase.admin.collection.v1.CollectionAdminService(
        this.target,
        insecure,
        stubOptions
      )
    )
  }

  /**
   * Whether {@link Couchbase2Backend.close} has been called.
   */
  get closed(): boolean {
    return this._closed
  }

  /**
   * A new request's context, which cancels the request if the cluster
   * closes while it waits to retry. Each attempt is traced under `obs`
   * when it is given.
   */
  context(
    op: Couchbase2Op,
    timeoutMs: number,
    obs?: ObservableRequestHandler | null
  ): RequestContext {
    return new RequestContext(op, timeoutMs, {
      closed: () => this._closed,
      logger: this._logger,
      target: this.target,
      obs,
      address: this._address,
    })
  }

  /**
   * Waits until the gateway answers its health check with `SERVING`,
   * retrying for as long as it is unreachable or answers anything else. The
   * gateway's health covers the whole cluster, so `options` has no services
   * or state to narrow it to.
   */
  async waitUntilReady(
    timeout: number,
    _options?: WaitUntilReadyOptions
  ): Promise<void> {
    const ctx = this.context(WAIT_UNTIL_READY, timeout)
    await retryUnary(
      ctx,
      (options) =>
        new Promise<void>((resolve, reject) => {
          this._health.Check({}, this.metadata, options, (err, resp) => {
            if (err) {
              reject(err)
            } else if (resp?.status !== 'SERVING') {
              reject(notServing(resp?.status ?? 'no status'))
            } else {
              resolve()
            }
          })
        })
    )
  }

  /**
   * The gateway's address alone. The rest holds the channel, which does not
   * serialize, and the metadata, which carries the credentials.
   */
  toJSON(): Record<string, string> {
    return { target: this.target }
  }

  /**
   * As `toJSON`.
   */
  [inspect.custom](): Record<string, string> {
    return this.toJSON()
  }

  /**
   * Sends the new password or JWT on every call made from now on. The
   * channel is not reconnected: a client certificate is presented only when
   * it connects, so a certificate cannot be replaced, and an authenticator
   * of another kind is refused.
   */
  updateCredentials(auth: Authenticator): void {
    const current = this._authKind
    const next = authenticatorKind(auth)
    if (next !== current) {
      throw new InvalidArgumentError(
        new Error(
          `The cluster authenticates with ${describeAuth(current)}, so it ` +
            `cannot be replaced with ${describeAuth(next)}.`
        )
      )
    }
    if (next === 'certificate') {
      throw new FeatureNotAvailableError(
        new Error(
          'A certificate authenticator cannot be replaced over couchbase2.'
        )
      )
    }
    const authorization = authorizationHeader(auth)
    if (authorization) {
      this.metadata.set('authorization', authorization)
    }
  }

  /**
   * Cancels every open stream, then closes the channel. A request waiting
   * to retry ends with `RequestCanceledError`. Closing again does nothing.
   */
  async close(): Promise<void> {
    if (this._closed) {
      return
    }
    this._closed = true
    this.streams.cancelAll()
    this._channel.close()
  }
}
