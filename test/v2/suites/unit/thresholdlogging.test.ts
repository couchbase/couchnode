import { describe, expect, it } from 'vitest'

import { HiResTime } from '../../../../lib/binding'
import { TracingConfig } from '../../../../lib/cluster'
import { CouchbaseLogger, NoOpLogger } from '../../../../lib/logger'
import {
  DispatchAttributeName,
  OpAttributeName,
} from '../../../../lib/observabilitytypes'
import {
  ThresholdLoggingSpan,
  ThresholdLoggingTracer,
} from '../../../../lib/thresholdlogging'

/**
 * The report's shape, which the tracer returns as `Record<string, any>`, typed
 * so a misspelled field is a compile error.
 */
interface ServiceReport {
  total_count: number
  top_requests: Record<string, string | number>[]
}

type Report = Record<string, ServiceReport>

const TRACING_CONFIG: TracingConfig = {
  kvThreshold: 0.5, // 0.5ms => 500us
  queryThreshold: 0.5,
  sampleSize: 10,
  emitInterval: 10000, // 10 seconds
}

const CONFIG_SMALL_SAMPLE: TracingConfig = {
  kvThreshold: 0.5,
  sampleSize: 3,
  emitInterval: 100000,
}

function createHiResTime(offsetSeconds = 0, offsetNanos = 0): HiResTime {
  return [offsetSeconds, offsetNanos]
}

/**
 * A tracer whose periodic reporter is stopped before any span is recorded.
 * The reporter's `setInterval` would otherwise keep the process alive.
 */
function newTracer(config: TracingConfig): ThresholdLoggingTracer {
  const tracer = new ThresholdLoggingTracer(
    new CouchbaseLogger(new NoOpLogger()),
    config
  )
  tracer.reporter.stop()
  return tracer
}

function reportOf(tracer: ThresholdLoggingTracer): Report {
  return (tracer.reporter.report(true) ?? {}) as Report
}

function recordSpan(
  tracer: ThresholdLoggingTracer,
  name: string,
  service: string,
  durationNanos: number
): void {
  const span = new ThresholdLoggingSpan(
    name,
    tracer,
    undefined,
    createHiResTime(0, 0)
  )
  span.setAttribute(OpAttributeName.Service, service)
  span.end(createHiResTime(0, durationNanos))
}

describe('Threshold Logging', () => {
  describe('#enqueue-only-above-threshold', () => {
    it('should enqueue spans above threshold', () => {
      const tracer = newTracer(TRACING_CONFIG)
      recordSpan(tracer, 'test_operation', 'kv', 1_000_000) // 1ms => 1000us

      const report = reportOf(tracer)
      expect(report).toBeTypeOf('object')
      expect(report).toHaveProperty('kv')
      expect(report.kv).toHaveProperty('total_count')
      expect(report.kv.total_count).toBe(1)
      expect(report.kv).toHaveProperty('top_requests')
      expect(Array.isArray(report.kv.top_requests)).toBe(true)
      expect(report.kv.top_requests).toHaveLength(1)

      const record = report.kv.top_requests[0]
      // Regression guard (JSCBC-1449): the reported name must equal the one
      // the span was created with, not merely be present.
      expect(record.operation_name).toBe('test_operation')
      expect(record).toHaveProperty('total_duration_us')
      expect(record.total_duration_us).toBe(1000.0)
    })
  })

  describe('#ignore-below-threshold', () => {
    it('should ignore spans below threshold', () => {
      const tracer = newTracer(TRACING_CONFIG)
      // 0.1ms => 100us, below the 500us threshold
      recordSpan(tracer, 'test_operation', 'kv', 100_000)

      const report = reportOf(tracer)
      expect(report).toBeTypeOf('object')
      expect(Object.keys(report)).toHaveLength(0)
    })
  })

  describe('#end-idempotency', () => {
    it('should only record once when end() called multiple times', () => {
      const tracer = newTracer(TRACING_CONFIG)

      const end = createHiResTime(0, 1_000_000) // 1ms => 1000us
      const span = new ThresholdLoggingSpan(
        'test_operation',
        tracer,
        undefined,
        createHiResTime(0, 0)
      )
      span.setAttribute(OpAttributeName.Service, 'kv')
      span.end(end)
      span.end(end)
      span.end(end)

      const report = reportOf(tracer)
      expect(report).toHaveProperty('kv')
      expect(report.kv.total_count).toBe(1)
      expect(report.kv.top_requests).toHaveLength(1)
    })
  })

  describe('#child-spans-propagate-durations', () => {
    it('should propagate encoding, dispatch, and server durations to parent', () => {
      const tracer = newTracer(TRACING_CONFIG)

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
      // 300us server duration
      dispatchSpan.setAttribute(DispatchAttributeName.ServerDuration, 300)
      dispatchSpan.end(dispatchEnd)

      parentSpan.end(opEnd)

      const report = reportOf(tracer)
      expect(report).toHaveProperty('kv')
      expect(report.kv.top_requests).toHaveLength(1)

      const record = report.kv.top_requests[0]
      expect(record.operation_name).toBe('replace')
      expect(record.total_duration_us).toBe(1500.0)
      expect(record.encode_duration_us).toBe(100.0)
      expect(record.last_dispatch_duration_us).toBe(400.0)
      expect(record.total_dispatch_duration_us).toBe(400.0)
      expect(record.last_server_duration_us).toBe(300.0)
      expect(record.total_server_duration_us).toBe(300.0)
      expect(record.last_local_id).toBe('local1')
      expect(record.operation_id).toBe('op1')
      expect(record.last_local_socket).toBe('1.2.3.4:11210')
      expect(record.last_remote_socket).toBe('1.2.3.5:11210')
    })
  })

  describe('#exceeding-sample-size', () => {
    it('should keep only top N items sorted by duration descending', () => {
      const tracer = newTracer(CONFIG_SMALL_SAMPLE)

      const operations = [
        { name: 'replace', durationNanos: 1_000_000 },
        { name: 'insert', durationNanos: 1_100_000 },
        { name: 'upsert', durationNanos: 1_050_000 },
        { name: 'get', durationNanos: 1_200_000 },
        { name: 'remove', durationNanos: 1_150_000 },
      ]
      for (const op of operations) {
        recordSpan(tracer, op.name, 'kv', op.durationNanos)
      }

      const report = reportOf(tracer)
      expect(report).toHaveProperty('kv')
      expect(report.kv.total_count).toBe(5)
      expect(report.kv.top_requests).toHaveLength(3)

      const durations = report.kv.top_requests.map((r) => r.total_duration_us)
      expect(durations).toEqual([1200.0, 1150.0, 1100.0])

      const names = report.kv.top_requests.map((r) => r.operation_name)
      expect(names).toContain('get')
      expect(names).toContain('remove')
      expect(names).toContain('insert')
      expect(names).not.toContain('replace')
      expect(names).not.toContain('upsert')
    })
  })

  describe('#multiple-services', () => {
    it('should track operations for multiple services', () => {
      const tracer = newTracer({
        ...TRACING_CONFIG,
        queryThreshold: 0.5,
        emitInterval: 100000,
      })

      for (const name of ['replace', 'insert']) {
        recordSpan(tracer, name, 'kv', 1_000_000)
      }
      for (const name of ['query1', 'query2']) {
        recordSpan(tracer, name, 'query', 1_200_000)
      }

      const report = reportOf(tracer)
      expect(report).toHaveProperty('kv')
      expect(report.kv.total_count).toBe(2)
      expect(report.kv.top_requests).toHaveLength(2)

      expect(report).toHaveProperty('query')
      expect(report.query.total_count).toBe(2)
      expect(report.query.top_requests).toHaveLength(2)
    })
  })

  describe('#spans-without-service', () => {
    it('should ignore spans without service attribute', () => {
      const tracer = newTracer(TRACING_CONFIG)

      const span = new ThresholdLoggingSpan(
        'test_operation',
        tracer,
        undefined,
        createHiResTime(0, 0)
      )
      span.end(createHiResTime(0, 1_000_000))

      expect(Object.keys(reportOf(tracer))).toHaveLength(0)
    })
  })
})
