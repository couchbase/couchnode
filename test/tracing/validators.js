'use strict'

const assert = require('chai').assert
const { NoOpSpan, NoOpTracer } = require('../../lib/observability')

const {
  DispatchAttributeName,
  KeyValueOp,
  OpAttributeName,
  SpanStatusCode,
  serviceNameFromOpType,
} = require('../../lib/observabilitytypes')
const {
  getHiResTimeDelta,
  hiResTimeToMicros,
} = require('../../lib/observabilityutilities')

const {
  NoOpTestTracer,
  ThresholdLoggingTestTracer,
  TestTracer,
} = require('./tracingtypes')

const DISPATCH_SPAN_NAME = 'dispatch_to_server'
const ENCODING_SPAN_NAME = 'request_encoding'
const ENCODING_OPS = [
  KeyValueOp.Insert,
  KeyValueOp.MutateIn,
  KeyValueOp.Replace,
  KeyValueOp.Upsert,
]

class BaseValidator {
  constructor(tracer, { ctxSeparator = ' | ' } = {}) {
    this._tracer = tracer
    this._ctxSeparator = ctxSeparator
    this._applyDefaults()
  }

  _defaults() {
    return {
      _opName: null,
      _parentSpan: null,
      _validateError: false,
      _durability: null,
      _nestedOps: null,
      _serverDurationAboveZero: true,
      _retryCountAboveZero: false,
      _childKvOpNames: null,
      _validateChildKvOpError: false,
      _errorBeforeDispatch: false,
      _statement: null,
      _bucketName: null,
      _scopeName: null,
      _collectionName: null,
    }
  }

  _applyDefaults() {
    Object.assign(this, this._defaults())
  }

  reset({ clearSpans = true } = {}) {
    this._applyDefaults()
    if (clearSpans && this._tracer && this._tracer.clear) {
      this._tracer.clear()
    }
    return this
  }

  _ctx(span, extra) {
    const parts = []
    if (span) {
      parts.push(`span=${span.name}`)
      if (span.attributes) {
        const attrKeys = Object.keys(span.attributes)
        parts.push(`attrs=${attrKeys.join(',')}`)
      }
      if (span.children) {
        parts.push(`children=${span.children.length}`)
      }
    }
    if (extra) {
      parts.push(extra)
    }
    return parts.join(this._ctxSeparator)
  }

  _getSpanFromTracer(tracer, opName, parentSpan = null) {
    const ctx = `op=${opName}`
    assert.isOk(tracer.spans, `tracer.spans should be defined. ${ctx}`)

    let span
    if (parentSpan) {
      assert.strictEqual(
        tracer.spans.length,
        1,
        `Expected exactly 1 span when using parent span. ${ctx}`
      )
      assert.strictEqual(
        tracer.spans[0],
        parentSpan,
        `First span should be parent span. ${ctx}`
      )
      assert.isOk(
        tracer.spans[0].children,
        `Parent span should have children. ${ctx}`
      )
      span = tracer.spans[0].children[0]
    } else {
      span = tracer.getSpanByName(opName)
    }

    assert.isOk(span, `Span not found for op=${opName}. ${ctx}`)
    return span
  }

  op(value) {
    this._opName = value
    return this
  }

  parent(value) {
    this._parentSpan = value
    return this
  }

  error(flag = true) {
    this._validateError = flag
    return this
  }

  errorBeforeDispatch(flag = true) {
    this._errorBeforeDispatch = flag
    return this
  }

  durability(value) {
    this._durability = value
    return this
  }

  nestedOps(value) {
    this._nestedOps = value
    return this
  }

  serverDurationAboveZero(value = true) {
    this._serverDurationAboveZero = value
    return this
  }

  retryCountAboveZero(value = true) {
    this._retryCountAboveZero = value
    return this
  }

  childKvOps(value) {
    if (Array.isArray(value)) {
      this._childKvOpNames = value
    } else {
      this._childKvOpNames = [value]
    }
    return this
  }

  childKvOpError(flag = true) {
    this._validateChildKvOpError = flag
    return this
  }

  statement(value) {
    this._statement = value
    return this
  }

  bucketName(value) {
    this._bucketName = value
    return this
  }

  scopeName(value) {
    this._scopeName = value
    return this
  }

  collectionName(value) {
    this._collectionName = value
    return this
  }
}

class BaseSpanValidator extends BaseValidator {
  constructor(tracer, collectionDetails, supportsClusterLabels = false) {
    super(tracer)
    this._supportsClusterLabels = supportsClusterLabels
    this._collectionDetails = collectionDetails
  }

  _validateHrTime(time, ctx) {
    assert.isArray(time, `Expected time to be array. ${ctx}`)
    assert.isNumber(time[0], `Expected time[0] to be number. ${ctx}`)
    assert.isNumber(time[1], `Expected time[1] to be number. ${ctx}`)
  }

  _validateTotalTime(startTime, endTime, ctx) {
    this._validateHrTime(startTime, ctx)
    this._validateHrTime(endTime, ctx)
    assert.isTrue(
      endTime[0] > startTime[0] ||
        (endTime[0] === startTime[0] && endTime[1] > startTime[1]),
      `End time should be after start time. ${ctx}`
    )
  }

  _validateSpanTime(span, ctx) {
    this._validateHrTime(span.startTime, ctx)
    this._validateHrTime(span.endTime, ctx)
    this._validateTotalTime(span.startTime, span.endTime, ctx)
  }

  _validateBaseSpanProperties(span, spanName, validateError = false) {
    const ctx = this._ctx(
      span,
      `name=${spanName},validateError=${validateError}`
    )
    assert.isOk(span, `Span should be defined. ${ctx}`)
    assert.strictEqual(span.name, spanName)
    assert.isObject(span.attributes)
    assert.strictEqual(span.attributes[OpAttributeName.SystemName], 'couchbase')

    if (this._supportsClusterLabels) {
      assert.isNotEmpty(
        span.attributes[OpAttributeName.ClusterName],
        `couchbase.cluster.name should not be empty. ${ctx}`
      )
      assert.isString(
        span.attributes[OpAttributeName.ClusterName],
        `couchbase.cluster.name should be a string. ${ctx}`
      )

      assert.isNotEmpty(
        span.attributes[OpAttributeName.ClusterUUID],
        `couchbase.cluster.uuid should not be empty. ${ctx}`
      )
      assert.isString(
        span.attributes[OpAttributeName.ClusterUUID],
        `couchbase.cluster.uuid should be a string. ${ctx}`
      )
    }

    if (validateError) {
      assert.strictEqual(
        span.status.code,
        SpanStatusCode.ERROR,
        `Expected error status. ${ctx}`
      )
      assert.isNotEmpty(span.status.message, `Expected error message. ${ctx}`)
    }

    this._validateSpanTime(span, ctx)
  }

  _validateDispatchSpanCommon(span, parentSpan, spanName, ctx) {
    this._validateBaseSpanProperties(span, spanName)
    assert.strictEqual(
      span.attributes[DispatchAttributeName.NetworkTransport],
      'tcp',
      `Expected NetworkTransport to be 'tcp'. ${ctx}`
    )
    assert.isNotEmpty(
      span.attributes[DispatchAttributeName.ServerAddress],
      `ServerAddress should not be empty. ${ctx}`
    )
    assert.isNumber(
      span.attributes[DispatchAttributeName.ServerPort],
      `ServerPort should be a number. ${ctx}`
    )
    assert.isNotEmpty(
      span.attributes[DispatchAttributeName.PeerAddress],
      `PeerAddress should not be empty. ${ctx}`
    )
    assert.isNumber(
      span.attributes[DispatchAttributeName.PeerPort],
      `PeerPort should be a number. ${ctx}`
    )
    assert.strictEqual(span.parentSpan, parentSpan)
  }

  _getSpanFromTracer(tracer, opName, parentSpan = null) {
    const ctx = `op=${opName}`
    assert.isOk(tracer.spans, `tracer.spans should be defined. ${ctx}`)

    let span
    if (parentSpan) {
      assert.strictEqual(
        tracer.spans.length,
        1,
        `Expected exactly 1 span when using parent span. ${ctx}`
      )
      assert.strictEqual(
        tracer.spans[0],
        parentSpan,
        `First span should be parent span. ${ctx}`
      )
      assert.isOk(
        tracer.spans[0].children,
        `Parent span should have children. ${ctx}`
      )
      span = tracer.spans[0].children[0]
    } else {
      span = tracer.getSpanByName(opName)
    }

    assert.isOk(span, `Span not found for op=${opName}. ${ctx}`)
    return span
  }
}

class KeyValueSpanValidator extends BaseSpanValidator {
  constructor(tracer, collectionDetails, is_mock = false) {
    super(tracer, collectionDetails, is_mock)
  }

  _validateDispatchSpan(span, parentSpan) {
    const ctx = this._ctx(span, 'dispatch')

    this._validateDispatchSpanCommon(span, parentSpan, DISPATCH_SPAN_NAME, ctx)

    assert.isNotEmpty(
      span.attributes[DispatchAttributeName.LocalId],
      `LocalId should not be empty. ${ctx}`
    )
    assert.isNotEmpty(
      span.attributes[DispatchAttributeName.OperationId],
      `OperationId should not be empty. ${ctx}`
    )
    assert.isNumber(
      span.attributes[DispatchAttributeName.ServerDuration],
      `ServerDuration should be a number. ${ctx}`
    )
    if (this._serverDurationAboveZero) {
      assert.isAbove(
        span.attributes[DispatchAttributeName.ServerDuration],
        0,
        `ServerDuration should be > 0. ${ctx}`
      )
    }
  }

  _validateDispatchSpans(span) {
    const dispatchSpans = span.children.filter(
      (c) => c.name === DISPATCH_SPAN_NAME
    )
    if (!this._validateError) {
      assert.isAtLeast(dispatchSpans.length, 1)
    }

    dispatchSpans.forEach((dispatchSpan) =>
      this._validateDispatchSpan(dispatchSpan, span)
    )
  }

  _validateEncodingSpans(span) {
    if (!ENCODING_OPS.includes(this._opName)) {
      return
    }

    const ctx = this._ctx(span, 'encoding')
    const encodingSpans = span.children.filter(
      (c) => c.name === ENCODING_SPAN_NAME
    )
    assert.isAtLeast(
      encodingSpans.length,
      1,
      `Expected at least 1 encoding span. ${ctx}`
    )
    const encodedSpan = encodingSpans[0]
    assert.strictEqual(
      span.children[0],
      encodedSpan,
      `Encoding span should be first child. ${ctx}`
    )
    assert.isDefined(
      encodedSpan.parentSpan,
      `Encoding span should have parent span. ${ctx}`
    )
    assert.strictEqual(
      encodedSpan.parentSpan,
      span,
      `Encoding span parent should match. ${ctx}`
    )

    this._validateBaseSpanProperties(encodedSpan, ENCODING_SPAN_NAME)
  }

  _validateSingleSpan(span) {
    const ctx = this._ctx(span, `op=${this._opName}`)

    if (this._parentSpan) {
      assert.strictEqual(
        span.parentSpan,
        this._parentSpan,
        `Span parent should match. ${ctx}`
      )
    }

    this._validateBaseSpanProperties(span, this._opName, this._validateError)

    assert.strictEqual(
      span.attributes[OpAttributeName.OperationName],
      this._opName,
      `OperationName should match. ${ctx}`
    )
    assert.strictEqual(
      span.attributes[OpAttributeName.Service],
      'kv',
      `Expected service to be 'kv'. ${ctx}`
    )
    assert.strictEqual(
      span.attributes[OpAttributeName.BucketName],
      this._collectionDetails.bucketName,
      `BucketName should match. ${ctx}`
    )
    assert.strictEqual(
      span.attributes[OpAttributeName.ScopeName],
      this._collectionDetails.scopeName,
      `ScopeName should match. ${ctx}`
    )
    assert.strictEqual(
      span.attributes[OpAttributeName.CollectionName],
      this._collectionDetails.collName,
      `CollectionName should match. ${ctx}`
    )

    assert.isDefined(
      span.attributes[OpAttributeName.RetryCount],
      `RetryCount attribute should be defined. ${ctx}`
    )
    assert.isNumber(
      span.attributes[OpAttributeName.RetryCount],
      `RetryCount should be a number. ${ctx}`
    )
    if (this._retryCountAboveZero) {
      assert.isAbove(
        span.attributes[OpAttributeName.RetryCount],
        0,
        `RetryCount should be > 0. ${ctx}`
      )
    }

    if (this._durability) {
      assert.strictEqual(
        span.attributes[OpAttributeName.DurabilityLevel],
        this._durability,
        `DurabilityLevel should match. ${ctx}`
      )
    }

    assert.isNotEmpty(span.children, `Span should have children. ${ctx}`)
    this._validateDispatchSpans(span)
    this._validateEncodingSpans(span)
  }

  _validateNestedSpan(span) {
    const ctx = this._ctx(span, `nestedOps=[${this._nestedOps.join(',')}]`)

    this._validateBaseSpanProperties(span, this._opName, this._validateError)

    assert.strictEqual(
      span.attributes[OpAttributeName.OperationName],
      this._opName,
      `OperationName should match. ${ctx}`
    )
    assert.strictEqual(
      span.attributes[OpAttributeName.BucketName],
      this._collectionDetails.bucketName,
      `BucketName should match. ${ctx}`
    )
    assert.strictEqual(
      span.attributes[OpAttributeName.ScopeName],
      this._collectionDetails.scopeName,
      `ScopeName should match. ${ctx}`
    )
    assert.strictEqual(
      span.attributes[OpAttributeName.CollectionName],
      this._collectionDetails.collName,
      `CollectionName should match. ${ctx}`
    )

    if (this._durability) {
      assert.strictEqual(
        span.attributes[OpAttributeName.DurabilityLevel],
        this._durability,
        `DurabilityLevel should match. ${ctx}`
      )
    }

    assert.isNotEmpty(span.children)
    assert.isAtLeast(span.children.length, this._nestedOps.length)

    const dispatchSpans = []

    this._nestedOps.forEach((spanName) => {
      const childSpans = span.children.filter((c) => c.name === spanName)
      assert.isNotEmpty(childSpans)
      assert.strictEqual(childSpans.length, 1)

      const childDispatchSpans = childSpans[0].children.filter(
        (c) => c.name === DISPATCH_SPAN_NAME
      )
      if (childDispatchSpans) {
        dispatchSpans.push(...childDispatchSpans)
      }

      this._validateSingleSpanWithAttrs(
        childSpans[0],
        spanName,
        span,
        false,
        this._durability
      )
    })

    assert.isAtLeast(dispatchSpans.length, this._nestedOps.length)

    if (!this._serverDurationAboveZero) {
      const positiveServerDurations = dispatchSpans.filter(
        (s) => s.attributes[DispatchAttributeName.ServerDuration] > 0
      )
      assert.isAtLeast(positiveServerDurations.length, 1)
    }
  }

  _validateSingleSpanWithAttrs(
    span,
    opName,
    parentSpan,
    validateError,
    durability
  ) {
    const ctx = this._ctx(span, `op=${opName},validateError=${validateError}`)

    if (parentSpan) {
      assert.strictEqual(span.parentSpan, parentSpan)
    }

    this._validateBaseSpanProperties(span, opName, validateError)

    assert.strictEqual(
      span.attributes[OpAttributeName.OperationName],
      opName,
      `OperationName should match. ${ctx}`
    )
    assert.strictEqual(
      span.attributes[OpAttributeName.BucketName],
      this._collectionDetails.bucketName,
      `BucketName should match. ${ctx}`
    )
    assert.strictEqual(
      span.attributes[OpAttributeName.ScopeName],
      this._collectionDetails.scopeName,
      `ScopeName should match. ${ctx}`
    )
    assert.strictEqual(
      span.attributes[OpAttributeName.CollectionName],
      this._collectionDetails.collName,
      `CollectionName should match. ${ctx}`
    )

    if (durability) {
      assert.strictEqual(
        span.attributes[OpAttributeName.DurabilityLevel],
        durability,
        `DurabilityLevel should match. ${ctx}`
      )
    }

    assert.isNotEmpty(span.children)

    const dispatchSpans = span.children.filter(
      (c) => c.name === DISPATCH_SPAN_NAME
    )
    if (!validateError) {
      assert.isAtLeast(dispatchSpans.length, 1)
    }

    dispatchSpans.forEach((dispatchSpan) =>
      this._validateDispatchSpan(dispatchSpan, span)
    )

    if (ENCODING_OPS.includes(opName)) {
      this._opName = opName
      this._validateEncodingSpans(span)
    }
  }

  validate() {
    const span = this._getSpanFromTracer(
      this._tracer,
      this._opName,
      this._parentSpan
    )

    if (this._nestedOps) {
      this._validateNestedSpan(span)
    } else {
      this._validateSingleSpan(span)
    }
  }
}

class DatastructureSpanValidator extends BaseSpanValidator {
  constructor(tracer, collectionDetails, supportsClusterLabels = false) {
    super(tracer, collectionDetails, supportsClusterLabels)
  }

  validate() {
    const dsSpan = this._tracer.getSpanByName(this._opName)
    const ctx = this._ctx(dsSpan, `dsOp=${this._opName}`)

    assert.isOk(dsSpan, `DS span not found. ${ctx}`)
    assert.strictEqual(dsSpan.name, this._opName)

    this._validateBaseSpanProperties(dsSpan, this._opName, this._validateError)

    this._validateSpanTime(dsSpan, ctx)

    assert.isArray(dsSpan.children)
    const expectedLength = this._childKvOpNames
      ? this._childKvOpNames.length
      : 1
    assert.lengthOf(
      dsSpan.children,
      expectedLength,
      `DS span should have ${expectedLength}. ${ctx}`
    )

    for (let i = 0; i < this._childKvOpNames.length; i++) {
      const childSpan = dsSpan.children[i]
      assert.isOk(childSpan, `Child span should be defined. ${ctx}`)
      assert.strictEqual(
        childSpan.name,
        this._childKvOpNames[i],
        `Child span name should match. ${ctx}`
      )

      this._validateChildKvSpan(childSpan, dsSpan, this._childKvOpNames[i])
    }
  }

  _validateChildKvSpan(span, parentSpan, spanName) {
    const ctx = this._ctx(span, `childOp=${spanName}`)

    if (parentSpan) {
      assert.strictEqual(
        span.parentSpan,
        parentSpan,
        `Child span parent should match. ${ctx}`
      )
    }

    this._validateBaseSpanProperties(
      span,
      spanName,
      this._validateChildKvOpError
    )

    assert.strictEqual(
      span.attributes[OpAttributeName.OperationName],
      spanName,
      `OperationName should match. ${ctx}`
    )
    assert.strictEqual(
      span.attributes[OpAttributeName.BucketName],
      this._collectionDetails.bucketName,
      `BucketName should match. ${ctx}`
    )
    assert.strictEqual(
      span.attributes[OpAttributeName.ScopeName],
      this._collectionDetails.scopeName,
      `ScopeName should match. ${ctx}`
    )
    assert.strictEqual(
      span.attributes[OpAttributeName.CollectionName],
      this._collectionDetails.collName,
      `CollectionName should match. ${ctx}`
    )

    assert.isNotEmpty(span.children)

    const dispatchSpans = span.children.filter(
      (c) => c.name === DISPATCH_SPAN_NAME
    )
    if (!this._validateError) {
      assert.isAtLeast(dispatchSpans.length, 1)
    }

    dispatchSpans.forEach((dispatchSpan) =>
      this._validateDispatchSpan(dispatchSpan, span)
    )
  }

  _validateDispatchSpan(span, parentSpan) {
    const ctx = this._ctx(span, 'dispatch')

    this._validateDispatchSpanCommon(span, parentSpan, DISPATCH_SPAN_NAME, ctx)

    assert.isNotEmpty(
      span.attributes[DispatchAttributeName.LocalId],
      `LocalId should not be empty. ${ctx}`
    )
    assert.isNotEmpty(
      span.attributes[DispatchAttributeName.OperationId],
      `OperationId should not be empty. ${ctx}`
    )
    assert.isNumber(
      span.attributes[DispatchAttributeName.ServerDuration],
      `ServerDuration should be a number. ${ctx}`
    )
  }
}

class HttpSpanValidator extends BaseSpanValidator {
  constructor(tracer, collectionDetails, supportsClusterLabels = false) {
    super(tracer, collectionDetails, supportsClusterLabels)
  }

  _validateDispatchSpans(span) {
    const dispatchSpans = span.children.filter(
      (c) => c.name === DISPATCH_SPAN_NAME
    )
    if (!this._validateError && !this._errorBeforeDispatch) {
      assert.isAtLeast(dispatchSpans.length, 1)
    }

    dispatchSpans.forEach((dispatchSpan) =>
      this._validateDispatchSpanCommon(dispatchSpan, span, DISPATCH_SPAN_NAME)
    )
  }

  _validateSingleSpan(span) {
    const ctx = this._ctx(span, `op=${this._opName}`)

    if (this._parentSpan) {
      assert.strictEqual(
        span.parentSpan,
        this._parentSpan,
        `Span parent should match. ${ctx}`
      )
    }

    this._validateBaseSpanProperties(span, this._opName, this._validateError)

    assert.strictEqual(
      span.attributes[OpAttributeName.OperationName],
      this._opName,
      `OperationName should match. ${ctx}`
    )

    const expectedService = serviceNameFromOpType(this._opName)
    assert.strictEqual(
      span.attributes[OpAttributeName.Service],
      expectedService,
      `Expected service to be '${expectedService}'. ${ctx}`
    )

    if (this._bucketName !== null) {
      assert.strictEqual(
        span.attributes[OpAttributeName.BucketName],
        this._bucketName,
        `BucketName should match. ${ctx}`
      )
    }

    if (this._scopeName !== null) {
      assert.strictEqual(
        span.attributes[OpAttributeName.ScopeName],
        this._scopeName,
        `ScopeName should match. ${ctx}`
      )
    }

    if (this._collectionName !== null) {
      assert.strictEqual(
        span.attributes[OpAttributeName.CollectionName],
        this._collectionName,
        `CollectionName should match. ${ctx}`
      )
    }

    if (this._statement !== null) {
      assert.strictEqual(
        span.attributes[OpAttributeName.QueryStatement],
        this._statement,
        `QueryStatement should match. ${ctx}`
      )
    }

    if (!this._errorBeforeDispatch) {
      assert.isNotEmpty(span.children, `Span should have children. ${ctx}`)
      this._validateDispatchSpans(span)
    }
  }

  _validateNestedSpan(span) {
    const ctx = this._ctx(span, `nestedOps=[${this._nestedOps.join(',')}]`)

    this._validateBaseSpanProperties(span, this._opName, this._validateError)

    assert.strictEqual(
      span.attributes[OpAttributeName.OperationName],
      this._opName,
      `OperationName should match. ${ctx}`
    )

    const expectedService = serviceNameFromOpType(this._opName)
    assert.strictEqual(
      span.attributes[OpAttributeName.Service],
      expectedService,
      `Expected service to be '${expectedService}'. ${ctx}`
    )

    if (this._collectionDetails) {
      assert.strictEqual(
        span.attributes[OpAttributeName.BucketName],
        this._collectionDetails.bucketName,
        `BucketName should match. ${ctx}`
      )
      assert.strictEqual(
        span.attributes[OpAttributeName.ScopeName],
        this._collectionDetails.scopeName,
        `ScopeName should match. ${ctx}`
      )
      assert.strictEqual(
        span.attributes[OpAttributeName.CollectionName],
        this._collectionDetails.collName,
        `CollectionName should match. ${ctx}`
      )
    }

    if (this._statement !== null) {
      assert.strictEqual(
        span.attributes[OpAttributeName.QueryStatement],
        this._statement,
        `QueryStatement should match. ${ctx}`
      )
    }

    assert.isNotEmpty(span.children)
    assert.isAtLeast(span.children.length, this._nestedOps.length)

    const dispatchSpans = []

    this._nestedOps.forEach((spanName) => {
      const childSpans = span.children.filter((c) => c.name === spanName)
      assert.isNotEmpty(childSpans)

      const childDispatchSpans = childSpans[0].children.filter(
        (c) => c.name === DISPATCH_SPAN_NAME
      )
      if (childDispatchSpans) {
        dispatchSpans.push(...childDispatchSpans)
      }

      this._validateSingleSpanWithAttrs(childSpans[0], spanName, span, false)
    })

    assert.isAtLeast(dispatchSpans.length, this._nestedOps.length)
  }

  _validateSingleSpanWithAttrs(span, opName, parentSpan, validateError) {
    const ctx = this._ctx(span, `op=${opName},validateError=${validateError}`)

    if (parentSpan) {
      assert.strictEqual(span.parentSpan, parentSpan)
    }

    this._validateBaseSpanProperties(span, opName, validateError)

    assert.strictEqual(
      span.attributes[OpAttributeName.OperationName],
      opName,
      `OperationName should match. ${ctx}`
    )

    const expectedService = serviceNameFromOpType(opName)
    assert.strictEqual(
      span.attributes[OpAttributeName.Service],
      expectedService,
      `Expected service to be '${expectedService}'. ${ctx}`
    )

    if (this._collectionDetails) {
      assert.strictEqual(
        span.attributes[OpAttributeName.BucketName],
        this._collectionDetails.bucketName,
        `BucketName should match. ${ctx}`
      )
      assert.strictEqual(
        span.attributes[OpAttributeName.ScopeName],
        this._collectionDetails.scopeName,
        `ScopeName should match. ${ctx}`
      )
      assert.strictEqual(
        span.attributes[OpAttributeName.CollectionName],
        this._collectionDetails.collName,
        `CollectionName should match. ${ctx}`
      )
    }

    assert.isNotEmpty(span.children)

    const dispatchSpans = span.children.filter(
      (c) => c.name === DISPATCH_SPAN_NAME
    )
    if (!validateError) {
      assert.isAtLeast(dispatchSpans.length, 1)
    }

    dispatchSpans.forEach((dispatchSpan) =>
      this._validateDispatchSpanCommon(dispatchSpan, span, DISPATCH_SPAN_NAME)
    )
  }

  validate() {
    const span = this._getSpanFromTracer(
      this._tracer,
      this._opName,
      this._parentSpan
    )

    if (this._nestedOps) {
      this._validateNestedSpan(span)
    } else {
      this._validateSingleSpan(span)
    }
  }
}

class KeyValueThresholdLoggingValidator extends BaseValidator {
  constructor(tracer, isDsOp = false) {
    super(tracer)
    this._isDsOp = isDsOp
  }

  validate() {
    if (this._isDsOp) {
      this._validateDsSpan()
    } else {
      this._validateSpan()
    }
  }

  _getFromAttributes(span, attributeName, defaultValue = null) {
    if (!span.testAttributes || !(attributeName in span.testAttributes)) {
      return defaultValue
    }
    return span.testAttributes[attributeName]
  }

  _collectSpansByName(targetName, currentSpan) {
    let foundSpans = []

    if (currentSpan.name === targetName) {
      foundSpans.push(currentSpan)
    }

    if (currentSpan.children) {
      currentSpan.children.forEach((child) => {
        foundSpans = foundSpans.concat(
          this._collectSpansByName(targetName, child)
        )
      })
    }

    return foundSpans
  }

  _validateDispatchSpan(span) {
    const ctx = this._ctx(span, 'dispatch')
    const dispatchSpans = this._collectSpansByName(DISPATCH_SPAN_NAME, span)
    const dispatchTotalTime = dispatchSpans.reduce((total, s) => {
      return (
        total + hiResTimeToMicros(getHiResTimeDelta(s._startTime, s._endTime))
      )
    }, 0)
    const dispatchTotalServerDuration = dispatchSpans.reduce((total, s) => {
      const serverDuration =
        this._getFromAttributes(s, DispatchAttributeName.ServerDuration, 0) || 0
      return total + serverDuration
    }, 0)
    const lastDspan = dispatchSpans[dispatchSpans.length - 1]
    const lastDspanDuration = hiResTimeToMicros(
      getHiResTimeDelta(lastDspan._startTime, lastDspan._endTime)
    )
    const lastDspanServerDuration = this._getFromAttributes(
      lastDspan,
      DispatchAttributeName.ServerDuration,
      0
    )
    const lastDspanLocalId = this._getFromAttributes(
      lastDspan,
      DispatchAttributeName.LocalId,
      null
    )
    const lastDspanOperationId = this._getFromAttributes(
      lastDspan,
      DispatchAttributeName.OperationId,
      null
    )
    const lastDspanPeerAddr = this._getFromAttributes(
      lastDspan,
      DispatchAttributeName.PeerAddress,
      null
    )
    const lastDspanPeerPort = this._getFromAttributes(
      lastDspan,
      DispatchAttributeName.PeerPort,
      null
    )
    let lastLocalSocket = null
    if (lastDspanPeerAddr !== null || lastDspanPeerPort !== null) {
      const address = lastDspanPeerAddr || ''
      const port = lastDspanPeerPort || ''
      lastLocalSocket = `${address}:${port}`
    }
    const lastDspanServerAddr = this._getFromAttributes(
      lastDspan,
      DispatchAttributeName.ServerAddress,
      null
    )
    const lastDspanServerPort = this._getFromAttributes(
      lastDspan,
      DispatchAttributeName.ServerPort,
      null
    )
    let lastRemoteSocket = null
    if (lastDspanServerAddr !== null || lastDspanServerPort !== null) {
      const address = lastDspanServerAddr || ''
      const port = lastDspanServerPort || ''
      lastRemoteSocket = `${address}:${port}`
    }

    assert.equal(
      dispatchTotalTime,
      span.totalDispatchDuration,
      `totalDispatchDuration should match. ${ctx}`
    )
    assert.equal(
      dispatchTotalServerDuration,
      span.totalServerDuration,
      `totalServerDuration should match. ${ctx}`
    )
    assert.equal(
      lastDspanDuration,
      span.dispatchDuration,
      `dispatchDuration should match. ${ctx}`
    )
    assert.equal(
      lastDspanServerDuration,
      span.serverDuration,
      `serverDuration should match. ${ctx}`
    )
    assert.equal(lastDspanLocalId, span.localId, `localId should match. ${ctx}`)
    assert.equal(
      lastDspanOperationId,
      span.operationId,
      `operationId should match. ${ctx}`
    )
    assert.equal(
      lastRemoteSocket,
      span.remoteSocket,
      `remoteSocket should match. ${ctx}`
    )
    assert.equal(
      lastLocalSocket,
      span.localSocket,
      `localSocket should match. ${ctx}`
    )
  }

  _validateEncodingSpans(span) {
    const ctx = this._ctx(span, 'encoding')
    const encodingSpans = this._collectSpansByName(ENCODING_SPAN_NAME, span)
    const encodingTotalTime = encodingSpans.reduce((total, s) => {
      return (
        total + hiResTimeToMicros(getHiResTimeDelta(s._startTime, s._endTime))
      )
    }, 0)
    assert.equal(
      encodingTotalTime,
      span.totalEncodeDuration,
      `totalEncodeDuration should match. ${ctx}`
    )
  }

  _validateDsSpan() {
    assert.isOk(
      this._tracer instanceof ThresholdLoggingTestTracer,
      'Expected ThresholdLoggingTestTracer'
    )
    const span = this._getSpanFromTracer(
      this._tracer,
      this._opName,
      this._parentSpan
    )
    for (const childSpan of span.children) {
      this._validate(childSpan)
    }
  }

  _validateSpan() {
    assert.isOk(
      this._tracer instanceof ThresholdLoggingTestTracer,
      'Expected ThresholdLoggingTestTracer'
    )
    const span = this._getSpanFromTracer(
      this._tracer,
      this._opName,
      this._parentSpan
    )
    this._validate(span)
  }

  _validate(span) {
    const ctx = this._ctx(span, `op=${this._opName},spanName=${span.name}`)
    if (!this._errorBeforeDispatch) {
      this._validateDispatchSpan(span)
    }
    this._validateEncodingSpans(span)
    const totalDuration = hiResTimeToMicros(
      getHiResTimeDelta(span._startTime, span._endTime)
    )
    const threshold = this._tracer._getServiceTypeThreshold(span.serviceType)
    if (totalDuration > threshold) {
      assert.isTrue(
        this._tracer.overThresholdSpans.includes(span.snapshot),
        `Span should be in overThresholdSpans. ${ctx}`
      )
    } else {
      assert.isTrue(
        this._tracer.underThresholdSpans.includes(span.snapshot),
        `Span should be in underThresholdSpans. ${ctx}`
      )
    }
  }
}

class HttpThresholdLoggingValidator extends BaseValidator {
  constructor(tracer) {
    super(tracer)
  }

  validate() {
    assert.isOk(
      this._tracer instanceof ThresholdLoggingTestTracer,
      'Expected ThresholdLoggingTestTracer'
    )
    const span = this._getSpanFromTracer(
      this._tracer,
      this._opName,
      this._parentSpan
    )
    this._validate(span)
  }

  _getFromAttributes(span, attributeName, defaultValue = null) {
    if (!span.testAttributes || !(attributeName in span.testAttributes)) {
      return defaultValue
    }
    return span.testAttributes[attributeName]
  }

  _collectSpansByName(targetName, currentSpan) {
    let foundSpans = []

    if (currentSpan.name === targetName) {
      foundSpans.push(currentSpan)
    }

    if (currentSpan.children) {
      currentSpan.children.forEach((child) => {
        foundSpans = foundSpans.concat(
          this._collectSpansByName(targetName, child)
        )
      })
    }

    return foundSpans
  }

  _validateDispatchSpan(span) {
    const ctx = this._ctx(span, 'dispatch')
    const dispatchSpans = this._collectSpansByName(DISPATCH_SPAN_NAME, span)
    const dispatchTotalTime = dispatchSpans.reduce((total, s) => {
      return (
        total + hiResTimeToMicros(getHiResTimeDelta(s._startTime, s._endTime))
      )
    }, 0)
    const lastDspan = dispatchSpans[dispatchSpans.length - 1]
    const lastDspanDuration = hiResTimeToMicros(
      getHiResTimeDelta(lastDspan._startTime, lastDspan._endTime)
    )
    const lastDspanLocalId = this._getFromAttributes(
      lastDspan,
      DispatchAttributeName.LocalId,
      null
    )
    const lastDspanOperationId = this._getFromAttributes(
      lastDspan,
      DispatchAttributeName.OperationId,
      null
    )
    const lastDspanPeerAddr = this._getFromAttributes(
      lastDspan,
      DispatchAttributeName.PeerAddress,
      null
    )
    const lastDspanPeerPort = this._getFromAttributes(
      lastDspan,
      DispatchAttributeName.PeerPort,
      null
    )
    let lastLocalSocket = null
    if (lastDspanPeerAddr !== null || lastDspanPeerPort !== null) {
      const address = lastDspanPeerAddr || ''
      const port = lastDspanPeerPort || ''
      lastLocalSocket = `${address}:${port}`
    }
    const lastDspanServerAddr = this._getFromAttributes(
      lastDspan,
      DispatchAttributeName.ServerAddress,
      null
    )
    const lastDspanServerPort = this._getFromAttributes(
      lastDspan,
      DispatchAttributeName.ServerPort,
      null
    )
    let lastRemoteSocket = null
    if (lastDspanServerAddr !== null || lastDspanServerPort !== null) {
      const address = lastDspanServerAddr || ''
      const port = lastDspanServerPort || ''
      lastRemoteSocket = `${address}:${port}`
    }

    assert.equal(
      dispatchTotalTime,
      span.totalDispatchDuration,
      `totalDispatchDuration should match. ${ctx}`
    )
    assert.equal(
      lastDspanDuration,
      span.dispatchDuration,
      `dispatchDuration should match. ${ctx}`
    )
    assert.equal(lastDspanLocalId, span.localId, `localId should match. ${ctx}`)
    assert.equal(
      lastDspanOperationId,
      span.operationId,
      `operationId should match. ${ctx}`
    )
    assert.equal(
      lastRemoteSocket,
      span.remoteSocket,
      `remoteSocket should match. ${ctx}`
    )
    assert.equal(
      lastLocalSocket,
      span.localSocket,
      `localSocket should match. ${ctx}`
    )
  }

  _validate(span) {
    const ctx = this._ctx(span, `op=${this._opName},spanName=${span.name}`)
    if (!this._errorBeforeDispatch) {
      this._validateDispatchSpan(span)
    }
    const totalDuration = hiResTimeToMicros(
      getHiResTimeDelta(span._startTime, span._endTime)
    )
    const threshold = this._tracer._getServiceTypeThreshold(span.serviceType)
    if (totalDuration > threshold) {
      assert.isTrue(
        this._tracer.overThresholdSpans.includes(span.snapshot),
        `Span should be in overThresholdSpans. ${ctx}`
      )
    } else {
      assert.isTrue(
        this._tracer.underThresholdSpans.includes(span.snapshot),
        `Span should be in underThresholdSpans. ${ctx}`
      )
    }
  }
}

class NoOpValidator extends BaseValidator {
  constructor(tracer) {
    super(tracer)
  }

  validate() {
    assert.isOk(this._tracer instanceof NoOpTracer, 'Expected NoOpTracer')

    if (this._parentSpan) {
      assert.isOk(
        this._parentSpan instanceof NoOpSpan,
        'Expected NoOpSpan for parent'
      )
      assert.strictEqual(
        this._tracer.spans.length,
        1,
        'Expected exactly 1 span (parent) in tracer.spans'
      )
      assert.strictEqual(
        this._tracer.spans[0],
        this._parentSpan,
        'First span should be parent span'
      )
    } else {
      assert.strictEqual(
        this._tracer.spans.length,
        0,
        'Expected 0 spans in tracer.spans (no parent span)'
      )
    }
  }
}

function createKeyValueValidator(
  tracer,
  collectionDetails,
  supportsClusterLabels = false
) {
  if (tracer instanceof NoOpTestTracer) {
    return new NoOpValidator(tracer)
  } else if (tracer instanceof ThresholdLoggingTestTracer) {
    return new KeyValueThresholdLoggingValidator(tracer)
  } else if (tracer instanceof TestTracer) {
    return new KeyValueSpanValidator(
      tracer,
      collectionDetails,
      supportsClusterLabels
    )
  } else {
    throw new Error('Unsupported tracer type for KV validator')
  }
}

function createDatastructureValidator(
  tracer,
  collectionDetails,
  supportsClusterLabels = false
) {
  if (tracer instanceof NoOpTestTracer) {
    return new NoOpValidator(tracer)
  } else if (tracer instanceof ThresholdLoggingTestTracer) {
    return new KeyValueThresholdLoggingValidator(tracer, true)
  } else if (tracer instanceof TestTracer) {
    return new DatastructureSpanValidator(
      tracer,
      collectionDetails,
      supportsClusterLabels
    )
  } else {
    throw new Error('Unsupported tracer type for Datastructure validator')
  }
}

function createHttpValidator(
  tracer,
  collectionDetails = null,
  supportsClusterLabels = false
) {
  if (tracer instanceof NoOpTestTracer) {
    return new NoOpValidator(tracer)
  } else if (tracer instanceof ThresholdLoggingTestTracer) {
    return new HttpThresholdLoggingValidator(tracer)
  } else if (tracer instanceof TestTracer) {
    return new HttpSpanValidator(
      tracer,
      collectionDetails,
      supportsClusterLabels
    )
  } else {
    throw new Error('Unsupported tracer type for HTTP validator')
  }
}

module.exports = {
  createKeyValueValidator,
  createDatastructureValidator,
  createHttpValidator,
}
