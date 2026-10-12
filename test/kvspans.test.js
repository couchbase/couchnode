'use strict'

const assert = require('chai').assert

const { Collection } = require('../lib/collection')
const { NoOpMeter, NoOpTracer } = require('../lib/observability')
const {
  ObservabilityInstruments,
  OpAttributeName,
  SpanStatusCode,
} = require('../lib/observabilitytypes')
const { DefaultTranscoder, RawBinaryTranscoder } = require('../lib/transcoders')
const { TestMeter } = require('./metrics/metertypes')
const { TestTracer } = require('./tracing/tracingtypes')

// These tests need no server.  Every binding call on the stub connection
// succeeds with a JSON document, which RawBinaryTranscoder refuses to
// decode, so each read below fails after the binding call has returned.
describe('#key-value read spans', function () {
  let tracer
  let meter

  const conn = new Proxy(
    {},
    {
      get: () => (req, callback) =>
        callback(null, {
          value: Buffer.from('{"a":1}'),
          flags: 0x02 << 24,
          cas: 1,
        }),
    }
  )
  const cluster = { kvTimeout: 1000 }
  const bucket = { name: 'bucket', conn: conn, cluster: cluster }
  const scope = {
    name: 'scope',
    conn: conn,
    bucket: bucket,
    transcoder: new DefaultTranscoder(),
  }
  const collection = new Collection(scope, 'collection')

  beforeEach(function () {
    tracer = new TestTracer()
    meter = new TestMeter()
    cluster.observabilityInstruments = new ObservabilityInstruments(
      tracer,
      meter
    )
  })

  function recordedSpan() {
    assert.lengthOf(tracer.spans, 1)
    return tracer.spans[0]
  }

  function recordedMetric() {
    const recorders = meter.recorders.get(OpAttributeName.MeterNameOpDuration)
    assert.lengthOf(recorders, 1)
    return recorders[0]
  }

  const transcoder = new RawBinaryTranscoder()
  const reads = [
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
  ]

  reads.forEach((t) => {
    it(`${t.name} records a decoding failure as an error`, async function () {
      let rejection
      try {
        await t.call()
      } catch (err) {
        rejection = err
      }

      assert.isDefined(rejection)
      const span = recordedSpan()
      assert.isNotNull(span.endTime)
      assert.strictEqual(span.status.code, SpanStatusCode.ERROR)
      assert.strictEqual(span.status.message, rejection.message)
      assert.isDefined(recordedMetric().attributes[OpAttributeName.ErrorType])
    })
  })

  it('records a decoded document as a success', async function () {
    const res = await collection.get('key')

    assert.deepStrictEqual(res.content, { a: 1 })
    const span = recordedSpan()
    assert.isNotNull(span.endTime)
    assert.strictEqual(span.status.code, SpanStatusCode.UNSET)
    assert.isUndefined(recordedMetric().attributes[OpAttributeName.ErrorType])
  })

  it('rejects a decoding failure without observability', async function () {
    cluster.observabilityInstruments = new ObservabilityInstruments(
      new NoOpTracer(),
      new NoOpMeter()
    )
    let rejection
    try {
      await collection.get('key', { transcoder })
    } catch (err) {
      rejection = err
    }

    assert.instanceOf(rejection, Error)
  })
})
