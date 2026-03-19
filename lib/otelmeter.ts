import { Meter, ValueRecorder } from './metrics'
import { SDK_NAME, SDK_VERSION } from './version'

// This block is completely erased when compiled to JavaScript.
/* eslint-disable n/no-missing-import */
import type {
  Histogram as OTelHistogram,
  Meter as OTelMeter,
  MeterProvider as OTelMeterProvider,
} from '@opentelemetry/api'
/* eslint-enable n/no-missing-import */

// Dynamic Runtime Require (Bundler-safe)
let otelApi: typeof import('@opentelemetry/api') | null = null
let HAS_OTEL = false

try {
  // Hiding the string prevents Webpack/Vite from throwing missing dependency errors
  const moduleName = '@opentelemetry/api'
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  otelApi = require(moduleName) as typeof import('@opentelemetry/api')
  HAS_OTEL = true
} catch (_err) {
  HAS_OTEL = false
}

/**
 * Wrapper class for OpenTelemetry Histogram that implements ValueRecorder interface.
 */
export class OTelValueRecorder implements ValueRecorder {
  private _histogram: OTelHistogram
  private _tags: Record<string, string>
  private _unit?: string

  /**
   * Creates an instance of OTelValueRecorder.
   *
   * @param histogram - OpenTelemetry Histogram to record values.
   * @param tags - Tags to associate with recorded values.
   * @param unit - Optional unit of measurement (e.g., 's' for seconds). If provided, it indicates that the recorded values
   *                should be converted from microseconds to seconds.
   */
  constructor(
    histogram: OTelHistogram,
    tags: Record<string, string>,
    unit?: string
  ) {
    this._histogram = histogram
    this._tags = tags
    this._unit = unit
  }

  /**
   * Records a value with the associated tags.
   *
   * @param value - The numeric value to record.
   */
  recordValue(value: number): void {
    // The SDK records value in micros and will place a special __unit tag in the tags set to 's'
    // So self._unit == 's' is indication that we should convert from micros to seconds
    const finalValue = this._unit === 's' ? value / 1_000_000 : value
    this._histogram.record(finalValue, this._tags)
  }
}

/**
 * Wrapper class for OpenTelemetry Meter that implements Meter interface.
 */
export class OTelWrapperMeter implements Meter {
  private _otelMeter: OTelMeter
  private _histograms: Record<string, OTelHistogram>

  /**
   * Creates an instance of OTelWrapperMeter.
   *
   * @param meter - OpenTelemetry Meter to wrap.
   */
  constructor(meter: OTelMeter) {
    this._otelMeter = meter
    this._histograms = {}
  }

  /**
   * Creates a ValueRecorder for recording metric values.
   *
   * @param name - The name of the metric.
   * @param tags - Tags to associate with recorded values.
   * @returns A ValueRecorder instance for recording metrics.
   */
  valueRecorder(name: string, tags: Record<string, any>): ValueRecorder {
    const localTags = tags ? { ...tags } : {}
    const unit = localTags.__unit
    delete localTags.__unit
    if (!this._histograms[name]) {
      this._histograms[name] = this._otelMeter.createHistogram(name, {
        unit: unit,
      })
    }
    const histogram = this._histograms[name]
    return new OTelValueRecorder(histogram, localTags, unit)
  }
}

/**
 * Creates an OpenTelemetry wrapper meter.
 * Throws an Error if @opentelemetry/api is not installed.
 */
export function getOTelMeter(provider?: OTelMeterProvider): Meter {
  if (!HAS_OTEL || !otelApi) {
    throw new Error(
      'OpenTelemetry is not installed. Please install it with: ' +
        'npm install @opentelemetry/api'
    )
  }

  const pkgName = `${SDK_NAME}-nodejs-client`
  const pkgVersion = SDK_VERSION

  if (provider) {
    return new OTelWrapperMeter(provider.getMeter(pkgName, pkgVersion))
  }

  // Fallback to the global OpenTelemetry metrics provider
  return new OTelWrapperMeter(otelApi.metrics.getMeter(pkgName, pkgVersion))
}
