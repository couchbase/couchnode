import { beforeEach, describe, expect, it } from 'vitest'

import binding from '../../../../lib/binding'
import type { Cluster } from '../../../../lib/cluster'
import {
  Collection,
  GetReplicaStrategy,
  ReplicaIndex,
} from '../../../../lib/collection'
import {
  DocumentNotFoundError,
  DocumentNotFoundOnReplicaError,
  ReplicaIndexCurrentlyUnavailableError,
  ReplicaIndexOutOfBoundsError,
} from '../../../../lib/errors'
import { NoOpMeter, NoOpTracer } from '../../../../lib/observability'
import {
  ObservabilityInstruments,
  OpAttributeName,
  SpanStatusCode,
} from '../../../../lib/observabilitytypes'
import type { Scope } from '../../../../lib/scope'
import {
  DefaultTranscoder,
  RawBinaryTranscoder,
} from '../../../../lib/transcoders'
import {
  TestMeter,
  TestValueRecorder,
} from '../../observability/metrics/metertypes'
import { TestSpan, TestTracer } from '../../observability/tracing/tracingtypes'

// These tests need no server. Unless a test sets `failWith`, every binding
// call on the stub connection succeeds with a JSON document, which
// RawBinaryTranscoder refuses to decode, so each read below fails after the
// binding call has returned.
describe('#key-value read spans', () => {
  let tracer: TestTracer
  let meter: TestMeter
  let failWith: { code: number } | null

  const conn = new Proxy(
    {},
    {
      get:
        () =>
        (_req: unknown, callback: (err: unknown, res: unknown) => void) =>
          failWith
            ? callback(failWith, undefined)
            : callback(null, {
                value: Buffer.from('{"a":1}'),
                flags: 0x02 << 24,
                cas: 1,
              }),
    }
  )
  const cluster = { kvTimeout: 1000 } as unknown as Cluster & {
    observabilityInstruments: ObservabilityInstruments
  }
  const bucket = { name: 'bucket', conn: conn, cluster: cluster }
  const scope = {
    name: 'scope',
    conn: conn,
    bucket: bucket,
    transcoder: new DefaultTranscoder(),
  } as unknown as Scope
  const collection = new Collection(scope, 'collection')

  beforeEach(() => {
    failWith = null
    tracer = new TestTracer()
    meter = new TestMeter()
    cluster.observabilityInstruments = new ObservabilityInstruments(
      tracer,
      meter
    )
  })

  function recordedSpan(): TestSpan {
    expect(tracer.spans).toHaveLength(1)
    return tracer.spans[0]
  }

  function recordedMetric(): TestValueRecorder {
    const recorders =
      meter.recorders.get(OpAttributeName.MeterNameOpDuration) ?? []
    expect(recorders).toHaveLength(1)
    return recorders[0]
  }

  const transcoder = new RawBinaryTranscoder()
  const reads: { name: string; call: () => Promise<unknown> }[] = [
    {
      name: 'get',
      call: () => collection.get('key', { transcoder }),
    },
    {
      name: 'getAndTouch',
      call: () => collection.getAndTouch('key', 1, { transcoder }),
    },
    {
      name: 'getAndLock',
      call: () => collection.getAndLock('key', 1, { transcoder }),
    },
    {
      name: 'getReplica',
      call: () =>
        collection.getReplica(
          'key',
          GetReplicaStrategy.fromIndex(ReplicaIndex.First),
          { transcoder }
        ),
    },
  ]

  for (const t of reads) {
    it(`${t.name} records a decoding failure as an error`, async () => {
      const rejection = await t.call().then(
        () => undefined,
        (err: unknown) => err
      )

      expect(rejection).toBeDefined()
      if (!(rejection instanceof Error)) {
        throw new Error(`expected an Error rejection, got ${String(rejection)}`)
      }
      const span = recordedSpan()
      expect(span.endTime).not.toBeNull()
      expect(span.status.code).toBe(SpanStatusCode.ERROR)
      expect(span.status.message).toBe(rejection.message)
      expect(
        recordedMetric().attributes[OpAttributeName.ErrorType]
      ).toBeDefined()
    })
  }

  // A missing document comes back from the core as a plain
  // document_not_found, which getReplica narrows to the replica error.
  const replicaErrors = [
    {
      errc: 'document_not_found',
      expected: DocumentNotFoundOnReplicaError,
      narrowed: true,
    },
    {
      errc: 'document_not_found_on_replica',
      expected: DocumentNotFoundOnReplicaError,
      narrowed: false,
    },
    {
      errc: 'replica_index_out_of_bounds',
      expected: ReplicaIndexOutOfBoundsError,
      narrowed: false,
    },
    {
      errc: 'replica_index_currently_unavailable',
      expected: ReplicaIndexCurrentlyUnavailableError,
      narrowed: false,
    },
  ] as const

  for (const t of replicaErrors) {
    it(`getReplica rejects ${t.errc} as ${t.expected.name}`, async () => {
      failWith = { code: binding.errc_key_value[t.errc] }
      const rejection = await collection
        .getReplica('key', GetReplicaStrategy.fromIndex(ReplicaIndex.First))
        .then(
          () => undefined,
          (err: unknown) => err
        )

      if (!(rejection instanceof t.expected)) {
        throw new Error(`expected ${t.expected.name}, got ${String(rejection)}`)
      }
      // Narrowing wraps the DocumentNotFoundError; an error that is already
      // the replica error is passed through, not wrapped a second time.
      expect(rejection.cause instanceof DocumentNotFoundError).toBe(t.narrowed)
      const span = recordedSpan()
      expect(span.endTime).not.toBeNull()
      expect(span.status.code).toBe(SpanStatusCode.ERROR)
      expect(
        recordedMetric().attributes[OpAttributeName.ErrorType]
      ).toBeDefined()
    })
  }

  it('records a decoded document as a success', async () => {
    const res = await collection.get('key')

    expect(res.content).toStrictEqual({ a: 1 })
    const span = recordedSpan()
    expect(span.endTime).not.toBeNull()
    expect(span.status.code).toBe(SpanStatusCode.UNSET)
    expect(
      recordedMetric().attributes[OpAttributeName.ErrorType]
    ).toBeUndefined()
  })

  it('rejects a decoding failure without observability', async () => {
    cluster.observabilityInstruments = new ObservabilityInstruments(
      new NoOpTracer(),
      new NoOpMeter()
    )

    await expect(collection.get('key', { transcoder })).rejects.toBeInstanceOf(
      Error
    )
  })
})
