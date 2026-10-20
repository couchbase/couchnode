// The three test tracers, one per SDK tracing behavior. Pass one to
// `Cluster.connect` and read its spans back.
//
// `NoOpTestTracer` must extend `NoOpTracer`: `observabilityhandler.ts` picks
// the no-op path by `instanceof NoOpTracer`, so any span recorded under it
// means the handler took the recording path for a tracer that opted out.
//
// `ThresholdLoggingTestTracer` extends the shipped tracer, so suites assert
// the real threshold arithmetic, and additionally records which side of the
// threshold each span fell on.

import type { HiResTime } from '../../../lib/binding'
import type { TracingConfig } from '../../../lib/cluster'
import { CouchbaseLogger, NoOpLogger } from '../../../lib/logger'
import { NoOpSpan, NoOpTracer } from '../../../lib/observability'
import {
  AttributeValue,
  OpAttributeName,
  SpanStatus,
  SpanStatusCode,
  TimeInput,
} from '../../../lib/observabilitytypes'
import { timeInputToHiResTime } from '../../../lib/observabilityutilities'
import {
  ThresholdLoggingSpan,
  ThresholdLoggingTracer,
} from '../../../lib/thresholdlogging'
import type { RequestSpan, RequestTracer } from '../../../lib/tracing'

/**
 * `ThresholdLoggingSpanSnapshot`, which `lib/thresholdlogging.ts` does not
 * export, derived from the getter that returns it.
 */
export type SpanSnapshot = NonNullable<ThresholdLoggingSpan['snapshot']>

export type SpanAttributes = Record<string, AttributeValue>

/**
 * Spans the shipped tracer folds into their parent and never checks against a
 * threshold. The test span excludes them too.
 */
const IGNORED_TEST_THRESHOLD_LOGGING_SPAN_VALUES: readonly string[] = [
  OpAttributeName.DispatchSpanName,
  OpAttributeName.EncodingSpanName,
]

/**
 * A span that keeps everything it is given, for later assertion. Times are
 * normalized to the high-resolution pair the validators assert.
 */
export class TestSpan implements RequestSpan {
  readonly startTime: HiResTime
  endTime: HiResTime | null = null
  readonly attributes: SpanAttributes = {}
  status: SpanStatus = { code: SpanStatusCode.UNSET }
  readonly children: TestSpan[] = []

  constructor(
    readonly name: string,
    readonly parentSpan: TestSpan | null = null,
    startTime?: TimeInput
  ) {
    this.startTime = timeInputToHiResTime(startTime)
  }

  setAttribute(key: string, value: AttributeValue): void {
    this.attributes[key] = value
  }

  addEvent(): void {}

  setStatus(status: SpanStatus): void {
    this.status = status
  }

  end(endTime?: TimeInput): void {
    this.endTime = timeInputToHiResTime(endTime)
  }
}

export class TestTracer implements RequestTracer {
  /** The root spans, in creation order. A child is held by its parent. */
  spans: TestSpan[] = []

  requestSpan(
    name: string,
    parentSpan?: TestSpan,
    startTime?: TimeInput
  ): TestSpan {
    const span = new TestSpan(name, parentSpan ?? null, startTime)
    if (parentSpan) {
      parentSpan.children.push(span)
    } else {
      this.spans.push(span)
    }
    return span
  }

  getSpanByName(name: string): TestSpan | undefined {
    return this.spans.find((span) => span.name === name)
  }

  clear(): void {
    this.spans = []
  }
}

/**
 * A span under a no-op tracer. It holds children and nothing else: the only
 * instances are parent spans a test creates by hand.
 */
export class NoOpTestSpan extends NoOpSpan {
  readonly children: NoOpTestSpan[] = []
}

export class NoOpTestTracer extends NoOpTracer {
  spans: NoOpTestSpan[] = []

  // JSCBC-1493: `NoOpTracer.requestSpan()` declares no parameters,
  // though the `RequestTracer` interface it implements declares three. A
  // subclass that uses any of them is a type error, so the name has to be
  // optional here to be accepted as an override at all.
  override requestSpan(
    _name?: string,
    parentSpan?: NoOpTestSpan,
    _startTime?: TimeInput
  ): NoOpTestSpan {
    const span = new NoOpTestSpan()
    if (parentSpan) {
      parentSpan.children.push(span)
    } else {
      this.spans.push(span)
    }
    return span
  }

  clear(): void {
    this.spans = []
  }
}

/**
 * A threshold span that reports itself on every operation. The shipped span
 * skips `checkThreshold` under a caller's own parent span, which would leave
 * the parent-span cases nothing to assert.
 */
export class ThresholdLoggingTestSpan extends ThresholdLoggingSpan {
  readonly testAttributes: SpanAttributes = {}
  readonly children: ThresholdLoggingTestSpan[] = []

  override setAttribute(key: string, value: AttributeValue): void {
    super.setAttribute(key, value)
    this.testAttributes[key] = value
  }

  override end(endTime?: TimeInput): void {
    super.end(endTime)
    const snapshot = this.snapshot
    if (
      snapshot &&
      !this.name.endsWith('parent-span') &&
      this._parentSpan &&
      !IGNORED_TEST_THRESHOLD_LOGGING_SPAN_VALUES.includes(this.name)
    ) {
      this._tracer.checkThreshold(snapshot)
    }
  }
}

export class ThresholdLoggingTestTracer extends ThresholdLoggingTracer {
  spans: ThresholdLoggingTestSpan[] = []
  underThresholdSpans: SpanSnapshot[] = []
  overThresholdSpans: SpanSnapshot[] = []

  /** Thresholds come from `config`; null takes the shipped defaults. */
  constructor(config: TracingConfig | null = null) {
    super(new CouchbaseLogger(new NoOpLogger()), config)
    // Reports are validated, not emitted, so stop the periodic emit. Its timer
    // is a handle that would keep the process alive.
    this.reporter.stop()
  }

  override requestSpan(
    name: string,
    parentSpan?: ThresholdLoggingTestSpan,
    startTime?: TimeInput
  ): ThresholdLoggingTestSpan {
    const span = new ThresholdLoggingTestSpan(name, this, parentSpan, startTime)
    if (parentSpan) {
      parentSpan.children.push(span)
    } else {
      this.spans.push(span)
    }
    return span
  }

  getSpanByName(name: string): ThresholdLoggingTestSpan | undefined {
    return this.spans.find((span) => span.name === name)
  }

  clear(): void {
    this.spans = []
    this.underThresholdSpans = []
    this.overThresholdSpans = []
  }

  /**
   * Records which side of its threshold a span fell on, then reports it.
   * Unlike the shipped tracer, under-threshold spans are kept, because
   * "measured, and fast" is the most common assertion.
   */
  override checkThreshold(spanSnapshot: SpanSnapshot): void {
    if (typeof spanSnapshot.serviceType === 'undefined') {
      return
    }
    if (spanSnapshot.name.endsWith('-parent-span')) {
      return
    }

    const serviceThreshold = this._getServiceTypeThreshold(
      spanSnapshot.serviceType
    )
    const spanTotalDuration = spanSnapshot.totalDuration ?? 0

    if (spanTotalDuration > serviceThreshold) {
      this.overThresholdSpans.push(spanSnapshot)
    } else {
      this.underThresholdSpans.push(spanSnapshot)
    }

    const thresholdLogRecord = this._buildThresholdLogRecord(
      spanSnapshot,
      spanTotalDuration
    )
    this.reporter.addLogRecord(
      spanSnapshot.serviceType,
      thresholdLogRecord,
      spanTotalDuration
    )
  }
}

/** Any of the three, so a suite can be written once and run against each. */
export type AnyTestTracer =
  | TestTracer
  | NoOpTestTracer
  | ThresholdLoggingTestTracer

export type AnyTestSpan = TestSpan | NoOpTestSpan | ThresholdLoggingTestSpan
