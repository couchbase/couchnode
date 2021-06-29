export interface LoggingMeterOptions {
  /**
   * Specifies how often logging meter information should be logged,
   * specified in millseconds.
   */
  emitInterval?: number
}

/**
 * Provides an interface for recording values.
 */
export interface ValueRecorder {
  /**
   * Records a new value.
   *
   * @param value The value to record.
   */
  recordValue(value: number): void
}

/**
 * Providers an interface to create value recorders for recording metrics.
 */
export interface Meter {
  /**
   * Creates a new value recorder for a metric with the specified tags.
   *
   * @param name The name of the metric.
   * @param tags The tags to associate with the metric.
   */
  valueRecorder(name: string, tags: { [key: string]: string }): ValueRecorder
}

/**
 * Implements a no-op meter which performs no metrics instrumentation.  Note that
 * to reduce the performance impact of using this neter, this class is not
 * actually used by the SDK, and simply acts as a placeholder which triggers a
 * native implementation to be used instead.
 */
export class NoopMeter implements Meter {
  /**
   * @internal
   */
  valueRecorder(name: string, tags: { [key: string]: string }): ValueRecorder {
    name
    tags
    throw new Error('invalid usage')
  }
}

/**
 * Implements a default meter which logs metrics on a regular basis.  Note that
 * to reduce the performance impact of using this neter, this class is not
 * actually used by the SDK, and simply acts as a placeholder which triggers a
 * native implementation to be used instead.
 */
export class LoggingMeter implements Meter {
  /**
   * @internal
   */
  _options: LoggingMeterOptions

  constructor(options: LoggingMeterOptions) {
    this._options = options
  }

  /**
   * @internal
   */
  valueRecorder(name: string, tags: { [key: string]: string }): ValueRecorder {
    name
    tags
    throw new Error('invalid usage')
  }
}
