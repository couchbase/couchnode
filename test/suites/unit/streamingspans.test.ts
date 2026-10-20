import type { EventEmitter } from 'events'
import { beforeEach, describe, expect, it } from 'vitest'

import { AnalyticsExecutor } from '../../../lib/analyticsexecutor'
import type { Bucket } from '../../../lib/bucket'
import type { Cluster } from '../../../lib/cluster'
import { Collection } from '../../../lib/collection'
import {
  ObservabilityInstruments,
  OpAttributeName,
  SpanStatusCode,
} from '../../../lib/observabilitytypes'
import type { Scope } from '../../../lib/scope'
import { SearchExecutor } from '../../../lib/searchexecutor'
import { MatchAllSearchQuery } from '../../../lib/searchquery'
import {
  DefaultTranscoder,
  RawBinaryTranscoder,
} from '../../../lib/transcoders'
import { ViewExecutor } from '../../../lib/viewexecutor'
import { TestMeter } from '../../observability/metrics/metertypes'
import { TestTracer } from '../../observability/tracing/tracingtypes'

// These tests need no server. Every binding call on the stub connection
// succeeds, but with a response that cannot be processed: a JSON document read
// with RawBinaryTranscoder, or a row that is not valid JSON.
describe('#streaming spans', () => {
  let tracer: TestTracer
  let meter: TestMeter

  const doc = {
    value: Buffer.from('{"a":1}'),
    flags: 0x02 << 24,
    cas: 1,
    replica: true,
  }
  const responses: Record<string | symbol, unknown> = {
    getAllReplicas: { entries: [doc, doc] },
    getAnyReplica: doc,
    analytics: { rows: ['{'], meta: {} },
    search: { rows: [{ fields: '{' }], meta: {}, facets: {} },
    documentView: { rows: [{ id: 'id', key: '1', value: '{' }], meta: {} },
  }
  const conn = new Proxy(
    {},
    {
      get:
        (_target, name) =>
        (_req: unknown, callback: (err: Error | null, res: unknown) => void) =>
          callback(null, responses[name]),
    }
  )
  const cluster = { kvTimeout: 1000, conn: conn } as unknown as Cluster & {
    observabilityInstruments: ObservabilityInstruments
  }
  const bucket = {
    name: 'bucket',
    conn: conn,
    cluster: cluster,
  } as unknown as Bucket
  const scope = {
    name: 'scope',
    conn: conn,
    bucket: bucket,
    transcoder: new DefaultTranscoder(),
  } as unknown as Scope
  const collection = new Collection(scope, 'collection')
  const transcoder = new RawBinaryTranscoder()

  beforeEach(() => {
    tracer = new TestTracer()
    meter = new TestMeter()
    cluster.observabilityInstruments = new ObservabilityInstruments(
      tracer,
      meter
    )
  })

  function expectRecordedOnceAsError(rejection: unknown): void {
    if (!(rejection instanceof Error)) {
      throw new Error(`expected an Error rejection, got ${String(rejection)}`)
    }
    expect(tracer.spans).toHaveLength(1)
    const span = tracer.spans[0]
    expect(span.endTime).not.toBeNull()
    expect(span.status.code).toBe(SpanStatusCode.ERROR)
    expect(span.status.message).toBe(rejection.message)

    const recorders =
      meter.recorders.get(OpAttributeName.MeterNameOpDuration) ?? []
    expect(recorders).toHaveLength(1)
    expect(recorders[0].attributes[OpAttributeName.ErrorType]).toBeDefined()
  }

  async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
    return promise.then(
      () => expect.fail('expected the operation to reject'),
      (err: unknown) => err
    )
  }

  /** Every event the emitter sends until `end`, counted by name. */
  async function drain(
    emitter: EventEmitter,
    itemEvent: string
  ): Promise<{ items: number; errors: unknown[]; ends: number }> {
    const seen = { items: 0, errors: [] as unknown[], ends: 0 }
    await new Promise<void>((resolve) => {
      emitter.on(itemEvent, () => seen.items++)
      emitter.on('error', (err: unknown) => seen.errors.push(err))
      emitter.on('end', () => {
        seen.ends++
        // A second `end` or `error` would arrive after this one; give it a
        // turn to land before counting.
        setImmediate(resolve)
      })
    })
    return seen
  }

  it('getAllReplicas stops at the first decoding failure', async () => {
    // Typed as a promise, but the streamable result is also an emitter.
    const emitter = collection.getAllReplicas('key', {
      transcoder,
    }) as unknown as EventEmitter
    const seen = await drain(emitter, 'replica')

    expect(seen.items).toBe(0)
    expect(seen.errors).toHaveLength(1)
    expect(seen.ends).toBe(1)
    expectRecordedOnceAsError(seen.errors[0])
  })

  it('getAllReplicas rejects on a decoding failure', async () => {
    const err = await rejectionOf(
      collection.getAllReplicas('key', { transcoder })
    )

    expectRecordedOnceAsError(err)
  })

  it('getAnyReplica rejects on a decoding failure', async () => {
    const err = await rejectionOf(
      collection.getAnyReplica('key', { transcoder })
    )

    expectRecordedOnceAsError(err)
  })

  const queries: {
    name: string
    call: () => Promise<unknown> & EventEmitter
  }[] = [
    {
      name: 'analytics',
      call: () => new AnalyticsExecutor(cluster).query('SELECT 1', {}),
    },
    {
      name: 'search',
      call: () =>
        new SearchExecutor(cluster).query(
          'index',
          new MatchAllSearchQuery(),
          {}
        ),
    },
    {
      name: 'view',
      call: () => new ViewExecutor(bucket).query('ddoc', 'view', {}),
    },
  ]

  for (const t of queries) {
    it(`${t.name} rejects when a row is not valid JSON`, async () => {
      const err = await rejectionOf(t.call())

      expect(err).toBeInstanceOf(SyntaxError)
      expectRecordedOnceAsError(err)
    })

    it(`${t.name} emits error and end once`, async () => {
      const seen = await drain(t.call(), 'row')

      expect(seen.items).toBe(0)
      expect(seen.errors).toHaveLength(1)
      expect(seen.ends).toBe(1)
      expectRecordedOnceAsError(seen.errors[0])
    })
  }
})
