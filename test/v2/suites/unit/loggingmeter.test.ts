import { describe, expect, it } from 'vitest'

import { MeterError } from '../../../../lib/errors'
import { CouchbaseLogger, NoOpLogger } from '../../../../lib/logger'
import { LoggingMeter } from '../../../../lib/loggingmeter'
import {
  OpAttributeName,
  ServiceName,
} from '../../../../lib/observabilitytypes'

type Report = NonNullable<ReturnType<LoggingMeter['createReport']>>

/**
 * A meter whose periodic reporter is stopped before anything is recorded. Not
 * optional: the reporter's `setInterval` would hold the event loop open.
 */
function newMeter(emitInterval?: number): LoggingMeter {
  const meter = new LoggingMeter(
    new CouchbaseLogger(new NoOpLogger()),
    emitInterval
  )
  meter.reporter.stop()
  return meter
}

function durationRecorder(meter: LoggingMeter, service: string, op: string) {
  return meter.valueRecorder(OpAttributeName.MeterNameOpDuration, {
    [OpAttributeName.Service]: service,
    [OpAttributeName.OperationName]: op,
  })
}

/** The report, with "there was no report at all" reported as such. */
function reportOf(meter: LoggingMeter): Report {
  const report = meter.createReport()
  expect(report, 'the meter produced no report').not.toBeNull()
  return report as Report
}

describe('Logging Meter', () => {
  it('should have correct report structure', () => {
    const emitInterval = 1000
    const meter = newMeter(emitInterval)

    durationRecorder(meter, ServiceName.KeyValue, 'get').recordValue(100)

    const report = reportOf(meter)
    expect(report).toBeTypeOf('object')
    expect(report).toHaveProperty('meta')
    expect(report.meta).toHaveProperty('emit_interval_s')
    expect(report.meta.emit_interval_s).toBe(emitInterval / 1000)

    expect(report).toHaveProperty('operations')
    expect(report.operations).toHaveProperty(ServiceName.KeyValue)
    expect(report.operations[ServiceName.KeyValue]).toHaveProperty('get')

    const stats = report.operations[ServiceName.KeyValue].get
    expect(stats).toHaveProperty('total_count')
    expect(stats.total_count).toBe(1)
    expect(stats).toHaveProperty('percentiles_us')
    expect(stats.percentiles_us).toBeTypeOf('object')
    // Written out rather than looped: each percentile is a separate claim about
    // the report's shape, and a loop would report them as one.
    expect(stats.percentiles_us).toHaveProperty('50')
    expect(stats.percentiles_us).toHaveProperty('90')
    expect(stats.percentiles_us).toHaveProperty('99')
    expect(stats.percentiles_us).toHaveProperty('99.9')
    expect(stats.percentiles_us).toHaveProperty('100')
  })

  it('should record multiple values and report percentiles', () => {
    const meter = newMeter()
    const recorder = durationRecorder(meter, ServiceName.KeyValue, 'get')
    recorder.recordValue(100)
    recorder.recordValue(200)
    recorder.recordValue(300)

    const stats = reportOf(meter).operations[ServiceName.KeyValue].get
    expect(stats.total_count).toBe(3)
    // Three samples, so the percentiles may coincide.
    expect(stats.percentiles_us['100']).toBeGreaterThanOrEqual(300)
    expect(stats.percentiles_us['50']).toBeGreaterThanOrEqual(100)
  })

  it('should reset after creating a report', () => {
    const meter = newMeter()
    durationRecorder(meter, ServiceName.KeyValue, 'get').recordValue(100)

    const first = reportOf(meter)
    expect(first.operations[ServiceName.KeyValue].get.total_count).toBe(1)

    // Nothing recorded since, so there is nothing to report, which is a null
    // report rather than one with an empty operations map.
    expect(meter.createReport()).toBeNull()
  })

  it('should track multiple services and operations', () => {
    const meter = newMeter()
    durationRecorder(meter, ServiceName.KeyValue, 'get').recordValue(100)
    durationRecorder(meter, ServiceName.Query, 'query').recordValue(5000)

    const report = reportOf(meter)
    expect(report.operations).toHaveProperty(ServiceName.KeyValue)
    expect(report.operations).toHaveProperty(ServiceName.Query)
    expect(report.operations[ServiceName.KeyValue].get.total_count).toBe(1)
    expect(report.operations[ServiceName.Query].query.total_count).toBe(1)
  })

  it('should raise error if no service name attribute', () => {
    const meter = newMeter()

    // Regression guard (JSCBC-1448): asserts the throw itself, so the test
    // fails if `valueRecorder` returns normally.
    expect(() => meter.valueRecorder('get', {})).toThrow(MeterError)

    expect(meter.createReport()).toBeNull()
  })

  it('should reuse recorders for the same service and operation', () => {
    const meter = newMeter()
    const first = durationRecorder(meter, ServiceName.KeyValue, 'get')
    const second = durationRecorder(meter, ServiceName.KeyValue, 'get')

    first.recordValue(100)
    second.recordValue(200)

    const report = reportOf(meter)
    expect(report.operations[ServiceName.KeyValue].get.total_count).toBe(2)
  })
})
