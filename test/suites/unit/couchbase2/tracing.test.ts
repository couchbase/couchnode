import * as grpc from '@grpc/grpc-js'
import {
  propagation,
  Span as OTelSpan,
  trace,
  TraceFlags,
  Tracer as OTelTracer,
} from '@opentelemetry/api'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { HealthClient } from '../../../../lib/couchbase2/generated/grpc/health/v1/Health'
import {
  Couchbase2Op,
  RequestContext,
} from '../../../../lib/couchbase2/requestcontext'
import { retryUnary } from '../../../../lib/couchbase2/retry'
import { loadSchema } from '../../../../lib/couchbase2/schema'
import { retryStream } from '../../../../lib/couchbase2/streaming'
import { rpcName } from '../../../../lib/couchbase2/tracing'
import { NoOpMeter } from '../../../../lib/observability'
import { ObservableRequestHandler } from '../../../../lib/observabilityhandler'
import {
  AttributeValue,
  DispatchAttributeName,
  KeyValueOp,
  ObservabilityInstruments,
  OpAttributeName,
  SpanStatus,
  SpanStatusCode,
} from '../../../../lib/observabilitytypes'
import { OTelWrapperTracer } from '../../../../lib/oteltracer'
import { RequestSpan, RequestTracer } from '../../../../lib/tracing'

const GET: Couchbase2Op = { name: 'get', readOnly: true }
const CHECK = 'grpc.health.v1.Health/Check'
const WATCH = 'grpc.health.v1.Health/Watch'

class RecordedSpan implements RequestSpan {
  readonly attributes: { [key: string]: AttributeValue } = {}
  status: SpanStatus = { code: SpanStatusCode.UNSET }
  ended = false

  constructor(
    readonly name: string,
    readonly parent: RequestSpan | undefined,
    private readonly _recording: boolean
  ) {}

  setAttribute(key: string, value: AttributeValue): void {
    this.attributes[key] = value
  }

  addEvent(): void {}

  setStatus(status: SpanStatus): void {
    this.status = status
  }

  end(): void {
    this.ended = true
  }

  isRecording(): boolean {
    return this._recording
  }
}

class RecordingTracer implements RequestTracer {
  readonly spans: RecordedSpan[] = []

  constructor(private readonly _recording = true) {}

  requestSpan(name: string, parentSpan?: RequestSpan): RequestSpan {
    const span = new RecordedSpan(name, parentSpan, this._recording)
    this.spans.push(span)
    return span
  }
}

function handler(tracer: RequestTracer): ObservableRequestHandler {
  return new ObservableRequestHandler(
    KeyValueOp.Get,
    new ObservabilityInstruments(tracer, new NoOpMeter())
  )
}

describe('#couchbase2 rpc names', () => {
  it('should name an RPC by its path without the leading slash', () => {
    expect(rpcName('/couchbase.kv.v1.KvService/Get')).toBe(
      'couchbase.kv.v1.KvService/Get'
    )
    expect(rpcName('couchbase.kv.v1.KvService/Get')).toBe(
      'couchbase.kv.v1.KvService/Get'
    )
  })
})

// The drivers against an in-process grpc-js server whose Check answers with
// the next scripted code and whose Watch sends one message, then ends or
// holds the stream open.

describe('#couchbase2 tracing over a call', () => {
  let server: grpc.Server
  let port: number
  let client: HealthClient
  let script: grpc.status[] = []
  let calls = 0
  let holdWatch = false
  let traceparents: string[] = []

  beforeAll(async () => {
    const Health = loadSchema().grpc.health.v1.Health
    server = new grpc.Server()
    server.addService(Health.service, {
      Check: (
        call: grpc.ServerUnaryCall<unknown, unknown>,
        callback: grpc.sendUnaryData<unknown>
      ) => {
        traceparents.push(String(call.metadata.get('traceparent')[0] ?? ''))
        const code = script[Math.min(calls, script.length - 1)]
        calls++
        if (code === grpc.status.OK) {
          callback(null, { status: 'SERVING' })
        } else {
          callback(
            Object.assign(new Error(grpc.status[code]), {
              code,
              details: grpc.status[code],
            })
          )
        }
      },
      Watch: (call: grpc.ServerWritableStream<unknown, unknown>) => {
        call.write({ status: 'SERVING' })
        if (!holdWatch) {
          call.end()
        }
      },
    })
    port = await new Promise<number>((resolve, reject) =>
      server.bindAsync(
        '127.0.0.1:0',
        grpc.ServerCredentials.createInsecure(),
        (err, p) => (err ? reject(err) : resolve(p))
      )
    )
    client = new Health(`127.0.0.1:${port}`, grpc.credentials.createInsecure())
  })

  afterAll(() => {
    client.close()
    server.forceShutdown()
  })

  function context(obs: ObservableRequestHandler): RequestContext {
    return new RequestContext(GET, 5000, {
      obs,
      address: { host: '127.0.0.1', port },
    })
  }

  async function check(
    codes: grpc.status[],
    ctx: RequestContext,
    metadata = new grpc.Metadata()
  ): Promise<unknown> {
    script = codes
    calls = 0
    traceparents = []
    return retryUnary(
      ctx,
      (options) =>
        new Promise((resolve, reject) =>
          client.Check({}, metadata, options, (err, res) =>
            err ? reject(err) : resolve(res)
          )
        )
    )
  }

  it('should trace each attempt under the operation, named for its RPC', async () => {
    const tracer = new RecordingTracer()
    const obs = handler(tracer)
    await check([grpc.status.UNAVAILABLE, grpc.status.OK], context(obs))
    obs.end()

    const [op, ...attempts] = tracer.spans
    expect(op.name).toBe(KeyValueOp.Get)
    expect(attempts.map((s) => s.name)).toEqual([CHECK, CHECK])
    for (const attempt of attempts) {
      expect(attempt.parent).toBe(op)
      expect(attempt.ended).toBe(true)
      expect(attempt.attributes).toEqual({
        [OpAttributeName.SystemName]: 'couchbase',
        [DispatchAttributeName.ServerAddress]: '127.0.0.1',
        [DispatchAttributeName.ServerPort]: port,
      })
    }
    expect(attempts.map((s) => s.status.code)).toEqual([
      SpanStatusCode.ERROR,
      SpanStatusCode.UNSET,
    ])
    expect(op.attributes[OpAttributeName.RetryCount]).toBe(1)
  })

  it('should count no retries on a request that succeeds at once', async () => {
    const tracer = new RecordingTracer()
    const obs = handler(tracer)
    await check([grpc.status.OK], context(obs))
    obs.end()

    expect(tracer.spans).toHaveLength(2)
    expect(tracer.spans[0].attributes[OpAttributeName.RetryCount]).toBe(0)
  })

  it('should count the retries of a request that fails', async () => {
    const tracer = new RecordingTracer()
    const obs = handler(tracer)
    const err = await check(
      [grpc.status.UNAVAILABLE, grpc.status.UNAVAILABLE, grpc.status.NOT_FOUND],
      context(obs)
    ).catch((e: unknown) => e)
    obs.endWithError(err)

    const [op, ...attempts] = tracer.spans
    expect(attempts).toHaveLength(3)
    expect(attempts.every((s) => s.status.code === SpanStatusCode.ERROR)).toBe(
      true
    )
    expect(op.status.code).toBe(SpanStatusCode.ERROR)
    expect(op.attributes[OpAttributeName.RetryCount]).toBe(2)
  })

  it('should trace nothing and send no trace context when the span is not recording', async () => {
    const tracer = new RecordingTracer(false)
    const obs = handler(tracer)
    const ctx = context(obs)
    expect(ctx.callOptions().interceptors).toBeUndefined()
    await check([grpc.status.OK], ctx)
    obs.end()

    expect(tracer.spans).toHaveLength(1)
    expect(traceparents).toEqual([''])
  })

  it('should send no trace context from a span that is not OpenTelemetry', async () => {
    const obs = handler(new RecordingTracer())
    await check([grpc.status.OK], context(obs))
    obs.end()

    expect(traceparents).toEqual([''])
  })

  it('should end a stream attempt when the stream ends', async () => {
    const tracer = new RecordingTracer()
    const obs = handler(tracer)
    holdWatch = false
    const read: unknown[] = []
    for await (const message of retryStream(context(obs), (options) =>
      client.Watch({}, options)
    )) {
      read.push(message)
    }
    obs.end()

    expect(read).toHaveLength(1)
    const [, attempt] = tracer.spans
    expect(attempt.name).toBe(WATCH)
    expect(attempt.ended).toBe(true)
    expect(attempt.status.code).toBe(SpanStatusCode.UNSET)
  })

  it('should not fail a stream attempt the SDK canceled', async () => {
    const tracer = new RecordingTracer()
    const obs = handler(tracer)
    holdWatch = true
    const messages = retryStream(context(obs), (options) =>
      client.Watch({}, options)
    )
    await messages.next()
    await messages.return()
    // The canceled status reaches the interceptor on a later tick.
    await new Promise((resolve) => setTimeout(resolve, 50))
    obs.end()

    const [, attempt] = tracer.spans
    expect(attempt.ended).toBe(true)
    expect(attempt.status.code).toBe(SpanStatusCode.UNSET)
  })

  describe('under OpenTelemetry', () => {
    const TRACE_ID = '0af7651916cd43dd8448eb211c80319c'
    let nextSpanId = 0

    function otelSpan(): OTelSpan {
      const spanId = (++nextSpanId).toString(16).padStart(16, '0')
      const span = {
        spanContext: () => ({
          traceId: TRACE_ID,
          spanId,
          traceFlags: TraceFlags.SAMPLED,
        }),
        setAttribute: () => span,
        setStatus: () => span,
        addEvent: () => span,
        end: () => undefined,
        isRecording: () => true,
      }
      return span as unknown as OTelSpan
    }

    const otelTracer = {
      startSpan: () => otelSpan(),
    } as unknown as OTelTracer

    beforeAll(() => {
      propagation.setGlobalPropagator({
        inject(context, carrier, setter) {
          const sc = trace.getSpanContext(context)
          if (sc) {
            setter.set(
              carrier,
              'traceparent',
              `00-${sc.traceId}-${sc.spanId}-01`
            )
          }
        },
        extract: (context) => context,
        fields: () => ['traceparent'],
      })
    })

    afterAll(() => {
      propagation.disable()
    })

    it("should send each attempt's own trace context", async () => {
      nextSpanId = 0
      const obs = handler(new OTelWrapperTracer(otelTracer))
      const metadata = new grpc.Metadata()
      await check(
        [grpc.status.UNAVAILABLE, grpc.status.OK],
        context(obs),
        metadata
      )
      obs.end()

      // The operation's span is the first; each attempt's follows.
      expect(traceparents).toEqual([
        `00-${TRACE_ID}-0000000000000002-01`,
        `00-${TRACE_ID}-0000000000000003-01`,
      ])
      // The trace context goes on a copy, never on the shared metadata.
      expect(metadata.get('traceparent')).toEqual([])
    })
  })
})
