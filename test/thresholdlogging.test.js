'use strict'

const assert = require('chai').assert
const {
  ThresholdLoggingTracer,
  ThresholdLoggingSpan,
} = require('../lib/thresholdlogging')
const { CouchbaseLogger, NoOpLogger } = require('../lib/logger')
const {
  OpAttributeName,
  DispatchAttributeName,
} = require('../lib/observabilitytypes')

describe('Threshold Logging', function () {
  const TRACING_CONFIG = {
    kvThreshold: 0.5, // 0.5ms => 500us
    queryThreshold: 0.5,
    sampleSize: 10,
    emitInterval: 10000, // 10 seconds
  }

  const CONFIG_SMALL_SAMPLE = {
    kvThreshold: 0.5,
    sampleSize: 3,
    emitInterval: 100000,
  }

  function createHiResTime(offsetSeconds = 0, offsetNanos = 0) {
    return [offsetSeconds, offsetNanos]
  }

  describe('#enqueue-only-above-threshold', function () {
    it('should enqueue spans above threshold', function () {
      const logger = new CouchbaseLogger(new NoOpLogger())
      const tracer = new ThresholdLoggingTracer(logger, TRACING_CONFIG)
      tracer.reporter.stop()

      const start = createHiResTime(0, 0)
      const end = createHiResTime(0, 1_000_000) // 1ms => 1000us

      const span = new ThresholdLoggingSpan(
        'test_operation',
        tracer,
        undefined,
        start
      )
      span.setAttribute(OpAttributeName.Service, 'kv')
      span.end(end)

      const report = tracer.reporter.report(true)
      assert.isObject(report)
      assert.property(report, 'kv')
      assert.property(report.kv, 'total_count')
      assert.equal(report.kv.total_count, 1)
      assert.property(report.kv, 'top_requests')
      assert.isArray(report.kv.top_requests)
      assert.lengthOf(report.kv.top_requests, 1)

      const record = report.kv.top_requests[0]
      assert.property(record, 'operation_name', 'test_operation')
      assert.property(record, 'total_duration_us')
      assert.equal(record.total_duration_us, 1000.0)
    })
  })

  describe('#ignore-below-threshold', function () {
    it('should ignore spans below threshold', function () {
      const logger = new CouchbaseLogger(new NoOpLogger())
      const tracer = new ThresholdLoggingTracer(logger, TRACING_CONFIG)
      tracer.reporter.stop()

      const start = createHiResTime(0, 0)
      const end = createHiResTime(0, 100_000) // 0.1ms => 100us (below 500us)

      const span = new ThresholdLoggingSpan(
        'test_operation',
        tracer,
        undefined,
        start
      )
      span.setAttribute(OpAttributeName.Service, 'kv')
      span.end(end)

      const report = tracer.reporter.report(true)
      assert.isObject(report)
      assert.isEmpty(report)
    })
  })

  describe('#end-idempotency', function () {
    it('should only record once when end() called multiple times', function () {
      const logger = new CouchbaseLogger(new NoOpLogger())
      const tracer = new ThresholdLoggingTracer(logger, TRACING_CONFIG)
      tracer.reporter.stop()

      const start = createHiResTime(0, 0)
      const end = createHiResTime(0, 1_000_000) // 1ms => 1000us

      const span = new ThresholdLoggingSpan(
        'test_operation',
        tracer,
        undefined,
        start
      )
      span.setAttribute(OpAttributeName.Service, 'kv')
      span.end(end)
      span.end(end)
      span.end(end)

      const report = tracer.reporter.report(true)
      assert.property(report, 'kv')
      assert.equal(report.kv.total_count, 1)
      assert.lengthOf(report.kv.top_requests, 1)
    })
  })

  describe('#child-spans-propagate-durations', function () {
    it('should propagate encoding, dispatch, and server durations to parent', function () {
      const logger = new CouchbaseLogger(new NoOpLogger())
      const tracer = new ThresholdLoggingTracer(logger, TRACING_CONFIG)
      tracer.reporter.stop()

      const opStart = createHiResTime(0, 0)
      const encodeStart = createHiResTime(0, 100_000)
      const encodeEnd = createHiResTime(0, 200_000) // 0.1ms encoding
      const dispatchStart = createHiResTime(0, 300_000)
      const dispatchEnd = createHiResTime(0, 700_000) // 0.4ms dispatch
      const opEnd = createHiResTime(0, 1_500_000) // 1.5ms total

      const parentSpan = new ThresholdLoggingSpan(
        'replace',
        tracer,
        undefined,
        opStart
      )
      parentSpan.setAttribute(OpAttributeName.Service, 'kv')

      const encodingSpan = new ThresholdLoggingSpan(
        OpAttributeName.EncodingSpanName,
        tracer,
        parentSpan,
        encodeStart
      )
      encodingSpan.end(encodeEnd)

      const dispatchSpan = new ThresholdLoggingSpan(
        OpAttributeName.DispatchSpanName,
        tracer,
        parentSpan,
        dispatchStart
      )
      dispatchSpan.setAttribute(DispatchAttributeName.LocalId, 'local1')
      dispatchSpan.setAttribute(DispatchAttributeName.OperationId, 'op1')
      dispatchSpan.setAttribute(DispatchAttributeName.PeerAddress, '1.2.3.4')
      dispatchSpan.setAttribute(DispatchAttributeName.PeerPort, 11210)
      dispatchSpan.setAttribute(DispatchAttributeName.ServerAddress, '1.2.3.5')
      dispatchSpan.setAttribute(DispatchAttributeName.ServerPort, 11210)
      dispatchSpan.setAttribute(DispatchAttributeName.ServerDuration, 300) // 300us server duration
      dispatchSpan.end(dispatchEnd)

      parentSpan.end(opEnd)

      const report = tracer.reporter.report(true)
      assert.property(report, 'kv')
      assert.lengthOf(report.kv.top_requests, 1)

      const record = report.kv.top_requests[0]
      assert.equal(record.operation_name, 'replace')
      assert.equal(record.total_duration_us, 1500.0)
      assert.equal(record.encode_duration_us, 100.0)
      assert.equal(record.last_dispatch_duration_us, 400.0)
      assert.equal(record.total_dispatch_duration_us, 400.0)
      assert.equal(record.last_server_duration_us, 300.0)
      assert.equal(record.total_server_duration_us, 300.0)
      assert.equal(record.last_local_id, 'local1')
      assert.equal(record.operation_id, 'op1')
      assert.equal(record.last_local_socket, '1.2.3.4:11210')
      assert.equal(record.last_remote_socket, '1.2.3.5:11210')
    })
  })

  describe('#exceeding-sample-size', function () {
    it('should keep only top N items sorted by duration descending', function () {
      const logger = new CouchbaseLogger(new NoOpLogger())
      const tracer = new ThresholdLoggingTracer(logger, CONFIG_SMALL_SAMPLE)
      tracer.reporter.stop()

      const baseStart = createHiResTime(0, 0)
      const operations = [
        { name: 'replace', durationNanos: 1_000_000 },
        { name: 'insert', durationNanos: 1_100_000 },
        { name: 'upsert', durationNanos: 1_050_000 },
        { name: 'get', durationNanos: 1_200_000 },
        { name: 'remove', durationNanos: 1_150_000 },
      ]

      operations.forEach((op) => {
        const start = createHiResTime(baseStart[0], baseStart[1])
        const end = createHiResTime(start[0], start[1] + op.durationNanos)

        const span = new ThresholdLoggingSpan(op.name, tracer, undefined, start)
        span.setAttribute(OpAttributeName.Service, 'kv')
        span.end(end)
      })

      const report = tracer.reporter.report(true)
      assert.property(report, 'kv')
      assert.equal(report.kv.total_count, 5)
      assert.lengthOf(report.kv.top_requests, 3)

      const durations = report.kv.top_requests.map((r) => r.total_duration_us)
      assert.deepEqual(durations, [1200.0, 1150.0, 1100.0])

      const names = report.kv.top_requests.map((r) => r.operation_name)
      assert.include(names, 'get')
      assert.include(names, 'remove')
      assert.include(names, 'insert')
      assert.notInclude(names, 'replace')
      assert.notInclude(names, 'upsert')
    })
  })

  describe('#multiple-services', function () {
    it('should track operations for multiple services', function () {
      const logger = new CouchbaseLogger(new NoOpLogger())
      const config = {
        ...TRACING_CONFIG,
        queryThreshold: 0.5,
        emitInterval: 100000,
      }
      const tracer = new ThresholdLoggingTracer(logger, config)
      tracer.reporter.stop()

      const baseStart = createHiResTime(0, 0)

      const kvSpans = ['replace', 'insert']
      kvSpans.forEach((name) => {
        const start = createHiResTime(baseStart[0], baseStart[1])
        const end = createHiResTime(start[0], start[1] + 1_000_000)
        const span = new ThresholdLoggingSpan(name, tracer, undefined, start)
        span.setAttribute(OpAttributeName.Service, 'kv')
        span.end(end)
      })

      const querySpans = ['query1', 'query2']
      querySpans.forEach((name) => {
        const start = createHiResTime(baseStart[0], baseStart[1])
        const end = createHiResTime(start[0], start[1] + 1_200_000)
        const span = new ThresholdLoggingSpan(name, tracer, undefined, start)
        span.setAttribute(OpAttributeName.Service, 'query')
        span.end(end)
      })

      const report = tracer.reporter.report(true)
      assert.property(report, 'kv')
      assert.equal(report.kv.total_count, 2)
      assert.lengthOf(report.kv.top_requests, 2)

      assert.property(report, 'query')
      assert.equal(report.query.total_count, 2)
      assert.lengthOf(report.query.top_requests, 2)
    })
  })

  describe('#spans-without-service', function () {
    it('should ignore spans without service attribute', function () {
      const logger = new CouchbaseLogger(new NoOpLogger())
      const tracer = new ThresholdLoggingTracer(logger, TRACING_CONFIG)
      tracer.reporter.stop()

      const start = createHiResTime(0, 0)
      const end = createHiResTime(0, 1_000_000)

      const span = new ThresholdLoggingSpan(
        'test_operation',
        tracer,
        undefined,
        start
      )
      span.end(end)

      const report = tracer.reporter.report(true)
      assert.isEmpty(report)
    })
  })
})
