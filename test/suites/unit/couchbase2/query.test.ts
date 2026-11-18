import * as grpc from '@grpc/grpc-js'
import { getEventListeners } from 'events'
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest'

import { Couchbase2MutationToken } from '../../../../lib/couchbase2/kv'
import {
  Couchbase2Query,
  queryMetaDataFromProto,
  queryOp,
  queryRequestToProto,
} from '../../../../lib/couchbase2/query'
import {
  Couchbase2Op,
  RequestContext,
} from '../../../../lib/couchbase2/requestcontext'
import { loadSchema } from '../../../../lib/couchbase2/schema'
import { OpenStreams } from '../../../../lib/couchbase2/streaming'
import {
  InvalidArgumentError,
  RequestCanceledError,
} from '../../../../lib/errors'
import { MutationState } from '../../../../lib/mutationstate'
import type { ObservableRequestHandler } from '../../../../lib/observabilityhandler'
import {
  QueryProfileMode,
  QueryScanConsistency,
  QueryStatus,
} from '../../../../lib/querytypes'

// A query's request and metadata, mapped without a gateway.

const json = (value: unknown) => Buffer.from(JSON.stringify(value))

describe('#couchbase2 query request', () => {
  it('should send the statement with metrics off and a context id', () => {
    const message = queryRequestToProto('SELECT 1', {})
    expect(message.statement).toBe('SELECT 1')
    expect(message.tuning_options).toEqual({ disable_metrics: true })
    expect(message.client_context_id).toMatch(/^[0-9a-f-]{36}$/)
    expect(message.bucket_name).toBeUndefined()
    expect(message.prepared).toBeUndefined()
  })

  it('should run in the scope it was sent from, or its query context', () => {
    expect(
      queryRequestToProto('SELECT 1', {}, { bucketName: 'b', scopeName: 's' })
    ).toMatchObject({ bucket_name: 'b', scope_name: 's' })
    expect(
      queryRequestToProto('SELECT 1', { queryContext: 'default:`b`.`s`' })
    ).toMatchObject({ bucket_name: 'b', scope_name: 's' })
    expect(
      queryRequestToProto('SELECT 1', { queryContext: '`b`' }).bucket_name
    ).toBeUndefined()
  })

  it.each([
    ['bare', 'b.s', 'b', 's'],
    ['bare with a namespace', 'default:b.s', 'b', 's'],
    ['bare, at the last dot', 'travel.sample.s', 'travel.sample', 's'],
    ['partly backticked', '`travel.sample`.s', 'travel.sample', 's'],
  ])(
    'should read a %s query context',
    (_name, queryContext, bucketName, scopeName) => {
      expect(queryRequestToProto('SELECT 1', { queryContext })).toMatchObject({
        bucket_name: bucketName,
        scope_name: scopeName,
      })
    }
  )

  it('should send the options it has a field for', () => {
    const message = queryRequestToProto('SELECT 1', {
      clientContextId: 'ctx',
      readOnly: true,
      flexIndex: true,
      preserveExpiry: false,
      adhoc: false,
      metrics: true,
      maxParallelism: 4,
      pipelineBatch: 8,
      pipelineCap: 16,
      scanCap: 32,
      scanWait: 1500,
      profile: QueryProfileMode.Timings,
      scanConsistency: QueryScanConsistency.RequestPlus,
    })
    expect(message).toMatchObject({
      client_context_id: 'ctx',
      read_only: true,
      flex_index: true,
      preserve_expiry: false,
      prepared: true,
      profile_mode: 'PROFILE_MODE_TIMINGS',
      scan_consistency: 'SCAN_CONSISTENCY_REQUEST_PLUS',
      tuning_options: {
        disable_metrics: false,
        max_parallelism: 4,
        pipeline_batch: 8,
        pipeline_cap: 16,
        scan_cap: 32,
        scan_wait: { seconds: 1, nanos: 500000000 },
      },
    })
  })

  it('should encode parameters as JSON, naming each without its $', () => {
    expect(
      queryRequestToProto('SELECT $1', {
        parameters: [1, 'a', null, undefined],
      }).positional_parameters
    ).toEqual([json(1), json('a'), json(null), json(null)])
    expect(
      queryRequestToProto('SELECT $a', {
        parameters: { a: { b: 1 }, $c: 2, d: undefined },
      }).named_parameters
    ).toEqual({ a: json({ b: 1 }), c: json(2) })
  })

  it('should send a mutation state in place of the scan consistency', () => {
    const state = new MutationState(
      new Couchbase2MutationToken({
        bucket_name: 'b',
        vbucket_id: 7,
        vbucket_uuid: '5',
        seq_no: '11',
      })
    )
    const message = queryRequestToProto('SELECT 1', {
      consistentWith: state,
      scanConsistency: QueryScanConsistency.RequestPlus,
    })
    expect(message.consistent_with).toEqual([
      { bucket_name: 'b', vbucket_id: 7, vbucket_uuid: '5', seq_no: '11' },
    ])
    expect(message.scan_consistency).toBeUndefined()
  })

  it.each([
    { maxParallelism: -1 },
    { scanCap: 1.5 },
    { scanWait: -1 },
    { profile: 'sometimes' as QueryProfileMode },
  ])('should refuse %j', (options) => {
    expect(() => queryRequestToProto('SELECT 1', options)).toThrow(
      InvalidArgumentError
    )
  })

  it.each([
    [{ raw: { x: 1 } }, 'raw'],
    [{ useReplica: true }, 'useReplica'],
  ])('should warn that %j is not sent', (options, name) => {
    const warn = vi
      .spyOn(process, 'emitWarning')
      .mockImplementation(() => undefined)
    onTestFinished(() => warn.mockRestore())
    expect(
      queryRequestToProto('SELECT 1', { ...options, clientContextId: 'c' })
    ).toEqual(queryRequestToProto('SELECT 1', { clientContextId: 'c' }))
    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0][0])).toContain(name)
  })

  it('should leave doubt about a query only when it may change something', () => {
    expect(queryOp({ readOnly: true })).toEqual({
      name: 'query',
      readOnly: true,
    })
    expect(queryOp({}).readOnly).toBe(false)
  })
})

describe('#couchbase2 query metadata', () => {
  it('should read the metadata of the last message', () => {
    const meta = queryMetaDataFromProto({
      request_id: 'r',
      client_context_id: 'c',
      status: 'STATUS_SUCCESS',
      warnings: [{ code: 1, message: 'w' }],
      signature: json({ one: 'number' }),
      profile: json({ phaseTimes: {} }),
      metrics: {
        elapsed_time: { seconds: '2', nanos: 345678901 },
        execution_time: { seconds: '0', nanos: 1999999 },
        result_count: '3',
        result_size: '30',
        mutation_count: '0',
        sort_count: '1',
        error_count: '0',
        warning_count: '1',
      },
    })
    expect(meta.requestId).toBe('r')
    expect(meta.clientContextId).toBe('c')
    expect(meta.status).toBe(QueryStatus.Success)
    expect(meta.signature).toEqual({ one: 'number' })
    expect(meta.profile).toEqual({ phaseTimes: {} })
    expect(meta.warnings.map((w) => [w.code, w.message])).toEqual([[1, 'w']])
    expect(meta.metrics).toMatchObject({
      elapsedTime: 2345,
      executionTime: 1,
      resultCount: 3,
      resultSize: 30,
      sortCount: 1,
      warningCount: 1,
    })
  })

  it('should read an empty signature, no profile and no metrics as unset', () => {
    const meta = queryMetaDataFromProto({
      request_id: 'r',
      client_context_id: 'c',
      status: 'STATUS_RUNNING',
      warnings: [],
      signature: Buffer.alloc(0),
      metrics: null,
    })
    expect(meta.status).toBe(QueryStatus.Running)
    expect(meta.signature).toBeUndefined()
    expect(meta.profile).toBeUndefined()
    expect(meta.metrics).toBeUndefined()
  })

  it('should read a status it cannot name as unknown', () => {
    const meta = queryMetaDataFromProto({
      request_id: 'r',
      client_context_id: 'c',
      status: 42 as unknown as 'STATUS_SUCCESS',
      warnings: [],
      signature: Buffer.alloc(0),
    })
    expect(meta.status).toBe(QueryStatus.Unknown)
  })
})

// One query's answer: the messages the server writes, then how it ends.
// A held call stays open until the client cancels it.
interface Answer {
  messages: object[]
  end: 'ok' | 'hold' | grpc.status
}

/**
 * A handler that records how the request ended.
 */
function endingHandler(): ObservableRequestHandler {
  return {
    end: vi.fn(),
    endWithError: vi.fn(),
  } as unknown as ObservableRequestHandler
}

describe('#couchbase2 query rows over a call', () => {
  let server: grpc.Server
  let answer: Answer = { messages: [], end: 'ok' }
  let query: Couchbase2Query
  let streams: OpenStreams
  let close: () => void
  // Every call the server has received, in order.
  const received: grpc.ServerWritableStream<unknown, unknown>[] = []

  beforeAll(async () => {
    const schema = loadSchema()
    server = new grpc.Server()
    server.addService(schema.couchbase.query.v1.QueryService.service, {
      Query: (call: grpc.ServerWritableStream<unknown, unknown>) => {
        received.push(call)
        for (const message of answer.messages) {
          call.write(message)
        }
        if (answer.end === 'ok') {
          call.end()
        } else if (answer.end !== 'hold') {
          call.emit(
            'error',
            Object.assign(new Error(grpc.status[answer.end]), {
              code: answer.end,
              details: 'syntax error',
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
    const client = new schema.couchbase.query.v1.QueryService(
      `127.0.0.1:${port}`,
      grpc.credentials.createInsecure()
    )
    close = () => client.close()
    streams = new OpenStreams()
    query = new Couchbase2Query(
      {
        metadata: new grpc.Metadata(),
        streams,
        queryTimeout: 5000,
        context: (op: Couchbase2Op, timeoutMs: number) =>
          new RequestContext(op, timeoutMs),
      },
      client
    )
  })

  afterAll(() => {
    close()
    server.forceShutdown()
  })

  const META = {
    request_id: 'r',
    client_context_id: 'c',
    status: 'STATUS_SUCCESS',
    signature: json({ '*': '*' }),
  }

  it('should emit every row of every message, then the last metadata', async () => {
    answer = {
      messages: [
        { rows: [json({ n: 1 }), json({ n: 2 })] },
        { rows: [] },
        { rows: [json({ n: 3 })], meta_data: META },
      ],
      end: 'ok',
    }
    const events: unknown[] = []
    await new Promise<void>((resolve) => {
      query
        .query('SELECT n', {})
        .on('row', (row) => events.push(row))
        .on('meta', (meta) => events.push(meta.requestId))
        .on('error', (err) => events.push(err))
        .on('end', () => resolve())
    })
    expect(events).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }, 'r'])
  })

  it('should collect the rows when awaited', async () => {
    answer = { messages: [{ rows: [json(1)], meta_data: META }], end: 'ok' }
    const result = await query.query('SELECT RAW 1', {})
    expect(result.rows).toEqual([1])
    expect(result.meta.status).toBe('success')
  })

  it('should end with no metadata when the stream sends none', async () => {
    answer = { messages: [{ rows: [json(1)] }], end: 'ok' }
    const result = await query.query('SELECT RAW 1', {})
    expect(result.rows).toEqual([1])
    expect(result.meta).toBeUndefined()
  })

  it('should fail with the call status the gateway reports', async () => {
    answer = { messages: [], end: grpc.status.INVALID_ARGUMENT }
    const err = await query.query('SELEC 1', {}).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(InvalidArgumentError)
  })

  it('should fail a request it cannot build on a later tick', async () => {
    const emitter = query.query('SELECT 1', { maxParallelism: -1 })
    await expect(emitter).rejects.toBeInstanceOf(InvalidArgumentError)
  })

  it('should end its span when the stream ends', async () => {
    answer = { messages: [{ rows: [json(1)], meta_data: META }], end: 'ok' }
    const obs = endingHandler()
    await query.query('SELECT RAW 1', {}, undefined, obs)
    expect(obs.end).toHaveBeenCalledTimes(1)
    expect(obs.endWithError).not.toHaveBeenCalled()
  })

  it('should end its span with the failure that ended the stream', async () => {
    answer = { messages: [], end: grpc.status.INVALID_ARGUMENT }
    const obs = endingHandler()
    const err = await query
      .query('SELEC 1', {}, undefined, obs)
      .catch((e: unknown) => e)
    expect(obs.endWithError).toHaveBeenCalledWith(err)
    expect(obs.end).not.toHaveBeenCalled()
  })

  it('should end its span when the request cannot be built', async () => {
    const obs = endingHandler()
    const err = await query
      .query('SELECT 1', { maxParallelism: -1 }, undefined, obs)
      .catch((e: unknown) => e)
    expect(obs.endWithError).toHaveBeenCalledWith(err)
  })

  describe('#abort', () => {
    type QueryEvent = 'row' | 'end' | Error

    function collect(
      q: ReturnType<Couchbase2Query['query']>,
      onRow?: () => void
    ): QueryEvent[] {
      const events: QueryEvent[] = []
      q.on('row', () => {
        events.push('row')
        onRow?.()
      })
      q.on('error', (err: Error) => events.push(err))
      q.on('end', () => events.push('end'))
      return events
    }

    function expectAbortError(err: unknown, reason: unknown): void {
      expect(err).toBeInstanceOf(RequestCanceledError)
      expect((err as RequestCanceledError).cause).toBe(reason)
    }

    /** Waits for the server to see its latest call cancelled. */
    async function expectCallCancelled(): Promise<void> {
      await vi.waitFor(() => {
        expect(received.at(-1)?.cancelled, 'call cancelled').toBe(true)
        expect(streams.size, 'open streams').toBe(0)
      })
    }

    it('should fail without sending a query when the signal has already aborted', async () => {
      const before = received.length
      const reason = new Error('stop')
      const obs = endingHandler()
      const err = await query
        .query(
          'SELECT 1',
          { signal: AbortSignal.abort(reason) },
          undefined,
          obs
        )
        .catch((e: unknown) => e)

      expectAbortError(err, reason)
      expect(obs.endWithError).toHaveBeenCalledWith(err)
      expect(received.length).toBe(before)
    })

    it('should end the query and cancel the call when aborted before any rows', async () => {
      answer = { messages: [], end: 'hold' }
      const before = received.length
      const controller = new AbortController()
      const reason = new Error('stop')
      const obs = endingHandler()
      const events = collect(
        query.query('SELECT 1', { signal: controller.signal }, undefined, obs)
      )
      await vi.waitFor(() => expect(received.length).toBe(before + 1))

      controller.abort(reason)
      expect(events).toHaveLength(2)
      expectAbortError(events[0], reason)
      expect(events[1]).toBe('end')
      expect(obs.endWithError).toHaveBeenCalledTimes(1)
      expect(obs.end).not.toHaveBeenCalled()

      await expectCallCancelled()
      expect(received.length, 'retried after the abort').toBe(before + 1)
      expect(events).toHaveLength(2)
    })

    it('should end the query and cancel the call when aborted between rows', async () => {
      answer = { messages: [{ rows: [json(1)] }], end: 'hold' }
      const controller = new AbortController()
      const reason = new Error('stop')
      let rowSeen: () => void
      const firstRow = new Promise<void>((resolve) => (rowSeen = resolve))
      const events = collect(
        query.query('SELECT 1', { signal: controller.signal }),
        () => rowSeen()
      )
      await firstRow

      controller.abort(reason)
      await expectCallCancelled()
      expect(events).toHaveLength(3)
      expect(events[0]).toBe('row')
      expectAbortError(events[1], reason)
      expect(events[2]).toBe('end')
    })

    it('should stop emitting rows when a row listener aborts', async () => {
      answer = {
        messages: [{ rows: [json(1), json(2), json(3)] }],
        end: 'hold',
      }
      const controller = new AbortController()
      const reason = new Error('stop')
      const events = collect(
        query.query('SELECT 1', { signal: controller.signal }),
        () => controller.abort(reason)
      )

      await expectCallCancelled()
      expect(events).toHaveLength(3)
      expect(events[0]).toBe('row')
      expectAbortError(events[1], reason)
      expect(events[2]).toBe('end')
    })

    it('should end the query once when a row listener aborts and then throws', async () => {
      answer = { messages: [{ rows: [json(1), json(2)] }], end: 'hold' }
      const controller = new AbortController()
      const reason = new Error('stop')
      const events = collect(
        query.query('SELECT 1', { signal: controller.signal }),
        () => {
          controller.abort(reason)
          throw new Error('listener failed')
        }
      )

      await expectCallCancelled()
      expect(events).toHaveLength(3)
      expect(events[0]).toBe('row')
      expectAbortError(events[1], reason)
      expect(events[2]).toBe('end')
    })

    it('should reject the promise form when aborted', async () => {
      answer = { messages: [], end: 'hold' }
      const before = received.length
      const controller = new AbortController()
      const reason = new Error('stop')
      const q = query.query('SELECT 1', { signal: controller.signal })
      await vi.waitFor(() => expect(received.length).toBe(before + 1))

      controller.abort(reason)
      expectAbortError(await q.catch((e: unknown) => e), reason)
      await expectCallCancelled()
    })

    it('should stop listening once the query completes', async () => {
      answer = { messages: [{ rows: [json(1)], meta_data: META }], end: 'ok' }
      const controller = new AbortController()
      const q = query.query('SELECT RAW 1', { signal: controller.signal })
      expect(getEventListeners(controller.signal, 'abort')).toHaveLength(1)

      expect((await q).rows).toEqual([1])
      expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
    })

    it('should stop listening once the query fails', async () => {
      answer = { messages: [], end: grpc.status.INVALID_ARGUMENT }
      const controller = new AbortController()
      await query
        .query('SELEC 1', { signal: controller.signal })
        .catch(() => undefined)
      expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
    })
  })
})
