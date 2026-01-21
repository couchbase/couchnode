/**
 * @internal
 */

import * as hdr from 'hdr-histogram-js'
import { MeterError } from './errors'
import { CouchbaseLogger } from './logger'
import { Meter, ValueRecorder } from './metrics'
import { OpAttributeName, ServiceName } from './observabilitytypes'

/**
 * Represents the percentile values for a set of recorded metrics.
 *
 * @internal
 */
interface PercentileReport {
  /**
   * Total count of all recorded values.
   */
  total_count: number
  /**
   * Mapping of percentile value (e.g., "50", "90") to recorded value.
   */
  percentiles_us: Record<string, number>
}

/**
 * Represents a complete logging meter report with metadata.
 *
 * @internal
 */
interface LoggingMeterReport {
  /**
   * Metadata about the report.
   */
  meta: {
    /**
     * The interval (in seconds) at which reports are emitted.
     */
    emit_interval_s: number
  }
  /**
   * Operations organized by service type.
   */
  operations: Record<string, Record<string, PercentileReport>>
}

/**
 * Internal class for recording metric values using HDR histograms.
 *
 * @internal
 */
class LoggingValueRecorder implements ValueRecorder {
  private readonly _histogram: hdr.Histogram
  private readonly _percentiles = [50.0, 90.0, 99.0, 99.9, 100.0]

  constructor() {
    this._histogram = hdr.build({
      lowestDiscernibleValue: 1, // 1 microsecond
      highestTrackableValue: 30_000_000, // 30 seconds
      numberOfSignificantValueDigits: 3,
    })
  }

  /**
   * Records a metric value.
   *
   * @param value - The value to record (typically latency in microseconds).
   */
  recordValue(value: number): void {
    this._histogram.recordValue(value)
  }

  /**
   * Gets the current percentile values and resets the histogram.
   *
   * @returns The percentile report containing total count and percentile values.
   */
  getPercentilesAndReset(): PercentileReport {
    const mappedPercentiles: Record<string, number> = {}

    for (const p of this._percentiles) {
      mappedPercentiles[p.toString()] = this._histogram.getValueAtPercentile(p)
    }

    const result: PercentileReport = {
      total_count: this._histogram.totalCount,
      percentiles_us: mappedPercentiles,
    }

    this._histogram.reset()
    return result
  }
}

/**
 * Internal class for periodically emitting meter reports.
 *
 * @internal
 */
class LoggingMeterReporter {
  private readonly _loggingMeter: LoggingMeter
  private readonly _emitInterval: number
  private readonly _logger: CouchbaseLogger

  private _timerId: NodeJS.Timeout | undefined
  private _stopped: boolean

  constructor(
    loggingMeter: LoggingMeter,
    emitInterval: number,
    logger: CouchbaseLogger
  ) {
    this._loggingMeter = loggingMeter
    this._emitInterval = emitInterval
    this._logger = logger
    this._stopped = false
  }

  /**
   * @internal
   */
  start() {
    this._timerId = setInterval(this.report.bind(this), this._emitInterval)
    // let the process exit even if the reporter has not been shutdown
    this._timerId.unref()
    this._stopped = false
  }

  /**
   * @internal
   */
  stop() {
    if (this._stopped) {
      return
    }
    this._stopped = true
    clearInterval(this._timerId)
  }

  /**
   * @internal
   */
  report(): void {
    const report = this._loggingMeter.createReport()
    if (report) {
      this._logger.info(JSON.stringify(report))
    }
  }

  /**
   * @internal
   */
  toJSON(): Record<string, any> {
    return {}
  }
}

/**
 * A logging-based meter implementation that records metrics using HDR histograms
 * and periodically reports percentile statistics.
 *
 * @internal
 */
export class LoggingMeter implements Meter {
  private readonly _recorders: Map<
    ServiceName,
    Map<string, LoggingValueRecorder>
  > = new Map()
  private readonly _reporter: LoggingMeterReporter
  private readonly _emitInterval: number

  /**
   * Creates a new LoggingMeter with the specified flush interval.
   *
   * @param logger - The logger to be used by the LoggingMeter.
   * @param emitInterval - The interval in milliseconds between reports (default: 600000ms = 10 minutes).
   */
  constructor(logger: CouchbaseLogger, emitInterval?: number) {
    this._emitInterval = emitInterval ?? 600_000 // Default to 10 minutes

    // Initialize recorders map for each service type
    for (const serviceType of Object.values(ServiceName)) {
      this._recorders.set(serviceType, new Map())
    }

    this._reporter = new LoggingMeterReporter(this, this._emitInterval, logger)
    this._reporter.start()
  }

  /**
   * Gets the meter's LoggingMeterReporter.
   *
   * @internal
   */
  get reporter(): LoggingMeterReporter {
    return this._reporter
  }

  /**
   * Gets or creates a value recorder for the specified metric name and tags.
   *
   * @param _name - Unused.
   * @param tags - Key-value pairs that categorize the metric.
   * @returns A value recorder for recording values.
   */
  valueRecorder(_name: string, tags: Record<string, string>): ValueRecorder {
    // The ObservabilityHandler, at least for now, only passes in OpAttributeName.MeterNameOpDuration for the name
    // for OTel compat. However, for the loging meter we care about the opName.
    const serviceTag = tags[OpAttributeName.Service]
    if (!Object.values(ServiceName).includes(serviceTag as ServiceName)) {
      throw new MeterError(new Error(`Invalid service type: ${serviceTag}`))
    }
    const service = serviceTag as ServiceName
    const opMap = this._recorders.get(service)!

    const opName = tags[OpAttributeName.OperationName]
    let recorder = opMap.get(opName)
    if (!recorder) {
      recorder = new LoggingValueRecorder()
      opMap.set(opName, recorder)
    }
    return recorder
  }

  /**
   * Creates a report of all recorded metrics and resets the histograms.
   *
   * @returns The logging meter report with percentile statistics.
   */
  createReport(): LoggingMeterReport | null {
    const report: LoggingMeterReport = {
      meta: {
        emit_interval_s: this._emitInterval / 1_000,
      },
      operations: {},
    }

    for (const [serviceType, opMap] of this._recorders.entries()) {
      const svcReport: Record<string, PercentileReport> = {}
      for (const [opName, recorder] of opMap.entries()) {
        const percentileReport = recorder.getPercentilesAndReset()
        if (percentileReport.total_count > 0) {
          svcReport[opName] = percentileReport
        }
      }
      if (Object.keys(svcReport).length > 0) {
        report.operations[serviceType] = svcReport
      }
    }

    if (Object.keys(report.operations).length === 0) {
      return null
    }

    return report
  }

  /**
   * Stops the threshold logging reporter and cleans up resources.
   *
   * This method should be called when shutting down the application or when
   * the tracer is no longer needed to ensure the periodic reporting timer
   * is properly cleared.
   */
  cleanup(): void {
    try {
      this._reporter.stop()
    } catch (_e) {
      // Don't raise exceptions during shutdown
    }
  }

  /**
   * @internal
   */
  toJSON(): Record<string, any> {
    return { emitInterval: this._emitInterval }
  }
}
