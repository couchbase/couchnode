import { getEventListeners } from 'events'
import { beforeEach, describe, expect, it } from 'vitest'

import binding from '../../../lib/binding'
import type {
  CppError,
  CppQueryResponse,
  CppQueryStreamIterator,
  CppQueryStreamRow,
} from '../../../lib/binding'
import type { Cluster } from '../../../lib/cluster'
import { RequestCanceledError } from '../../../lib/errors'
import {
  ObservabilityInstruments,
  OpAttributeName,
  SpanStatusCode,
} from '../../../lib/observabilitytypes'
import { OpenQueryStream, QueryExecutor } from '../../../lib/queryexecutor'
import type {
  QueryMetaData,
  QueryOptions,
  QueryResult,
} from '../../../lib/querytypes'
import type { StreamableRowPromise } from '../../../lib/streamablepromises'
import { TestMeter } from '../../observability/metrics/metertypes'
import { TestTracer } from '../../observability/tracing/tracingtypes'

type NextCallback = (
  err: CppError | null,
  res: CppQueryStreamRow | null
) => void

/** What a cancelled stream completes its pending callback with. */
const CANCELED = {
  code: binding.errc_common.request_canceled,
} as unknown as CppError

const META = {
  request_id: 'request',
  client_context_id: 'context',
  status: 'success',
} as unknown as CppQueryStreamRow['meta']

/**
 * Stands in for the native iterator.  As with the real one, cancel() completes
 * a pending next() with an error, and a next() after cancel() fails, both on a
 * later turn.
 */
class FakeIterator implements CppQueryStreamIterator {
  nextCalls = 0
  cancelCalls = 0
  private _pending: NextCallback | undefined
  private _cancelled = false

  next(callback: NextCallback): void {
    this.nextCalls++
    if (this._cancelled) {
      setImmediate(() => callback(CANCELED, null))
      return
    }
    this._pending = callback
  }

  cancel(): void {
    this.cancelCalls++
    this._cancelled = true
    this._complete(CANCELED, null)
  }

  get pending(): boolean {
    return this._pending !== undefined
  }

  row(value: unknown): void {
    this._complete(null, { row: JSON.stringify(value) })
  }

  end(): void {
    this._complete(null, { meta: META })
  }

  private _complete(err: CppError | null, res: CppQueryStreamRow | null) {
    const callback = this._pending
    this._pending = undefined
    if (callback) {
      setImmediate(() => callback(err, res))
    }
  }
}

/** Every event a query emits, in order, with errors recorded as themselves. */
type QueryEvent = 'row' | 'end' | Error

/** Lets every callback queued with setImmediate run. */
async function flush(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setImmediate(resolve))
  }
}

function abortListeners(signal: AbortSignal): number {
  return getEventListeners(signal, 'abort').length
}

describe('#query abort', () => {
  let tracer: TestTracer
  let meter: TestMeter
  let iterator: FakeIterator
  let headers: ((err: CppError | null, it: FakeIterator) => void) | undefined
  let buffered:
    | ((err: CppError | null, res: CppQueryResponse) => void)
    | undefined
  let queryStreamCalls: number
  let cluster: Cluster

  beforeEach(() => {
    tracer = new TestTracer()
    meter = new TestMeter()
    iterator = new FakeIterator()
    headers = undefined
    buffered = undefined
    queryStreamCalls = 0
    cluster = {
      queryTimeout: 75000,
      closing: false,
      openQueryStreams: new Set<OpenQueryStream>(),
      observabilityInstruments: new ObservabilityInstruments(tracer, meter),
      conn: {
        queryStream: (_req: unknown, callback: typeof headers) => {
          queryStreamCalls++
          headers = callback
        },
        query: (_req: unknown, callback: typeof buffered) => {
          buffered = callback
        },
      },
    } as unknown as Cluster
  })

  function query(
    options: QueryOptions
  ): StreamableRowPromise<QueryResult, unknown, QueryMetaData> {
    return new QueryExecutor(cluster).query('SELECT 1', options)
  }

  /** Delivers the stream's headers, as the native side does once they arrive. */
  async function deliverHeaders(): Promise<void> {
    expect(headers, 'queryStream was never called').toBeDefined()
    headers?.(null, iterator)
    await flush()
  }

  function collect(
    q: StreamableRowPromise<QueryResult, unknown, QueryMetaData>,
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

  function expectRecordedOnceAsError(): void {
    expect(tracer.spans).toHaveLength(1)
    expect(tracer.spans[0].endTime).not.toBeNull()
    expect(tracer.spans[0].status.code).toBe(SpanStatusCode.ERROR)

    const recorders =
      meter.recorders.get(OpAttributeName.MeterNameOpDuration) ?? []
    expect(recorders).toHaveLength(1)
    expect(recorders[0].values).toHaveLength(1)
    expect(recorders[0].attributes[OpAttributeName.ErrorType]).toBeDefined()
  }

  it('fails without sending a query when the signal has already aborted', async () => {
    const reason = new Error('stop')
    const err = await query({ signal: AbortSignal.abort(reason) }).catch(
      (e: unknown) => e
    )

    expectAbortError(err, reason)
    expect(queryStreamCalls).toBe(0)
    expectRecordedOnceAsError()
  })

  it('wraps a reason that is not an Error', async () => {
    const controller = new AbortController()
    const q = query({ signal: controller.signal })
    controller.abort('stop')

    const err = await q.catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RequestCanceledError)
    const cause = (err as RequestCanceledError).cause
    expect(cause).toBeInstanceOf(Error)
    expect(cause?.message).toBe('stop')
  })

  describe('#streaming', () => {
    it('ends the query when aborted before the headers arrive', async () => {
      const controller = new AbortController()
      const reason = new Error('stop')
      const q = query({ signal: controller.signal })
      const events = collect(q)

      controller.abort(reason)
      expect(events).toHaveLength(2)
      expectAbortError(events[0], reason)
      expect(events[1]).toBe('end')

      // The stream is cancelled as soon as it exists, without pulling a row.
      await deliverHeaders()
      expect(iterator.cancelCalls).toBe(1)
      expect(iterator.nextCalls).toBe(0)
      expect(cluster.openQueryStreams.size).toBe(0)
      expect(events).toHaveLength(2)
      expectRecordedOnceAsError()
    })

    it('ignores a failed request when aborted before the headers arrive', async () => {
      const controller = new AbortController()
      const q = query({ signal: controller.signal })
      const events = collect(q)

      controller.abort()
      headers?.(CANCELED, iterator)
      await flush()

      expect(events).toHaveLength(2)
      expectRecordedOnceAsError()
    })

    it('cancels the stream when aborted while a row is pending', async () => {
      const controller = new AbortController()
      const reason = new Error('stop')
      const q = query({ signal: controller.signal })
      const events = collect(q)
      await deliverHeaders()
      iterator.row(1)
      await flush()
      expect(iterator.pending).toBe(true)

      controller.abort(reason)
      expect(iterator.cancelCalls).toBe(1)
      expect(events).toHaveLength(3)
      expect(events[0]).toBe('row')
      expectAbortError(events[1], reason)
      expect(events[2]).toBe('end')

      // The stream stays open until its pending callback arrives, so close()
      // still waits for it.
      const [stream] = cluster.openQueryStreams
      expect(stream).toBeDefined()
      await flush()
      await stream.ended
      expect(cluster.openQueryStreams.size).toBe(0)
      expect(events).toHaveLength(3)
      expectRecordedOnceAsError()
    })

    it('stops pulling rows when a row listener aborts', async () => {
      const controller = new AbortController()
      const reason = new Error('stop')
      const q = query({ signal: controller.signal })
      const events = collect(q, () => controller.abort(reason))
      await deliverHeaders()

      iterator.row(1)
      await flush()

      expect(iterator.nextCalls).toBe(1)
      expect(iterator.cancelCalls).toBe(1)
      expect(cluster.openQueryStreams.size).toBe(0)
      expect(events).toHaveLength(3)
      expect(events[0]).toBe('row')
      expectAbortError(events[1], reason)
      expect(events[2]).toBe('end')
      expectRecordedOnceAsError()
    })

    it('ends the query once when a row listener aborts and then throws', async () => {
      const controller = new AbortController()
      const reason = new Error('stop')
      const q = query({ signal: controller.signal })
      const events = collect(q, () => {
        controller.abort(reason)
        throw new Error('listener failed')
      })
      await deliverHeaders()

      iterator.row(1)
      await flush()

      expect(iterator.nextCalls).toBe(1)
      expect(iterator.cancelCalls).toBe(1)
      expect(cluster.openQueryStreams.size).toBe(0)
      expect(events).toHaveLength(3)
      expect(events[0]).toBe('row')
      expectAbortError(events[1], reason)
      expect(events[2]).toBe('end')
      expectRecordedOnceAsError()
    })

    it('rejects the promise form when aborted', async () => {
      const controller = new AbortController()
      const reason = new Error('stop')
      const q = query({ signal: controller.signal })
      await deliverHeaders()
      iterator.row(1)
      await flush()

      controller.abort(reason)
      expectAbortError(await q.catch((e: unknown) => e), reason)
    })

    it('stops listening once the query completes', async () => {
      const controller = new AbortController()
      const q = query({ signal: controller.signal })
      expect(abortListeners(controller.signal)).toBe(1)
      await deliverHeaders()
      iterator.row(1)
      await flush()
      iterator.end()

      const res = await q
      expect(res.rows).toStrictEqual([1])
      expect(abortListeners(controller.signal)).toBe(0)

      // A later abort has nothing left to do.
      controller.abort()
      await flush()
      expect(iterator.cancelCalls).toBe(0)
    })

    it('stops listening once the query fails', async () => {
      const controller = new AbortController()
      const q = query({ signal: controller.signal })
      headers?.(CANCELED, iterator)

      await q.catch(() => undefined)
      expect(abortListeners(controller.signal)).toBe(0)
    })
  })

  describe('#buffered', () => {
    it('ends the query and discards the late response', async () => {
      const controller = new AbortController()
      const reason = new Error('stop')
      const q = query({ adhoc: false, signal: controller.signal })
      const events = collect(q)
      expect(buffered, 'query was never called').toBeDefined()

      controller.abort(reason)
      expect(events).toHaveLength(2)
      expectAbortError(events[0], reason)
      expect(events[1]).toBe('end')

      buffered?.(null, {
        rows: ['1'],
        meta: META,
      } as unknown as CppQueryResponse)
      await flush()
      expect(events).toHaveLength(2)
      expectRecordedOnceAsError()
    })

    it('stops listening once the query completes', async () => {
      const controller = new AbortController()
      const q = query({ adhoc: false, signal: controller.signal })
      expect(abortListeners(controller.signal)).toBe(1)

      buffered?.(null, {
        rows: ['1'],
        meta: META,
      } as unknown as CppQueryResponse)
      const res = await q
      expect(res.rows).toStrictEqual([1])
      expect(abortListeners(controller.signal)).toBe(0)
    })
  })
})
