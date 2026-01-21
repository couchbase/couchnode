'use strict'

const assert = require('chai').assert
const { LoggingMeter } = require('../lib/loggingmeter')
const { CouchbaseLogger, NoOpLogger } = require('../lib/logger')
const { OpAttributeName, ServiceName } = require('../lib/observabilitytypes')
const { MeterError } = require('../lib/errors')

describe('Logging Meter', function () {
  it('should have correct report structure', function () {
    const logger = new CouchbaseLogger(new NoOpLogger())
    const emitInterval = 1000
    const meter = new LoggingMeter(logger, emitInterval)
    meter.reporter.stop()

    const recorder = meter.valueRecorder(OpAttributeName.MeterNameOpDuration, {
      [OpAttributeName.Service]: ServiceName.KeyValue,
      [OpAttributeName.OperationName]: 'get',
    })
    recorder.recordValue(100)

    const report = meter.createReport()
    assert.isObject(report)
    assert.property(report, 'meta')
    assert.property(report.meta, 'emit_interval_s')
    assert.equal(report.meta.emit_interval_s, emitInterval / 1000)

    assert.property(report, 'operations')
    assert.property(report.operations, ServiceName.KeyValue)
    assert.property(report.operations[ServiceName.KeyValue], 'get')

    const stats = report.operations[ServiceName.KeyValue].get
    assert.property(stats, 'total_count')
    assert.equal(stats.total_count, 1)
    assert.property(stats, 'percentiles_us')
    assert.isObject(stats.percentiles_us)
    assert.property(stats.percentiles_us, '50')
    assert.property(stats.percentiles_us, '90')
    assert.property(stats.percentiles_us, '99')
    assert.property(stats.percentiles_us, '99.9')
    assert.property(stats.percentiles_us, '100')
  })

  it('should record multiple values and report percentiles', function () {
    const logger = new CouchbaseLogger(new NoOpLogger())
    const meter = new LoggingMeter(logger)
    meter.reporter.stop()

    const recorder = meter.valueRecorder(OpAttributeName.MeterNameOpDuration, {
      [OpAttributeName.Service]: ServiceName.KeyValue,
      [OpAttributeName.OperationName]: 'get',
    })
    recorder.recordValue(100)
    recorder.recordValue(200)
    recorder.recordValue(300)

    const report = meter.createReport()
    const stats = report.operations[ServiceName.KeyValue].get
    assert.equal(stats.total_count, 3)
    // With small sample size, percentiles might be the same or close
    assert.isAtLeast(stats.percentiles_us['100'], 300)
    assert.isAtLeast(stats.percentiles_us['50'], 100)
  })

  it('should reset after creating a report', function () {
    const logger = new CouchbaseLogger(new NoOpLogger())
    const meter = new LoggingMeter(logger)
    meter.reporter.stop()

    const recorder = meter.valueRecorder(OpAttributeName.MeterNameOpDuration, {
      [OpAttributeName.Service]: ServiceName.KeyValue,
      [OpAttributeName.OperationName]: 'get',
    })
    recorder.recordValue(100)

    const report1 = meter.createReport()
    assert.equal(report1.operations[ServiceName.KeyValue].get.total_count, 1)

    const report2 = meter.createReport()
    assert.isNull(report2)
  })

  it('should track multiple services and operations', function () {
    const logger = new CouchbaseLogger(new NoOpLogger())
    const meter = new LoggingMeter(logger)
    meter.reporter.stop()

    const kvRecorder = meter.valueRecorder(
      OpAttributeName.MeterNameOpDuration,
      {
        [OpAttributeName.Service]: ServiceName.KeyValue,
        [OpAttributeName.OperationName]: 'get',
      }
    )
    const queryRecorder = meter.valueRecorder(
      OpAttributeName.MeterNameOpDuration,
      {
        [OpAttributeName.Service]: ServiceName.Query,
        [OpAttributeName.OperationName]: 'query',
      }
    )

    kvRecorder.recordValue(100)
    queryRecorder.recordValue(5000)

    const report = meter.createReport()
    assert.property(report.operations, ServiceName.KeyValue)
    assert.property(report.operations, ServiceName.Query)
    assert.equal(report.operations[ServiceName.KeyValue].get.total_count, 1)
    assert.equal(report.operations[ServiceName.Query].query.total_count, 1)
  })

  it('should raise error if no service name attribute', function () {
    const logger = new CouchbaseLogger(new NoOpLogger())
    const meter = new LoggingMeter(logger)
    meter.reporter.stop()

    try {
      meter.valueRecorder('get', {})
    } catch (err) {
      assert.instanceOf(err, MeterError)
    }

    const report = meter.createReport()
    assert.isNull(report)
  })

  it('should reuse recorders for the same service and operation', function () {
    const logger = new CouchbaseLogger(new NoOpLogger())
    const meter = new LoggingMeter(logger)
    meter.reporter.stop()

    const recorder1 = meter.valueRecorder(OpAttributeName.MeterNameOpDuration, {
      [OpAttributeName.Service]: ServiceName.KeyValue,
      [OpAttributeName.OperationName]: 'get',
    })
    const recorder2 = meter.valueRecorder(OpAttributeName.MeterNameOpDuration, {
      [OpAttributeName.Service]: ServiceName.KeyValue,
      [OpAttributeName.OperationName]: 'get',
    })

    recorder1.recordValue(100)
    recorder2.recordValue(200)

    const report = meter.createReport()
    assert.equal(report.operations[ServiceName.KeyValue].get.total_count, 2)
  })
})
