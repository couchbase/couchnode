'use strict'

const { NoOpTracer, NoOpSpan } = require('../../lib/observability')
const {
  OpAttributeName,
  SpanStatusCode,
} = require('../../lib/observabilitytypes')
const {
  ThresholdLoggingSpan,
  ThresholdLoggingTracer,
} = require('../../lib/thresholdlogging')

const IGNORED_TEST_THRESHOLD_LOGGING_SPAN_VALUES = [
  OpAttributeName.DispatchSpanName,
  OpAttributeName.EncodingSpanName,
]

class TestSpan {
  constructor(name, parentSpan = null, startTime = null) {
    this.name = name
    this.parentSpan = parentSpan
    this.startTime = startTime || process.hrtime()
    this.endTime = null
    this.attributes = {}
    this.status = { code: SpanStatusCode.UNSET }
    this.children = []
  }

  setAttribute(key, value) {
    this.attributes[key] = value
  }

  addEvent() {}

  setStatus(status) {
    this.status = status
  }

  end(endTime = null) {
    this.endTime = endTime || process.hrtime()
  }
}

class TestTracer {
  constructor() {
    this.spans = []
  }

  requestSpan(name, parentSpan, startTime) {
    const span = new TestSpan(name, parentSpan, startTime)
    if (parentSpan) {
      parentSpan.children.push(span)
    } else {
      this.spans.push(span)
    }
    return span
  }

  getSpanByName(name) {
    return this.spans.find((s) => s.name === name)
  }

  clear() {
    this.spans = []
  }
}

class NoOpTestSpan extends NoOpSpan {
  constructor(_name, _parentSpan = null, _startTime = null) {
    super()
    this.children = []
  }

  setAttribute(key, value) {
    this.attributes[key] = value
  }

  addEvent() {}

  setStatus(status) {
    this.status = status
  }

  end(endTime = null) {
    this.endTime = endTime || process.hrtime()
  }
}

// Need to extend NoOpTracer so that the ObservabilityHandler will appropriately choose the NoOp implementation.
// In terms of functionality, since the ObservableRequestHandlerNoOpImpl never calls requestSpan, all we need
// for testing purposes is to handle the scenario where parent spans are created.
class NoOpTestTracer extends NoOpTracer {
  constructor() {
    super()
    this.spans = []
  }

  requestSpan(name, parentSpan, startTime) {
    const span = new NoOpTestSpan(name, parentSpan, startTime)
    if (parentSpan) {
      parentSpan.children.push(span)
    } else {
      this.spans.push(span)
    }
    return span
  }

  getSpanByName(name) {
    return this.spans.find((s) => s.name === name)
  }

  clear() {
    this.spans = []
  }
}

class ThresholdLoggingTestSpan extends ThresholdLoggingSpan {
  constructor(name, tracer, parentSpan, startTime) {
    super(name, tracer, parentSpan, startTime)
    this.testAttributes = {}
    this.children = []
  }

  end(endTime = null) {
    super.end(endTime)
    if (
      !this.name.endsWith('parent-span') &&
      this._parentSpan &&
      !IGNORED_TEST_THRESHOLD_LOGGING_SPAN_VALUES.includes(this.name)
    ) {
      this._tracer.checkThreshold(this.snapshot)
    }
  }

  setAttribute(key, value) {
    super.setAttribute(key, value)
    this.testAttributes[key] = value
  }
}

class ThresholdLoggingTestTracer extends ThresholdLoggingTracer {
  constructor(opts = {}) {
    super(opts)
    // we don't want to periodically log the report, we want to validate
    this._reporter.stop()
    this.spans = []
    this.underThresholdSpans = []
    this.overThresholdSpans = []
  }

  requestSpan(name, parentSpan, startTime) {
    const span = new ThresholdLoggingTestSpan(name, this, parentSpan, startTime)
    if (parentSpan) {
      parentSpan.children.push(span)
    } else {
      this.spans.push(span)
    }
    return span
  }

  getSpanByName(name) {
    return this.spans.find((s) => s.name === name)
  }

  clear() {
    this.spans = []
    this.underThresholdSpans = []
    this.overThresholdSpans = []
  }

  checkThreshold(spanSnapshot) {
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
    this._reporter.addLogRecord(
      spanSnapshot.serviceType,
      thresholdLogRecord,
      spanTotalDuration
    )
  }
}

module.exports = {
  TestSpan,
  TestTracer,
  NoOpTestSpan,
  NoOpTestTracer,
  ThresholdLoggingTestSpan,
  ThresholdLoggingTestTracer,
}
