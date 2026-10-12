'use strict'

const assert = require('chai').assert

const { AnalyticsExecutor } = require('../lib/analyticsexecutor')
const { Collection } = require('../lib/collection')
const {
  ObservabilityInstruments,
  OpAttributeName,
  SpanStatusCode,
} = require('../lib/observabilitytypes')
const { SearchExecutor } = require('../lib/searchexecutor')
const { MatchAllSearchQuery } = require('../lib/searchquery')
const { DefaultTranscoder, RawBinaryTranscoder } = require('../lib/transcoders')
const { ViewExecutor } = require('../lib/viewexecutor')
const { TestMeter } = require('./metrics/metertypes')
const { TestTracer } = require('./tracing/tracingtypes')

// These tests need no server.  Every binding call on the stub connection
// succeeds, but with a response that cannot be processed: a JSON document
// read with RawBinaryTranscoder, or a row that is not valid JSON.
describe('#streaming spans', function () {
  let tracer
  let meter

  const doc = {
    value: Buffer.from('{"a":1}'),
    flags: 0x02 << 24,
    cas: 1,
    replica: true,
  }
  const responses = {
    getAllReplicas: { entries: [doc, doc] },
    getAnyReplica: doc,
    analytics: { rows: ['{'], meta: {} },
    search: { rows: [{ fields: '{' }], meta: {}, facets: {} },
    documentView: { rows: [{ id: 'id', key: '1', value: '{' }], meta: {} },
  }
  const conn = new Proxy(
    {},
    {
      get: (target, name) => (req, callback) => callback(null, responses[name]),
    }
  )
  const cluster = { kvTimeout: 1000, conn: conn }
  const bucket = { name: 'bucket', conn: conn, cluster: cluster }
  const scope = {
    name: 'scope',
    conn: conn,
    bucket: bucket,
    transcoder: new DefaultTranscoder(),
  }
  const collection = new Collection(scope, 'collection')
  const transcoder = new RawBinaryTranscoder()

  beforeEach(function () {
    tracer = new TestTracer()
    meter = new TestMeter()
    cluster.observabilityInstruments = new ObservabilityInstruments(
      tracer,
      meter
    )
  })

  function assertRecordedOnceAsError(rejection) {
    assert.lengthOf(tracer.spans, 1)
    const span = tracer.spans[0]
    assert.isNotNull(span.endTime)
    assert.strictEqual(span.status.code, SpanStatusCode.ERROR)
    assert.strictEqual(span.status.message, rejection.message)

    const recorders = meter.recorders.get(OpAttributeName.MeterNameOpDuration)
    assert.lengthOf(recorders, 1)
    assert.isDefined(recorders[0].attributes[OpAttributeName.ErrorType])
  }

  async function rejectionOf(promise) {
    try {
      await promise
    } catch (err) {
      return err
    }
    assert.fail('expected the operation to reject')
  }

  it('getAllReplicas stops at the first decoding failure', async function () {
    const emitter = collection.getAllReplicas('key', { transcoder })
    let replicas = 0
    const errors = []
    let ends = 0
    await new Promise((resolve) => {
      emitter.on('replica', () => replicas++)
      emitter.on('error', (err) => errors.push(err))
      emitter.on('end', () => {
        ends++
        setImmediate(resolve)
      })
    })

    assert.strictEqual(replicas, 0)
    assert.lengthOf(errors, 1)
    assert.strictEqual(ends, 1)
    assertRecordedOnceAsError(errors[0])
  })

  it('getAllReplicas rejects on a decoding failure', async function () {
    const err = await rejectionOf(
      collection.getAllReplicas('key', { transcoder })
    )

    assertRecordedOnceAsError(err)
  })

  it('getAnyReplica rejects on a decoding failure', async function () {
    const err = await rejectionOf(
      collection.getAnyReplica('key', { transcoder })
    )

    assertRecordedOnceAsError(err)
  })

  const queries = [
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

  queries.forEach((t) => {
    it(`${t.name} rejects when a row is not valid JSON`, async function () {
      const err = await rejectionOf(t.call())

      assert.instanceOf(err, SyntaxError)
      assertRecordedOnceAsError(err)
    })

    it(`${t.name} emits error and end once`, async function () {
      const emitter = t.call()
      let rows = 0
      const errors = []
      let ends = 0
      await new Promise((resolve) => {
        emitter.on('row', () => rows++)
        emitter.on('error', (err) => errors.push(err))
        emitter.on('end', () => {
          ends++
          setImmediate(resolve)
        })
      })

      assert.strictEqual(rows, 0)
      assert.lengthOf(errors, 1)
      assert.strictEqual(ends, 1)
      assertRecordedOnceAsError(errors[0])
    })
  })
})
