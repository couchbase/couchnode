import * as grpc from '@grpc/grpc-js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { GenericErrorContext } from '../../../../lib/errorcontexts'
import {
  AmbiguousTimeoutError,
  CouchbaseError,
  DocumentNotFoundError,
  InvalidArgumentError,
  RequestCanceledError,
  ServiceNotAvailableError,
  UnambiguousTimeoutError,
} from '../../../../lib/errors'
import { CouchbaseLogger } from '../../../../lib/logger'
import {
  MappedError,
  mapStatus,
  RetryReason,
} from '../../../../lib/couchbase2/errormapping'
import {
  Couchbase2Op,
  FailureDecision,
  RequestContext,
} from '../../../../lib/couchbase2/requestcontext'
import {
  BestEffortRetryStrategy,
  controlledBackoff,
  DO_NOT_RETRY,
  retryUnary,
  RetryRequest,
  RetryStrategy,
} from '../../../../lib/couchbase2/retry'
import { loadSchema } from '../../../../lib/couchbase2/schema'
import { STATUS_DETAILS_KEY } from '../../../../lib/couchbase2/statusdetails'

const rpc = loadSchema().google.rpc

const GET: Couchbase2Op = { name: 'get', readOnly: true, idempotent: true }
const UPSERT: Couchbase2Op = {
  name: 'upsert',
  readOnly: false,
  idempotent: true,
}
const INSERT: Couchbase2Op = {
  name: 'insert',
  readOnly: false,
  idempotent: false,
}

// A reason that does not always retry, so that the strategy is asked.
const ASKED = 'asked' as RetryReason

class Clock {
  ms = 1000
  now = (): number => this.ms
}

function unavailable(): MappedError {
  return mapStatus(grpc.status.UNAVAILABLE, 'down', undefined, false)
}

function locked(): MappedError {
  return mapStatus(
    grpc.status.FAILED_PRECONDITION,
    'locked',
    {
      message: '',
      preconditionFailure: {
        violations: [{ type: 'LOCKED', subject: '', description: '' }],
      },
    },
    false
  )
}

function notFound(): MappedError {
  return mapStatus(grpc.status.NOT_FOUND, 'gone', undefined, true)
}

function asked(): MappedError {
  return { ...unavailable(), retryReason: ASKED }
}

function expectRetry(decision: FailureDecision): number {
  if (!decision.retry) {
    throw new Error(`expected a retry, got ${decision.error.message}`)
  }
  return decision.delayMs
}

function expectError(decision: FailureDecision): CouchbaseError {
  if (decision.retry) {
    throw new Error(`expected an error, got a retry after ${decision.delayMs}`)
  }
  return decision.error
}

function contextOf(err: CouchbaseError | undefined): GenericErrorContext {
  expect(err?.context).toBeInstanceOf(GenericErrorContext)
  return err?.context as GenericErrorContext
}

// The pieces of the retry core, on an injected clock. No server.

describe('#couchbase2 retry', () => {
  it('should back off 1, 10, 50, 100, 500 ms, then 1000 ms flat', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 50].map(controlledBackoff)).toEqual([
      1, 10, 50, 100, 500, 1000, 1000, 1000,
    ])
  })

  it('should retry an idempotent request with the best effort strategy', () => {
    const request: RetryRequest = {
      identifier: 'r',
      idempotent: true,
      retryAttempts: 2,
      retryReasons: [],
    }
    expect(new BestEffortRetryStrategy().retryAfter(request, ASKED)).toEqual({
      delayMs: 50,
    })
  })

  it('should not retry a write for a reason that may apply it twice', () => {
    const request: RetryRequest = {
      identifier: 'r',
      idempotent: false,
      retryAttempts: 0,
      retryReasons: [],
    }
    const strategy = new BestEffortRetryStrategy()
    expect(strategy.retryAfter(request, ASKED)).toBe(DO_NOT_RETRY)
    expect(strategy.retryAfter(request, 'service_not_available')).toEqual({
      delayMs: 1,
    })
  })
})

describe('#couchbase2 request context', () => {
  it('should fix the deadline once and count down from it', () => {
    const clock = new Clock()
    const ctx = new RequestContext(GET, 500, { now: clock.now })
    expect(ctx.deadline).toBe(1500)
    clock.ms = 1200
    expect(ctx.remaining()).toBe(300)
    clock.ms = 1600
    expect(ctx.remaining()).toBe(0)
  })

  it('should let an attempt through while there is time left', () => {
    const clock = new Clock()
    const ctx = new RequestContext(UPSERT, 500, { now: clock.now })
    expect(ctx.check()).toBeUndefined()
    expect(ctx.dispatch()).toBe(500)
    expect(ctx.dispatched).toBe(true)
  })

  it('should time out unambiguously when nothing was dispatched', () => {
    const clock = new Clock()
    const ctx = new RequestContext(UPSERT, 0, {
      now: clock.now,
      target: 'gw:18098',
    })
    const err = ctx.check()
    expect(err).toBeInstanceOf(UnambiguousTimeoutError)
    expect(contextOf(err)).toMatchObject({
      message: 'upsert timed out',
      status_code: grpc.status.DEADLINE_EXCEEDED,
      last_dispatched_to: '',
      retry_attempts: 0,
    })
  })

  it('should time out ambiguously only for a dispatched write', () => {
    for (const [op, expected] of [
      [UPSERT, AmbiguousTimeoutError],
      [GET, UnambiguousTimeoutError],
    ] as const) {
      const clock = new Clock()
      const ctx = new RequestContext(op, 100, {
        now: clock.now,
        target: 'gw:18098',
      })
      ctx.dispatch()
      clock.ms += 100
      const err = ctx.check()
      expect(err).toBeInstanceOf(expected)
      expect(contextOf(err).last_dispatched_to).toBe('gw:18098')
    }
  })

  it('should raise a failure that does not retry, with no last error', () => {
    const ctx = new RequestContext(GET, 500, { now: new Clock().now })
    ctx.dispatch()
    const err = expectError(ctx.onFailure(notFound()))
    expect(err).toBeInstanceOf(DocumentNotFoundError)
    expect(err.cause).toBeUndefined()
    const context = contextOf(err)
    expect(context.retry_attempts).toBe(0)
    expect(context.last_error).toBeUndefined()
  })

  it('should retry UNAVAILABLE and LOCKED with controlled backoff', () => {
    const ctx = new RequestContext(INSERT, 5000, { now: new Clock().now })
    const delays = [
      unavailable(),
      locked(),
      unavailable(),
      unavailable(),
      locked(),
      unavailable(),
    ].map((m) => expectRetry(ctx.onFailure(m)))
    expect(delays).toEqual([1, 10, 50, 100, 500, 1000])
    expect(ctx.retryAttempts).toBe(6)
    expect(ctx.retryReasons).toEqual([
      'service_not_available',
      'key_value_locked',
    ])
  })

  it('should keep the previous retried failure as the last error', () => {
    const ctx = new RequestContext(UPSERT, 5000, { now: new Clock().now })
    expectRetry(ctx.onFailure(locked()))
    expect(ctx.lastError).toBe(
      'DocumentLockedError(locked), caused by gRPC status FAILED_PRECONDITION'
    )
    expectRetry(ctx.onFailure(unavailable()))
    const err = expectError(
      ctx.onFailure(
        mapStatus(grpc.status.INVALID_ARGUMENT, 'bad', undefined, false)
      )
    )
    expect(err).toBeInstanceOf(InvalidArgumentError)
    expect(contextOf(err)).toMatchObject({
      message: 'bad',
      retry_attempts: 2,
      retry_reasons: ['key_value_locked', 'service_not_available'],
      last_error:
        'ServiceNotAvailableError(down), caused by gRPC status UNAVAILABLE',
    })
  })

  it('should cut a backoff past the deadline to the deadline', () => {
    const clock = new Clock()
    const ctx = new RequestContext(UPSERT, 1000, { now: clock.now })
    for (let i = 0; i < 5; i++) {
      expectRetry(ctx.onFailure(unavailable()))
    }
    clock.ms += 700
    expect(expectRetry(ctx.onFailure(unavailable()))).toBe(300)
    clock.ms += 300
    const err = ctx.check()
    expect(err).toBeInstanceOf(UnambiguousTimeoutError)
    expect(contextOf(err)).toMatchObject({
      retry_attempts: 6,
      retry_reasons: ['service_not_available'],
    })
  })

  it('should cancel a request closed during a retry, keeping its history', () => {
    let closed = false
    const ctx = new RequestContext(GET, 5000, {
      now: new Clock().now,
      closed: () => closed,
    })
    expectRetry(ctx.onFailure(unavailable()))
    closed = true
    const err = expectError(ctx.onFailure(locked()))
    expect(err).toBeInstanceOf(RequestCanceledError)
    expect(contextOf(err)).toMatchObject({
      status_code: grpc.status.CANCELLED,
      retry_attempts: 2,
      retry_reasons: ['service_not_available', 'key_value_locked'],
    })
    expect(ctx.check()).toBeInstanceOf(RequestCanceledError)
  })

  it('should ask the strategy only for a reason that does not always retry', () => {
    const retryAfter = vi.fn<RetryStrategy['retryAfter']>(() => ({
      delayMs: 7,
    }))
    const ctx = new RequestContext(GET, 5000, {
      now: new Clock().now,
      strategy: { retryAfter },
    })
    expect(expectRetry(ctx.onFailure(unavailable()))).toBe(1)
    expect(retryAfter).not.toHaveBeenCalled()
    expect(expectRetry(ctx.onFailure(asked()))).toBe(7)
    expect(retryAfter).toHaveBeenCalledWith(ctx, ASKED)

    retryAfter.mockReturnValue(DO_NOT_RETRY)
    const err = expectError(ctx.onFailure(asked()))
    expect(err).toBeInstanceOf(ServiceNotAvailableError)
    expect(contextOf(err).retry_attempts).toBe(2)
  })

  it('should log each retry at debug', () => {
    const debug = vi.fn()
    const ctx = new RequestContext(GET, 5000, {
      now: new Clock().now,
      logger: new CouchbaseLogger({ debug }),
    })
    expectRetry(ctx.onFailure(unavailable()))
    expectRetry(ctx.onFailure(locked()))
    expect(debug.mock.calls.map((c) => c[0])).toEqual([
      `Retrying get request ${ctx.identifier} for service_not_available, ` +
        'attempt 1, after gRPC status UNAVAILABLE (down)',
      `Retrying get request ${ctx.identifier} for key_value_locked, ` +
        'attempt 2, after gRPC status FAILED_PRECONDITION (locked)',
    ])
  })

  it("should log the gateway's request id with a retry", () => {
    const debug = vi.fn()
    const ctx = new RequestContext(GET, 5000, {
      now: new Clock().now,
      logger: new CouchbaseLogger({ debug }),
    })
    const mapped = unavailable()
    mapped.fields.request_info = { request_id: 'req-7', serving_data: '' }
    expectRetry(ctx.onFailure(mapped))
    expect(debug.mock.calls[0][0]).toBe(
      `Retrying get request ${ctx.identifier} for service_not_available, ` +
        'attempt 1, after gRPC status UNAVAILABLE (down), gateway request ' +
        'id req-7'
    )
  })

  it('should report each unrecognized value, retried or raised', () => {
    const unrecognized = vi.fn()
    const ctx = new RequestContext(GET, 5000, {
      now: new Clock().now,
      unrecognized,
    })
    expectRetry(ctx.onFailure({ ...unavailable(), unrecognized: 'first' }))
    expectError(ctx.onFailure({ ...notFound(), unrecognized: 'second' }))
    ctx.onStreamFailure({ ...notFound(), unrecognized: 'third' })
    expectError(ctx.onFailure(notFound()))
    expect(unrecognized.mock.calls).toEqual([['first'], ['second'], ['third']])
  })
})

// The driver against an in-process grpc-js server that answers each Check
// with the next scripted outcome.

type Outcome = { code: grpc.status; violation?: string } | 'ok'

describe('#couchbase2 retry over a call', () => {
  let server: grpc.Server
  let target: string
  let script: Outcome[] = []
  let calls = 0
  // Each run tags its calls, so that an attempt a client abandoned at its
  // deadline cannot reach the server during a later test and be counted.
  let runId = 0

  function answer(outcome: Outcome): grpc.ServiceError | null {
    if (outcome === 'ok') {
      return null
    }
    const metadata = new grpc.Metadata()
    if (outcome.violation) {
      metadata.set(
        STATUS_DETAILS_KEY,
        rpc.Status.serialize({
          code: outcome.code,
          message: outcome.violation,
          details: [
            {
              type_url: 'type.googleapis.com/google.rpc.PreconditionFailure',
              value: rpc.PreconditionFailure.serialize({
                violations: [{ type: outcome.violation }],
              }),
            },
          ],
        })
      )
    }
    return Object.assign(new Error(grpc.status[outcome.code]), {
      code: outcome.code,
      details: grpc.status[outcome.code],
      metadata,
    })
  }

  beforeAll(async () => {
    server = new grpc.Server()
    server.addService(loadSchema().grpc.health.v1.Health.service, {
      Check: (
        call: grpc.ServerUnaryCall<unknown, unknown>,
        callback: grpc.sendUnaryData<unknown>
      ) => {
        if (call.metadata.get('run')[0] !== String(runId)) {
          callback(
            Object.assign(new Error('stale'), { code: grpc.status.ABORTED })
          )
          return
        }
        const outcome = script[Math.min(calls, script.length - 1)]
        calls++
        const err = answer(outcome)
        callback(err, err ? undefined : { status: 'SERVING' })
      },
    })
    const port = await new Promise<number>((resolve, reject) =>
      server.bindAsync(
        '127.0.0.1:0',
        grpc.ServerCredentials.createInsecure(),
        (err, p) => (err ? reject(err) : resolve(p))
      )
    )
    target = `127.0.0.1:${port}`
  })

  afterAll(() => {
    server.forceShutdown()
  })

  async function run(
    outcomes: Outcome[],
    ctx: RequestContext
  ): Promise<unknown> {
    script = outcomes
    calls = 0
    runId++
    const metadata = new grpc.Metadata()
    metadata.set('run', String(runId))
    const Health = loadSchema().grpc.health.v1.Health
    const client = new Health(target, grpc.credentials.createInsecure())
    try {
      return await retryUnary(
        ctx,
        (options) =>
          new Promise((resolve, reject) =>
            client.Check({}, metadata, options, (err, res) =>
              err ? reject(err) : resolve(res)
            )
          )
      )
    } finally {
      client.close()
    }
  }

  it('should succeed after UNAVAILABLE twice', async () => {
    const ctx = new RequestContext(GET, 5000)
    const unavailableTwice: Outcome[] = [
      { code: grpc.status.UNAVAILABLE },
      { code: grpc.status.UNAVAILABLE },
      'ok',
    ]
    await expect(run(unavailableTwice, ctx)).resolves.toEqual({
      status: 'SERVING',
    })
    expect(calls).toBe(3)
    expect(ctx.retryAttempts).toBe(2)
  })

  it('should time out ambiguously on a write LOCKED until its deadline', async () => {
    const ctx = new RequestContext(UPSERT, 150)
    const err = await run(
      [{ code: grpc.status.FAILED_PRECONDITION, violation: 'LOCKED' }],
      ctx
    ).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AmbiguousTimeoutError)
    const context = contextOf(err as CouchbaseError)
    expect(context.retry_attempts).toBeGreaterThanOrEqual(2)
    expect(context.retry_reasons).toEqual(['key_value_locked'])
    expect(context.last_error).toBe(
      'DocumentLockedError(LOCKED), caused by gRPC status FAILED_PRECONDITION'
    )
  })

  it('should not retry NOT_FOUND without details', async () => {
    const ctx = new RequestContext(GET, 5000)
    const err = await run([{ code: grpc.status.NOT_FOUND }], ctx).catch(
      (e: unknown) => e
    )
    expect(err).toBeInstanceOf(DocumentNotFoundError)
    expect(calls).toBe(1)
    expect(contextOf(err as CouchbaseError).retry_attempts).toBe(0)
  })
})
