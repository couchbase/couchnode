import * as grpc from '@grpc/grpc-js'
import { randomUUID } from 'crypto'
import { performance } from 'perf_hooks'

import { GenericErrorContext } from '../errorcontexts'
import {
  AmbiguousTimeoutError,
  CouchbaseError,
  RequestCanceledError,
  UnambiguousTimeoutError,
} from '../errors'
import type { CouchbaseLogger } from '../logger'
import type { ObservableRequestHandler } from '../observabilityhandler'
import {
  ErrorClass,
  errorFromMapped,
  MappedError,
  RequestErrorFields,
  RetryReason,
  statusName,
} from './errormapping'
import {
  alwaysRetries,
  BestEffortRetryStrategy,
  controlledBackoff,
  RetryRequest,
  RetryStrategy,
} from './retry'
import { attemptInterceptor, GatewayAddress } from './tracing'

/**
 * What the retry core needs to know about an operation.
 *
 * @internal
 */
export interface Couchbase2Op {
  /**
   * The operation's name, as logged with each retry.
   */
  readonly name: string

  /**
   * Whether the operation changes nothing, so that running out of time leaves
   * no doubt about its outcome. An upsert is idempotent and still not
   * read-only.
   */
  readonly readOnly: boolean

  /**
   * Whether sending the operation twice has the same effect as sending it
   * once.
   */
  readonly idempotent: boolean
}

/**
 * What a service's calls need from the connection.
 *
 * @internal
 */
export interface Couchbase2Channel {
  /**
   * The metadata every call carries.
   */
  readonly metadata: grpc.Metadata

  /**
   * A new request's context, traced under `obs` when it is given.
   */
  context(
    op: Couchbase2Op,
    timeoutMs: number,
    obs?: ObservableRequestHandler | null
  ): RequestContext
}

/**
 * What to do after a failed attempt: wait `delayMs` and retry, or raise
 * `error`.
 *
 * @internal
 */
export type FailureDecision =
  | { retry: true; delayMs: number }
  | { retry: false; error: CouchbaseError }

/**
 * The optional parts of a {@link RequestContext}.
 *
 * @internal
 */
export interface RequestContextOptions {
  /**
   * Decides retries for a reason that does not always retry.
   */
  strategy?: RetryStrategy

  /**
   * Whether the cluster has been closed since the request began.
   */
  closed?: () => boolean

  /**
   * A monotonic clock in milliseconds.
   */
  now?: () => number

  /**
   * Where each retry is logged, at debug.
   */
  logger?: CouchbaseLogger

  /**
   * The gateway's address, reported as where a dispatched request was sent.
   */
  target?: string

  /**
   * The operation's observability handler, which each attempt is traced
   * under and each retry is counted on.
   */
  obs?: ObservableRequestHandler | null

  /**
   * The gateway's address, as each attempt's span reports it.
   */
  address?: GatewayAddress
}

/**
 * One couchbase2 request's state across its attempts, and every decision
 * about retrying it. The decisions are synchronous and do no I/O; the
 * drivers in `retry.ts` and `streaming.ts` make the calls and do the
 * waiting.
 *
 * A request has one deadline, fixed when the context is made, and every
 * attempt is given what is left of it. An error is built only once the
 * request gives up, so that it carries the whole retry history.
 *
 * @internal
 */
export class RequestContext implements RetryRequest {
  readonly op: Couchbase2Op
  readonly identifier: string = randomUUID()

  /**
   * When the request times out, on the context's clock.
   */
  readonly deadline: number

  retryAttempts = 0
  readonly retryReasons: RetryReason[] = []

  /**
   * The failure the most recent retry was for, as
   * `<error>(<message>), caused by gRPC status <code>`.
   */
  lastError: string | undefined

  /**
   * Whether any attempt was handed to grpc-js, and so may have reached the
   * gateway.
   */
  dispatched = false

  private readonly _strategy: RetryStrategy
  private readonly _closed: () => boolean
  private readonly _now: () => number
  private readonly _logger: CouchbaseLogger | undefined
  private readonly _target: string
  private readonly _obs: ObservableRequestHandler | null | undefined
  private readonly _interceptor: grpc.Interceptor | undefined

  constructor(
    op: Couchbase2Op,
    timeoutMs: number,
    options: RequestContextOptions = {}
  ) {
    this.op = op
    this._strategy = options.strategy ?? new BestEffortRetryStrategy()
    this._closed = options.closed ?? (() => false)
    this._now = options.now ?? (() => performance.now())
    this._logger = options.logger
    this._target = options.target ?? ''
    this._obs = options.obs
    this._interceptor = attemptInterceptor(
      options.obs,
      options.address ?? { host: '', port: 0 }
    )
    this._obs?.recordRetries(0)
    this.deadline = this._now() + timeoutMs
  }

  /**
   * Whether the operation changes nothing; see {@link Couchbase2Op.readOnly}.
   */
  get readOnly(): boolean {
    return this.op.readOnly
  }

  /**
   * Whether the operation may be sent twice; see
   * {@link Couchbase2Op.idempotent}.
   */
  get idempotent(): boolean {
    return this.op.idempotent
  }

  /**
   * The milliseconds left before the deadline, never negative.
   */
  remaining(): number {
    return Math.max(this.deadline - this._now(), 0)
  }

  /**
   * The error to raise, without dispatching, when the next attempt cannot be
   * made; undefined when it can.
   */
  check(): CouchbaseError | undefined {
    if (this._closed()) {
      return this._canceled()
    }
    if (this.remaining() <= 0) {
      // Only a write that some attempt sent may have been applied.
      const errorClass =
        this.readOnly || !this.dispatched
          ? UnambiguousTimeoutError
          : AmbiguousTimeoutError
      return this._fail(
        errorClass,
        grpc.status.DEADLINE_EXCEEDED,
        `${this.op.name} timed out`
      )
    }
    return undefined
  }

  /**
   * The milliseconds to give the attempt about to be sent.
   */
  dispatch(): number {
    this.dispatched = true
    return this.remaining()
  }

  /**
   * The options to send the attempt about to be sent with: what is left of
   * the deadline, and the interceptor that traces the attempt.
   */
  callOptions(): grpc.CallOptions {
    const options: grpc.CallOptions = {
      deadline: new Date(Date.now() + this.dispatch()),
    }
    if (this._interceptor) {
      options.interceptors = [this._interceptor]
    }
    return options
  }

  /**
   * What to do after an attempt failed with `mapped`.
   */
  onFailure(mapped: MappedError): FailureDecision {
    const reason = mapped.retryReason
    if (reason === undefined) {
      return { retry: false, error: this._error(mapped) }
    }
    const delayMs = alwaysRetries(reason)
      ? controlledBackoff(this.retryAttempts)
      : this._strategy.retryAfter(this, reason).delayMs
    if (delayMs === undefined) {
      return { retry: false, error: this._error(mapped) }
    }

    // Recorded before the closed check, so a request canceled here still
    // says why it retried.
    this.retryAttempts++
    this._obs?.recordRetries(this.retryAttempts)
    if (!this.retryReasons.includes(reason)) {
      this.retryReasons.push(reason)
    }
    const errorName = mapped.errorClass?.name ?? CouchbaseError.name
    this.lastError =
      `${errorName}(${mapped.fields.message}), ` +
      `caused by gRPC status ${statusName(mapped.fields.status_code)}`
    this._logger?.debug(
      `Retrying ${this.op.name} request ${this.identifier} for ${reason}, attempt ${this.retryAttempts}`
    )
    if (this._closed()) {
      return { retry: false, error: this._canceled() }
    }
    // A delay past the deadline is cut to it, so the next check answers with
    // a timeout carrying this history rather than ending on the failure.
    return { retry: true, delayMs: Math.min(delayMs, this.remaining()) }
  }

  /**
   * The error to raise after a stream that had returned a message failed
   * with `mapped`. Retrying would replay what the caller has already read,
   * so a failure that would otherwise retry cancels the request instead; any
   * other is raised as it maps.
   */
  onStreamFailure(mapped: MappedError): CouchbaseError {
    if (mapped.retryReason === undefined) {
      return this._error(mapped)
    }
    const code = mapped.fields.status_code
    return this._fail(
      RequestCanceledError,
      code,
      `${this.op.name} failed with gRPC status ${statusName(code)} after ` +
        'its stream began, and a stream is not retried once it has ' +
        'returned a message'
    )
  }

  private _history(): RequestErrorFields {
    const history: RequestErrorFields = {
      last_dispatched_to: this.dispatched ? this._target : '',
      last_dispatched_from: '',
      retry_attempts: this.retryAttempts,
      retry_reasons: [...this.retryReasons],
    }
    if (this.lastError !== undefined) {
      history.last_error = this.lastError
    }
    return history
  }

  private _error(mapped: MappedError): CouchbaseError {
    return errorFromMapped(mapped, this._history())
  }

  private _canceled(): CouchbaseError {
    return this._fail(
      RequestCanceledError,
      grpc.status.CANCELLED,
      'the cluster was closed'
    )
  }

  /**
   * An error the request raises on its own account. Its status code is the
   * one grpc-js would have reported for the same outcome.
   */
  private _fail(
    errorClass: ErrorClass,
    code: grpc.status,
    message: string
  ): CouchbaseError {
    const context = new GenericErrorContext({
      message,
      status_code: code,
      ...this._history(),
    })
    return new errorClass(undefined, context)
  }
}
