import { beforeEach, describe, expect, it } from 'vitest'

import {
  AnalyticsIndexManager,
  Bucket,
  BucketManager,
  Cluster,
  CollectionManager,
  EventingFunctionManager,
  QueryIndexManager,
  ScopeEventingFunctionManager,
  ScopeSearchIndexManager,
  SearchIndexManager,
  UserManager,
  ViewIndexManager,
} from '../../../lib/couchbase'
import {
  ObservabilityInstruments,
  OpAttributeName,
  SpanStatusCode,
} from '../../../lib/observabilitytypes'
import {
  TestMeter,
  TestValueRecorder,
} from '../../observability/metrics/metertypes'
import { TestSpan, TestTracer } from '../../observability/tracing/tracingtypes'

// These tests need no server. Every binding call on the stub connection
// succeeds with the response it is given, so each management call below
// reaches the step that turns that response into SDK types, and what is under
// test is that a failure in that step is recorded on the span and the metric.
describe('#management spans', () => {
  let tracer: TestTracer
  let meter: TestMeter
  let response: unknown

  const conn = new Proxy(
    {},
    {
      get:
        () =>
        (_req: unknown, callback: (err: Error | null, res: unknown) => void) =>
          callback(null, response),
    }
  )
  const cluster = {
    conn: conn,
    managementTimeout: 1000,
  } as unknown as Cluster & {
    observabilityInstruments: ObservabilityInstruments
  }
  const bucket = {
    name: 'bucket',
    conn: conn,
    cluster: cluster,
  } as unknown as Bucket

  beforeEach(() => {
    tracer = new TestTracer()
    meter = new TestMeter()
    cluster.observabilityInstruments = new ObservabilityInstruments(
      tracer,
      meter
    )
  })

  // Every field reads as null, which no decoding step accepts, and the
  // analysis a search index returns is not valid JSON.
  const undecodable = new Proxy(
    {},
    {
      get: (_target, name) => (name === 'analysis' ? '{' : null),
    }
  )

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

  const managers: { name: string; call: () => Promise<unknown> }[] = [
    {
      name: 'AnalyticsIndexManager.getAllDatasets',
      call: () => new AnalyticsIndexManager(cluster).getAllDatasets(),
    },
    {
      name: 'BucketManager.getBucket',
      call: () => new BucketManager(cluster).getBucket('bucket'),
    },
    {
      name: 'CollectionManager.getAllScopes',
      call: () => new CollectionManager(bucket).getAllScopes(),
    },
    {
      name: 'EventingFunctionManager.getFunction',
      call: () => new EventingFunctionManager(cluster).getFunction('f'),
    },
    {
      name: 'QueryIndexManager.getAllIndexes',
      call: () => new QueryIndexManager(cluster).getAllIndexes('bucket'),
    },
    {
      name: 'ScopeEventingFunctionManager.getAllFunctions',
      call: () =>
        new ScopeEventingFunctionManager(cluster, 'b', 's').getAllFunctions(),
    },
    {
      name: 'ScopeSearchIndexManager.analyzeDocument',
      call: () =>
        new ScopeSearchIndexManager(cluster, 'b', 's').analyzeDocument(
          'index',
          {}
        ),
    },
    {
      name: 'SearchIndexManager.analyzeDocument',
      call: () => new SearchIndexManager(cluster).analyzeDocument('index', {}),
    },
    {
      name: 'UserManager.getAllGroups',
      call: () => new UserManager(cluster).getAllGroups(),
    },
    {
      name: 'ViewIndexManager.getDesignDocument',
      call: () => new ViewIndexManager(bucket).getDesignDocument('ddoc'),
    },
  ]

  for (const t of managers) {
    it(`${t.name} records a decoding failure as an error`, async () => {
      response = undecodable
      const rejection = await t.call().then(
        () => undefined,
        (err: unknown) => err
      )

      expect(rejection).toBeDefined()
      // Narrows for the message check below; the assertion above has already
      // said whether the call failed.
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

  it('records a decoded response as a success', async () => {
    response = { groups: [] }
    const groups = await new UserManager(cluster).getAllGroups()

    expect(groups).toStrictEqual([])
    const span = recordedSpan()
    expect(span.endTime).not.toBeNull()
    expect(span.status.code).toBe(SpanStatusCode.UNSET)
    expect(
      recordedMetric().attributes[OpAttributeName.ErrorType]
    ).toBeUndefined()
  })
})
