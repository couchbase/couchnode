import * as grpc from '@grpc/grpc-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { GenericErrorContext } from '../../../../lib/errorcontexts'
import {
  CouchbaseError,
  InvalidArgumentError,
  RequestCanceledError,
} from '../../../../lib/errors'
import { mapStatus } from '../../../../lib/couchbase2/errormapping'
import {
  Couchbase2Op,
  RequestContext,
} from '../../../../lib/couchbase2/requestcontext'
import { loadSchema } from '../../../../lib/couchbase2/schema'
import { OpenStreams, retryStream } from '../../../../lib/couchbase2/streaming'

const QUERY: Couchbase2Op = { name: 'query', readOnly: true }

const SERVING = { status: 'SERVING' }
const NOT_SERVING = { status: 'NOT_SERVING' }

// One call's script: the messages it writes, then how it ends. 'open' leaves
// the stream open for the test to drive.
interface Step {
  messages: object[]
  end: 'ok' | 'open' | grpc.status
}

function contextOf(err: unknown): GenericErrorContext {
  expect((err as CouchbaseError).context).toBeInstanceOf(GenericErrorContext)
  return (err as CouchbaseError).context as GenericErrorContext
}

// The decision alone, on an injected failure. No server.

describe('#couchbase2 request context after a stream began', () => {
  it('should cancel a failure that would otherwise retry', () => {
    const ctx = new RequestContext(QUERY, 5000)
    const err = ctx.onStreamFailure(
      mapStatus(grpc.status.UNAVAILABLE, 'down', undefined, true)
    )
    expect(err).toBeInstanceOf(RequestCanceledError)
    const context = contextOf(err)
    expect(context.status_code).toBe(grpc.status.UNAVAILABLE)
    expect(context.message).toBe(
      'query failed with gRPC status UNAVAILABLE after its stream began, ' +
        'and a stream is not retried once it has returned a message'
    )
    expect(context.retry_attempts).toBe(0)
  })

  it('should raise any other failure as it maps', () => {
    const ctx = new RequestContext(QUERY, 5000)
    const err = ctx.onStreamFailure(
      mapStatus(grpc.status.INVALID_ARGUMENT, 'bad', undefined, true)
    )
    expect(err).toBeInstanceOf(InvalidArgumentError)
  })
})

describe('#couchbase2 streaming over a call', () => {
  let server: grpc.Server
  let target: string
  let script: Step[] = []
  let calls = 0
  let serverCall: grpc.ServerWritableStream<unknown, unknown> | undefined
  let serverCanceled: Promise<void> = Promise.resolve()

  beforeAll(async () => {
    server = new grpc.Server()
    server.addService(loadSchema().grpc.health.v1.Health.service, {
      Check: (_call: unknown, callback: grpc.sendUnaryData<unknown>) => {
        callback(null, SERVING)
      },
      Watch: (call: grpc.ServerWritableStream<unknown, unknown>) => {
        const step = script[Math.min(calls, script.length - 1)]
        calls++
        serverCall = call
        serverCanceled = new Promise((resolve) =>
          call.on('cancelled', () => resolve())
        )
        for (const message of step.messages) {
          call.write(message)
        }
        if (step.end === 'ok') {
          call.end()
        } else if (step.end !== 'open') {
          call.emit(
            'error',
            Object.assign(new Error(grpc.status[step.end]), {
              code: step.end,
              details: grpc.status[step.end],
            })
          )
        }
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

  function watch(
    steps: Step[],
    ctx: RequestContext,
    streams?: OpenStreams
  ): { messages: AsyncGenerator<unknown, void, undefined>; close: () => void } {
    script = steps
    calls = 0
    const Health = loadSchema().grpc.health.v1.Health
    const client = new Health(target, grpc.credentials.createInsecure())
    return {
      messages: retryStream(ctx, (options) => client.Watch({}, options), {
        streams,
      }),
      close: () => client.close(),
    }
  }

  async function collect(
    steps: Step[],
    ctx: RequestContext
  ): Promise<{ read: unknown[]; error: unknown }> {
    const { messages, close } = watch(steps, ctx)
    const read: unknown[] = []
    try {
      for await (const message of messages) {
        read.push(message)
      }
      return { read, error: undefined }
    } catch (error) {
      return { read, error }
    } finally {
      close()
    }
  }

  it('should yield every message, then end', async () => {
    const ctx = new RequestContext(QUERY, 5000)
    const { read, error } = await collect(
      [{ messages: [SERVING, NOT_SERVING], end: 'ok' }],
      ctx
    )
    expect(error).toBeUndefined()
    expect(read).toEqual([SERVING, NOT_SERVING])
    expect(calls).toBe(1)
  })

  it('should retry UNAVAILABLE before the first message', async () => {
    const ctx = new RequestContext(QUERY, 5000)
    const { read, error } = await collect(
      [
        { messages: [], end: grpc.status.UNAVAILABLE },
        { messages: [SERVING], end: 'ok' },
      ],
      ctx
    )
    expect(error).toBeUndefined()
    expect(read).toEqual([SERVING])
    expect(calls).toBe(2)
    expect(ctx.retryAttempts).toBe(1)
  })

  it('should latch on an empty first message and cancel a later UNAVAILABLE', async () => {
    const ctx = new RequestContext(QUERY, 5000)
    const { read, error } = await collect(
      [
        { messages: [{}], end: grpc.status.UNAVAILABLE },
        { messages: [SERVING], end: 'ok' },
      ],
      ctx
    )
    expect(error).toBeInstanceOf(RequestCanceledError)
    expect(read).toHaveLength(1)
    expect(calls).toBe(1)
    expect(contextOf(error).status_code).toBe(grpc.status.UNAVAILABLE)
  })

  it('should raise a failure after the first message as it maps', async () => {
    const ctx = new RequestContext(QUERY, 5000)
    const { read, error } = await collect(
      [{ messages: [SERVING], end: grpc.status.INVALID_ARGUMENT }],
      ctx
    )
    expect(error).toBeInstanceOf(InvalidArgumentError)
    expect(read).toEqual([SERVING])
    expect(calls).toBe(1)
  })

  it('should yield a message before the next one is written', async () => {
    const ctx = new RequestContext(QUERY, 5000)
    const { messages, close } = watch(
      [{ messages: [SERVING], end: 'open' }],
      ctx
    )
    try {
      await expect(messages.next()).resolves.toEqual({
        done: false,
        value: SERVING,
      })
      serverCall?.write(NOT_SERVING)
      serverCall?.end()
      await expect(messages.next()).resolves.toEqual({
        done: false,
        value: NOT_SERVING,
      })
      await expect(messages.next()).resolves.toEqual({
        done: true,
        value: undefined,
      })
    } finally {
      close()
    }
  })

  it('should cancel the call when the reader returns early', async () => {
    const ctx = new RequestContext(QUERY, 5000)
    const streams = new OpenStreams()
    const { messages, close } = watch(
      [{ messages: [SERVING], end: 'open' }],
      ctx,
      streams
    )
    try {
      await messages.next()
      expect(streams.size).toBe(1)
      await messages.return()
      await serverCanceled
      expect(streams.size).toBe(0)
    } finally {
      close()
    }
  })

  it('should fail an open stream canceled by its cluster', async () => {
    const ctx = new RequestContext(QUERY, 5000)
    const streams = new OpenStreams()
    const { messages, close } = watch(
      [{ messages: [SERVING], end: 'open' }],
      ctx,
      streams
    )
    try {
      await messages.next()
      streams.cancelAll()
      await expect(messages.next()).rejects.toBeInstanceOf(RequestCanceledError)
      expect(streams.size).toBe(0)
    } finally {
      close()
    }
  })
})
