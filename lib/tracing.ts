export interface ThresholdLoggingTracerOptions {
  /**
   * Specifies how often aggregated trace information should be logged,
   * specified in millseconds.
   */
  emitInterval?: number

  /**
   * Specifies the threshold for when a kv request should be included
   * in the aggregated metrics, specified in millseconds.
   */
  kvThreshold?: number

  /**
   * Specifies the threshold for when a query request should be included
   * in the aggregated metrics, specified in millseconds.
   */
  queryThreshold?: number

  /**
   * Specifies the threshold for when a views request should be included
   * in the aggregated metrics, specified in millseconds.
   */
  viewsThreshold?: number

  /**
   * Specifies the threshold for when a search request should be included
   * in the aggregated metrics, specified in millseconds.
   */
  searchThreshold?: number

  /**
   * Specifies the threshold for when an analytics request should be included
   * in the aggregated metrics, specified in millseconds.
   */
  analyticsThreshold?: number

  /**
   * Specifies the number of entries which should be kept between each
   * logging interval.
   */
  sampleSize?: number
}

/**
 * Represents a span of time an event occurs over.
 */
export interface RequestSpan {
  /**
   * Adds an tag to this span.
   *
   * @param key The key of the tag to add.
   * @param value The value to assign to the tag.
   */
  addTag(key: string, value: string | number | boolean): void

  /**
   * Ends this span.
   */
  end(): void
}

/**
 * Represents a tracer capable of creating trace spans.
 */
export interface RequestTracer {
  /**
   * Creates a new request span.
   *
   * @param name The name of the span.
   * @param parent The parent of the span, if one exists.
   */
  requestSpan(name: string, parent: RequestSpan | undefined): RequestSpan
}

/**
 * This implements a basic default tracer which keeps track of operations
 * which falls outside a specified threshold.  Note that to reduce the
 * performance impact of using this tracer, this class is not actually
 * used by the SDK, and simply acts as a placeholder which triggers a
 * native implementation to be used instead.
 */
export class ThresholdLoggingTracer implements RequestTracer {
  /**
   * @internal
   */
  _options: ThresholdLoggingTracerOptions

  constructor(options: ThresholdLoggingTracerOptions) {
    this._options = options
  }

  /**
   * @internal
   */
  requestSpan(name: string, parent: RequestSpan | undefined): RequestSpan {
    name
    parent
    throw new Error('invalid usage')
  }
}

/**
 * Implements a no-op tracer which performs no work.  Note that to reduce the
 * performance impact of using this tracer, this class is not actually
 * used by the SDK, and simply acts as a placeholder which triggers a
 * native implementation to be used instead.
 */
export class NoopTracer implements RequestTracer {
  /**
   * @internal
   */
  requestSpan(name: string, parent: RequestSpan | undefined): RequestSpan {
    name
    parent
    throw new Error('invalid usage')
  }
}
