import { afterEach, describe, expect, it, vi } from 'vitest'

import binding from '../../../lib/binding'
import { Cluster } from '../../../lib/cluster'
import { PingResult, PingState } from '../../../lib/diagnosticstypes'
import { ServiceType } from '../../../lib/generaltypes'
import { CouchbaseLogger } from '../../../lib/logger'
import { LoggingMeter } from '../../../lib/loggingmeter'
import { OpAttributeName, ServiceName } from '../../../lib/observabilitytypes'
import { metaData, systemData, userData } from '../../../lib/redaction'
import {
  ThresholdLoggingSpan,
  ThresholdLoggingTracer,
} from '../../../lib/thresholdlogging'
import { WaitUntilReadyExecutor } from '../../../lib/waituntilreadyexecutor'

/**
 * Redaction is process wide and only a connecting cluster can turn it on.
 * Stubbing the binding's getter keeps these tests free of a cluster and of
 * state that would outlive the test.
 */
function setRedaction(enabled: boolean): void {
  vi.spyOn(binding, 'isLogRedactionEnabled').mockReturnValue(enabled)
}

interface Captured {
  logger: CouchbaseLogger
  lines: string[]
}

function capturingLogger(): Captured {
  const lines: string[] = []
  const push = (message: string) => lines.push(message)
  return {
    logger: new CouchbaseLogger({ info: push, warn: push }),
    lines,
  }
}

/** The single line logged, with "nothing was logged" reported as such. */
function onlyLine(captured: Captured): string {
  expect(captured.lines, 'expected exactly one log line').toHaveLength(1)
  return captured.lines[0]
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('log redaction', () => {
  describe('#helpers', () => {
    it('returns the value unchanged while redaction is disabled', () => {
      setRedaction(false)
      expect(userData('key\n</ud>')).toBe('key\n</ud>')
      expect(metaData('default')).toBe('default')
      expect(systemData('127.0.0.1:11210')).toBe('127.0.0.1:11210')
    })

    it('wraps each category in its own tag', () => {
      setRedaction(true)
      expect(userData('key')).toBe('<ud>key</ud>')
      expect(metaData('default')).toBe('<md>default</md>')
      expect(systemData('127.0.0.1:11210')).toBe('<sd>127.0.0.1:11210</sd>')
    })

    it('renders a value that is not a string', () => {
      setRedaction(true)
      expect(systemData(11210)).toBe('<sd>11210</sd>')
    })

    it('escapes line breaks so the tags stay on one line', () => {
      setRedaction(true)
      expect(userData('a\nb\r\nc')).toBe('<ud>a\\nb\\r\\nc</ud>')
    })

    it('escapes a tag sequence inside the value', () => {
      setRedaction(true)
      expect(userData('a</ud>b<sd>c')).toBe('<ud>a\\u003c/ud>b\\u003csd>c</ud>')
    })

    it('leaves a "<" that does not begin a tag sequence alone', () => {
      setRedaction(true)
      expect(userData('<b>x</b> < y <udx>')).toBe('<ud><b>x</b> < y <udx></ud>')
    })

    it('keeps a tagged JSON document parseable to the original values', () => {
      setRedaction(true)
      const doc = { key: 'line one\nline two </sd> end' }
      const tagged = systemData(JSON.stringify(doc))
      expect(tagged).not.toMatch(/\n/)
      const inner = tagged.slice('<sd>'.length, -'</sd>'.length)
      expect(JSON.parse(inner)).toEqual(doc)
    })
  })

  describe('#threshold-logging-report', () => {
    function reportLine(enabled: boolean): string {
      setRedaction(enabled)
      const captured = capturingLogger()
      const tracer = new ThresholdLoggingTracer(captured.logger, {
        kvThreshold: 0.5,
        sampleSize: 10,
        emitInterval: 100000,
      })
      tracer.reporter.stop()
      const span = new ThresholdLoggingSpan('get', tracer, undefined, [0, 0])
      span.setAttribute(OpAttributeName.Service, ServiceName.KeyValue)
      span.end([0, 1_000_000])
      tracer.reporter.report()
      return onlyLine(captured)
    }

    it('tags the whole report as system data', () => {
      const line = reportLine(true)
      expect(line).toMatch(/^<sd>\{.*\}<\/sd>$/)
      const report = JSON.parse(line.slice('<sd>'.length, -'</sd>'.length))
      expect(report.kv.top_requests[0].operation_name).toBe('get')
    })

    it('logs the bare report while redaction is disabled', () => {
      const report = JSON.parse(reportLine(false))
      expect(report.kv.top_requests[0].operation_name).toBe('get')
    })
  })

  describe('#logging-meter-report', () => {
    it('tags the whole report as metadata', () => {
      setRedaction(true)
      const captured = capturingLogger()
      const meter = new LoggingMeter(captured.logger)
      meter.reporter.stop()
      meter
        .valueRecorder(OpAttributeName.MeterNameOpDuration, {
          [OpAttributeName.Service]: ServiceName.KeyValue,
          [OpAttributeName.OperationName]: 'get',
        })
        .recordValue(100)
      meter.reporter.report()

      const line = onlyLine(captured)
      expect(line).toMatch(/^<md>\{.*\}<\/md>$/)
      const report = JSON.parse(line.slice('<md>'.length, -'</md>'.length))
      expect(report.operations.kv.get.total_count).toBe(1)
    })
  })

  describe('#wait-until-ready-ping-errors', () => {
    it('tags the remote address as system data and the error as user data', () => {
      setRedaction(true)
      const captured = capturingLogger()
      const cluster = { logger: captured.logger } as unknown as Cluster
      const executor = new WaitUntilReadyExecutor(cluster)
      const result = new PingResult({
        version: 2,
        id: 'ping',
        sdk: 'node',
        services: {
          [ServiceType.Query]: [
            {
              type: ServiceType.Query,
              id: 'endpoint',
              remote: '10.0.0.1:8093',
              local: '10.0.0.2:50000',
              latency: 0,
              state: PingState.Error,
              // The core reports a bootstrap failure here, which can carry a
              // bucket name or text from the server.
              error:
                'unable to select bucket: travel-sample, probably the bucket does not exist',
            },
          ],
        },
      })

      executor['_logPingErrors'](result)

      expect(onlyLine(captured)).toBe(
        'waitUntilReady: ping error on service query, remote <sd>10.0.0.1:8093</sd>: ' +
          '<ud>unable to select bucket: travel-sample, probably the bucket does not exist</ud>'
      )
    })
  })
})
