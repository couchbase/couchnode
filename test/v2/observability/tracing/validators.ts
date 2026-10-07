// A fluent builder, because a span assertion has a dozen independent parts and
// a test sets two or three of them:
//
//     validator.reset().op(StreamingOp.Query).statement(statement)
//     await cluster.query(statement)
//     validator.validate()
//
// `reset()` clears the tracer as well as the expectation, so `validate()` sees
// only what the operation between the two calls recorded, and can assert
// exactly one span for exactly this operation.
//
// The cluster name label is compared against `env.clusterName()`. The uuid has
// no independent source and is only asserted to be a non-empty string.
//
// The `create*Validator` functions pick the validator matching the tracer, so
// a suite body is written once and runs against all three tracer kinds.

import { expect } from 'vitest'

import type { HiResTime } from '../../../../lib/binding'
import { NoOpSpan, NoOpTracer } from '../../../../lib/observability'
import {
  DispatchAttributeName,
  KeyValueOp,
  OpAttributeName,
  OpType,
  SpanStatusCode,
  serviceNameFromOpType,
} from '../../../../lib/observabilitytypes'
import {
  getHiResTimeDelta,
  hiResTimeToMicros,
} from '../../../../lib/observabilityutilities'
import { AssertCtx, withCtx } from '../../asserts/ctx'
import { expectDefined } from '../../asserts/defined'
import {
  AnyTestSpan,
  AnyTestTracer,
  NoOpTestTracer,
  TestSpan,
  TestTracer,
  ThresholdLoggingTestSpan,
  ThresholdLoggingTestTracer,
} from './tracingtypes'

const DISPATCH_SPAN_NAME = OpAttributeName.DispatchSpanName

const ENCODING_SPAN_NAME = OpAttributeName.EncodingSpanName

/** The key-value operations that send a body, so record an encoding span. */
const ENCODING_OPS: readonly OpType[] = [
  KeyValueOp.Insert,
  KeyValueOp.MutateIn,
  KeyValueOp.Replace,
  KeyValueOp.Upsert,
]

/**
 * The nested operations a replica read sends once per replica rather than
 * once in all, so a bucket with two replicas records two of each.
 */
const PER_REPLICA_OPS: readonly OpType[] = [
  KeyValueOp.GetReplica,
  KeyValueOp.LookupInReplica,
]

export interface CollectionDetails {
  readonly bucketName: string
  readonly scopeName: string
  readonly collName: string
}

/**
 * The cluster's own name, or null when it has none. A cluster with no name
 * puts no cluster labels on its spans or metrics, so null turns those
 * assertions off. See `TestEnv.clusterName()`.
 */
export type ClusterName = string | null

export interface TracingValidator {
  /** Clears the expectation and, unless told otherwise, the tracer with it. */
  reset(opts?: { readonly clearSpans?: boolean }): this
  op(value: OpType): this
  /** The span the test opened by hand, for the operation to hang under. */
  parent(value: AnyTestSpan): this
  /** Whether the span is expected to carry an error status. */
  error(flag?: boolean): this
  /** Whether the operation should fail before it reaches the network. */
  errorBeforeDispatch(flag?: boolean): this
  durability(value: string): this
  /** Operations the SDK is expected to have traced underneath `op`. */
  nestedOps(value: readonly OpType[]): this
  /**
   * Whether every dispatch span must report a positive server duration
   * (default true). Pass false for an any-replica read: the first copy to
   * answer can report zero, and the copies it did not wait for report nothing.
   */
  serverDurationAboveZero(value?: boolean): this
  retryCountAboveZero(value?: boolean): this
  /** Key-value operations expected under a data structure operation's span. */
  childKvOps(value: OpType | readonly OpType[]): this
  /** Whether those child key-value spans are expected to carry an error. */
  childKvOpError(flag?: boolean): this
  statement(value: string): this
  bucketName(value: string): this
  scopeName(value: string): this
  collectionName(value: string): this
  /** Asserts everything declared since the last `reset()`. */
  validate(): void
}

interface Expectation {
  opName: OpType | undefined
  parentSpan: AnyTestSpan | undefined
  validateError: boolean
  errorBeforeDispatch: boolean
  durability: string | undefined
  nested: readonly OpType[] | undefined
  serverDurationAboveZero: boolean
  retryCountAboveZero: boolean
  childKvOpNames: readonly OpType[] | undefined
  validateChildKvOpError: boolean
  statement: string | undefined
  bucket: string | undefined
  scope: string | undefined
  collection: string | undefined
}

function noExpectation(): Expectation {
  return {
    opName: undefined,
    parentSpan: undefined,
    validateError: false,
    errorBeforeDispatch: false,
    durability: undefined,
    nested: undefined,
    serverDurationAboveZero: true,
    retryCountAboveZero: false,
    childKvOpNames: undefined,
    validateChildKvOpError: false,
    statement: undefined,
    bucket: undefined,
    scope: undefined,
    collection: undefined,
  }
}

abstract class BaseValidator implements TracingValidator {
  protected expected: Expectation = noExpectation()

  protected constructor(protected readonly tracer: AnyTestTracer) {}

  reset({ clearSpans = true } = {}): this {
    this.expected = noExpectation()
    if (clearSpans) {
      this.tracer.clear()
    }
    return this
  }

  op(value: OpType): this {
    this.expected.opName = value
    return this
  }

  parent(value: AnyTestSpan): this {
    this.expected.parentSpan = value
    return this
  }

  error(flag = true): this {
    this.expected.validateError = flag
    return this
  }

  errorBeforeDispatch(flag = true): this {
    this.expected.errorBeforeDispatch = flag
    return this
  }

  durability(value: string): this {
    this.expected.durability = value
    return this
  }

  nestedOps(value: readonly OpType[]): this {
    this.expected.nested = value
    return this
  }

  serverDurationAboveZero(value = true): this {
    this.expected.serverDurationAboveZero = value
    return this
  }

  retryCountAboveZero(value = true): this {
    this.expected.retryCountAboveZero = value
    return this
  }

  childKvOps(value: OpType | readonly OpType[]): this {
    // `Array.isArray` cannot narrow away a readonly array, so both arms cast.
    this.expected.childKvOpNames = Array.isArray(value)
      ? (value as readonly OpType[])
      : [value as OpType]
    return this
  }

  childKvOpError(flag = true): this {
    this.expected.validateChildKvOpError = flag
    return this
  }

  statement(value: string): this {
    this.expected.statement = value
    return this
  }

  bucketName(value: string): this {
    this.expected.bucket = value
    return this
  }

  scopeName(value: string): this {
    this.expected.scope = value
    return this
  }

  collectionName(value: string): this {
    this.expected.collection = value
    return this
  }

  protected declaredOp(): OpType {
    const opName = this.expected.opName
    expectDefined(
      opName,
      'no operation was declared: call op() before validate()'
    )
    return opName
  }

  abstract validate(): void
}

function spanCtx(
  span: { name: string; attributes?: object; children?: unknown[] } | undefined,
  extra?: string
): AssertCtx {
  if (!span) {
    return { extra }
  }
  const parts = [`span=${span.name}`]
  if (span.attributes) {
    parts.push(`attrs=${Object.keys(span.attributes).join(',')}`)
  }
  if (span.children) {
    parts.push(`children=${span.children.length}`)
  }
  if (extra) {
    parts.push(extra)
  }
  return { extra: parts.join(' | ') }
}

interface SpanSource<S> {
  readonly spans: readonly S[]
  getSpanByName(name: string): S | undefined
}

/**
 * With a parent span the operation's span is the parent's only child, because
 * `reset()` cleared the tracer and the test opened exactly one span by hand.
 * Without one it is a root span, looked up by name.
 */
function spanFromTracer<S extends { readonly children: readonly S[] }>(
  tracer: SpanSource<S>,
  opName: OpType,
  parentSpan: AnyTestSpan | undefined
): S {
  const at = { op: opName } satisfies AssertCtx

  let span: S | undefined
  if (parentSpan) {
    expect(
      tracer.spans,
      withCtx('exactly one span is expected when a parent span is used', at)
    ).toHaveLength(1)
    expect(
      tracer.spans[0],
      withCtx('the first span should be the parent span', at)
    ).toBe(parentSpan)
    span = tracer.spans[0].children[0]
  } else {
    span = tracer.getSpanByName(opName)
  }

  expectDefined(span, withCtx('no span was recorded for this operation', at))
  return span
}

abstract class BaseSpanValidator extends BaseValidator {
  protected constructor(
    protected readonly recordingTracer: TestTracer,
    protected readonly collectionDetails: CollectionDetails | undefined,
    protected readonly clusterName: ClusterName,
    /** A mock can report a zero server duration for a fast operation. */
    private readonly mockBackend = false
  ) {
    super(recordingTracer)
  }

  protected validateHrTime(
    time: HiResTime | null,
    what: string,
    at: AssertCtx
  ): asserts time is HiResTime {
    if (!Array.isArray(time)) {
      expect.unreachable(
        withCtx(`${what} should be a high-resolution pair`, at)
      )
    }
    expect(time[0], withCtx(`${what} seconds`, at)).toBeTypeOf('number')
    expect(time[1], withCtx(`${what} nanoseconds`, at)).toBeTypeOf('number')
  }

  protected validateSpanTime(span: TestSpan, at: AssertCtx): void {
    const start = span.startTime
    const end = span.endTime
    this.validateHrTime(start, 'start time', at)
    this.validateHrTime(end, 'end time', at)
    expect(
      end[0] > start[0] || (end[0] === start[0] && end[1] > start[1]),
      withCtx('the end time should be after the start time', at)
    ).toBe(true)
  }

  /** The attributes every recorded span carries, whatever the operation. */
  protected validateBaseSpanProperties(
    span: TestSpan,
    spanName: OpType | string,
    validateError = false
  ): void {
    const at = spanCtx(
      span,
      `name=${spanName} | validateError=${validateError}`
    )
    expect(span.name, withCtx('span name', at)).toBe(spanName)
    expect(span.attributes, withCtx('span attributes', at)).toBeTypeOf('object')
    expect(
      span.attributes[OpAttributeName.SystemName],
      withCtx(OpAttributeName.SystemName, at)
    ).toBe('couchbase')

    if (this.clusterName !== null) {
      expect(
        span.attributes[OpAttributeName.ClusterName],
        withCtx(OpAttributeName.ClusterName, at)
      ).toBe(this.clusterName)
      expectNonEmptyString(
        span.attributes[OpAttributeName.ClusterUUID],
        OpAttributeName.ClusterUUID,
        at
      )
    }

    if (validateError) {
      expect(span.status.code, withCtx('span status code', at)).toBe(
        SpanStatusCode.ERROR
      )
      expectNonEmptyString(span.status.message, 'span status message', at)
    }

    this.validateSpanTime(span, at)
  }

  protected validateDispatchSpanCommon(
    span: TestSpan,
    parentSpan: TestSpan,
    spanName: string
  ): void {
    const at = spanCtx(span, `dispatch of ${parentSpan.name}`)
    this.validateBaseSpanProperties(span, spanName)
    expect(
      span.attributes[DispatchAttributeName.NetworkTransport],
      withCtx(DispatchAttributeName.NetworkTransport, at)
    ).toBe('tcp')
    expectNonEmptyString(
      span.attributes[DispatchAttributeName.ServerAddress],
      DispatchAttributeName.ServerAddress,
      at
    )
    expect(
      span.attributes[DispatchAttributeName.ServerPort],
      withCtx(DispatchAttributeName.ServerPort, at)
    ).toBeTypeOf('number')
    expectNonEmptyString(
      span.attributes[DispatchAttributeName.PeerAddress],
      DispatchAttributeName.PeerAddress,
      at
    )
    expect(
      span.attributes[DispatchAttributeName.PeerPort],
      withCtx(DispatchAttributeName.PeerPort, at)
    ).toBeTypeOf('number')
    expect(span.parentSpan, withCtx('dispatch span parent', at)).toBe(
      parentSpan
    )
  }

  /**
   * A key-value dispatch span also carries a local id, an operation id and a
   * server duration, all taken from the memcached response.
   */
  protected validateKvDispatchSpan(span: TestSpan, parentSpan: TestSpan): void {
    const at = spanCtx(span, 'dispatch')
    this.validateDispatchSpanCommon(span, parentSpan, DISPATCH_SPAN_NAME)
    expectNonEmptyString(
      span.attributes[DispatchAttributeName.LocalId],
      DispatchAttributeName.LocalId,
      at
    )
    expectNonEmptyString(
      span.attributes[DispatchAttributeName.OperationId],
      DispatchAttributeName.OperationId,
      at
    )
    expect(
      span.attributes[DispatchAttributeName.ServerDuration],
      withCtx(DispatchAttributeName.ServerDuration, at)
    ).toBeTypeOf('number')

    if (this.expected.serverDurationAboveZero && !this.mockBackend) {
      expect(
        span.attributes[DispatchAttributeName.ServerDuration],
        withCtx(DispatchAttributeName.ServerDuration, at)
      ).toBeGreaterThan(0)
    }
  }
}

/**
 * A row-streaming or management operation: one span carrying the service and
 * any keyspace it was scoped to, with at least one dispatch span underneath
 * unless `errorBeforeDispatch()` was declared.
 */
class HttpSpanValidator extends BaseSpanValidator {
  constructor(
    tracer: TestTracer,
    collectionDetails: CollectionDetails | undefined,
    clusterName: ClusterName
  ) {
    super(tracer, collectionDetails, clusterName)
  }

  private validateDispatchSpans(span: TestSpan): void {
    const dispatchSpans = span.children.filter(
      (child) => child.name === DISPATCH_SPAN_NAME
    )
    if (!this.expected.validateError && !this.expected.errorBeforeDispatch) {
      expect(
        dispatchSpans.length,
        withCtx('a dispatch span is expected', spanCtx(span))
      ).toBeGreaterThanOrEqual(1)
    }

    for (const dispatchSpan of dispatchSpans) {
      this.validateDispatchSpanCommon(dispatchSpan, span, DISPATCH_SPAN_NAME)
    }
  }

  private validateDeclaredKeyspace(span: TestSpan, at: AssertCtx): void {
    const { bucket, scope, collection } = this.expected
    if (bucket !== undefined) {
      expect(
        span.attributes[OpAttributeName.BucketName],
        withCtx(OpAttributeName.BucketName, at)
      ).toBe(bucket)
    }
    if (scope !== undefined) {
      expect(
        span.attributes[OpAttributeName.ScopeName],
        withCtx(OpAttributeName.ScopeName, at)
      ).toBe(scope)
    }
    if (collection !== undefined) {
      expect(
        span.attributes[OpAttributeName.CollectionName],
        withCtx(OpAttributeName.CollectionName, at)
      ).toBe(collection)
    }
  }

  private validateLeasedKeyspace(span: TestSpan, at: AssertCtx): void {
    if (this.collectionDetails) {
      expectKeyspace(span, this.collectionDetails, at)
    }
  }

  private validateStatement(span: TestSpan, at: AssertCtx): void {
    if (this.expected.statement !== undefined) {
      expect(
        span.attributes[OpAttributeName.QueryStatement],
        withCtx(OpAttributeName.QueryStatement, at)
      ).toBe(this.expected.statement)
    }
  }

  private validateOperation(
    span: TestSpan,
    opName: OpType,
    at: AssertCtx
  ): void {
    expect(
      span.attributes[OpAttributeName.OperationName],
      withCtx(OpAttributeName.OperationName, at)
    ).toBe(opName)

    const expectedService = serviceNameFromOpType(opName)
    expect(
      span.attributes[OpAttributeName.Service],
      withCtx(OpAttributeName.Service, at)
    ).toBe(expectedService)
  }

  private validateSingleSpan(span: TestSpan, opName: OpType): void {
    const at = spanCtx(span, `op=${opName}`)

    if (this.expected.parentSpan) {
      expect(span.parentSpan, withCtx('span parent', at)).toBe(
        this.expected.parentSpan
      )
    }

    this.validateBaseSpanProperties(span, opName, this.expected.validateError)
    this.validateOperation(span, opName, at)
    this.validateDeclaredKeyspace(span, at)
    this.validateStatement(span, at)

    if (!this.expected.errorBeforeDispatch) {
      expect(
        span.children,
        withCtx('the span should have children', at)
      ).not.toHaveLength(0)
      this.validateDispatchSpans(span)
    }
  }

  /**
   * A management call that touches several endpoints: each endpoint is a span
   * of its own under the outer one, with its own dispatch span.
   */
  private validateNestedSpan(
    span: TestSpan,
    opName: OpType,
    nested: readonly OpType[]
  ): void {
    const at = spanCtx(span, `nestedOps=[${nested.join(',')}]`)

    this.validateBaseSpanProperties(span, opName, this.expected.validateError)
    this.validateOperation(span, opName, at)
    this.validateLeasedKeyspace(span, at)
    this.validateStatement(span, at)

    expect(
      span.children,
      withCtx('nested spans are expected', at)
    ).not.toHaveLength(0)
    expect(
      span.children.length,
      withCtx('one span per nested operation is expected', at)
    ).toBeGreaterThanOrEqual(nested.length)

    const dispatchSpans: TestSpan[] = []

    for (const spanName of nested) {
      const childSpans = span.children.filter(
        (child) => child.name === spanName
      )
      expect(
        childSpans,
        withCtx(`a span is expected for nested op ${spanName}`, at)
      ).not.toHaveLength(0)

      dispatchSpans.push(
        ...childSpans[0].children.filter(
          (child) => child.name === DISPATCH_SPAN_NAME
        )
      )

      this.validateSingleSpanWithAttrs(childSpans[0], spanName, span, false)
    }

    expect(
      dispatchSpans.length,
      withCtx('one dispatch span per nested operation is expected', at)
    ).toBeGreaterThanOrEqual(nested.length)
  }

  private validateSingleSpanWithAttrs(
    span: TestSpan,
    opName: OpType,
    parentSpan: TestSpan | undefined,
    validateError: boolean
  ): void {
    const at = spanCtx(span, `op=${opName} | validateError=${validateError}`)

    if (parentSpan) {
      expect(span.parentSpan, withCtx('span parent', at)).toBe(parentSpan)
    }

    this.validateBaseSpanProperties(span, opName, validateError)
    this.validateOperation(span, opName, at)
    this.validateLeasedKeyspace(span, at)

    expect(
      span.children,
      withCtx('the span should have children', at)
    ).not.toHaveLength(0)

    const dispatchSpans = span.children.filter(
      (child) => child.name === DISPATCH_SPAN_NAME
    )
    if (!validateError) {
      expect(
        dispatchSpans.length,
        withCtx('a dispatch span is expected', at)
      ).toBeGreaterThanOrEqual(1)
    }

    for (const dispatchSpan of dispatchSpans) {
      this.validateDispatchSpanCommon(dispatchSpan, span, DISPATCH_SPAN_NAME)
    }
  }

  validate(): void {
    const opName = this.declaredOp()
    const span = spanFromTracer(
      this.recordingTracer,
      opName,
      this.expected.parentSpan
    )

    if (this.expected.nested) {
      this.validateNestedSpan(span, opName, this.expected.nested)
    } else {
      this.validateSingleSpan(span, opName)
    }
  }
}

/**
 * A key-value operation: one span with a dispatch span per round trip and, for
 * operations that send a body, an encoding span first. An operation the SDK
 * implements as several others records a span per underlying operation, which
 * `nestedOps()` declares.
 */
class KeyValueSpanValidator extends BaseSpanValidator {
  constructor(
    tracer: TestTracer,
    private readonly details: CollectionDetails,
    clusterName: ClusterName,
    mockBackend: boolean
  ) {
    super(tracer, details, clusterName, mockBackend)
  }

  private validateDispatchSpans(span: TestSpan): void {
    const dispatchSpans = span.children.filter(
      (child) => child.name === DISPATCH_SPAN_NAME
    )
    if (!this.expected.validateError) {
      expect(
        dispatchSpans.length,
        withCtx('a dispatch span is expected', spanCtx(span))
      ).toBeGreaterThanOrEqual(1)
    }
    for (const dispatchSpan of dispatchSpans) {
      this.validateKvDispatchSpan(dispatchSpan, span)
    }
  }

  /**
   * The encoding span must be the first child: a span is appended to its parent
   * when it opens, so a later one means the SDK encoded after sending.
   *
   * `opName` is a parameter rather than the builder's field, so validating a
   * nested operation leaves the builder describing the declared one.
   */
  private validateEncodingSpans(span: TestSpan, opName: OpType): void {
    if (!ENCODING_OPS.includes(opName)) {
      return
    }
    const at = spanCtx(span, 'encoding')
    const encodingSpans = span.children.filter(
      (child) => child.name === ENCODING_SPAN_NAME
    )
    expect(
      encodingSpans.length,
      withCtx('an encoding span is expected', at)
    ).toBeGreaterThanOrEqual(1)

    const encodingSpan = encodingSpans[0]
    expect(
      span.children[0],
      withCtx('the encoding span should be the first child', at)
    ).toBe(encodingSpan)
    expect(
      encodingSpan.parentSpan,
      withCtx('the encoding span parent', at)
    ).toBe(span)

    this.validateBaseSpanProperties(encodingSpan, ENCODING_SPAN_NAME)
  }

  private validateOperation(
    span: TestSpan,
    opName: OpType,
    at: AssertCtx
  ): void {
    expect(
      span.attributes[OpAttributeName.OperationName],
      withCtx(OpAttributeName.OperationName, at)
    ).toBe(opName)
    expect(
      span.attributes[OpAttributeName.Service],
      withCtx(OpAttributeName.Service, at)
    ).toBe(serviceNameFromOpType(opName))
  }

  private validateDurability(span: TestSpan, at: AssertCtx): void {
    if (this.expected.durability !== undefined) {
      expect(
        span.attributes[OpAttributeName.DurabilityLevel],
        withCtx(OpAttributeName.DurabilityLevel, at)
      ).toBe(this.expected.durability)
    }
  }

  private validateSingleSpan(span: TestSpan, opName: OpType): void {
    const at = spanCtx(span, `op=${opName}`)

    if (this.expected.parentSpan) {
      expect(span.parentSpan, withCtx('span parent', at)).toBe(
        this.expected.parentSpan
      )
    }

    this.validateBaseSpanProperties(span, opName, this.expected.validateError)
    this.validateOperation(span, opName, at)
    expectKeyspace(span, this.details, at)

    expect(
      span.attributes[OpAttributeName.RetryCount],
      withCtx(OpAttributeName.RetryCount, at)
    ).toBeTypeOf('number')
    if (this.expected.retryCountAboveZero) {
      expect(
        span.attributes[OpAttributeName.RetryCount],
        withCtx(OpAttributeName.RetryCount, at)
      ).toBeGreaterThan(0)
    }

    this.validateDurability(span, at)

    expect(
      span.children,
      withCtx('the span should have children', at)
    ).not.toHaveLength(0)
    this.validateDispatchSpans(span)
    this.validateEncodingSpans(span, opName)
  }

  /**
   * An operation the SDK runs as several, such as `getAllReplicas`. Exactly one
   * span per declared name is expected, except for a per replica operation,
   * which is expected at least once and has every copy validated.
   */
  private validateNestedSpan(
    span: TestSpan,
    opName: OpType,
    nested: readonly OpType[]
  ): void {
    const at = spanCtx(span, `nestedOps=[${nested.join(',')}]`)

    this.validateBaseSpanProperties(span, opName, this.expected.validateError)
    this.validateOperation(span, opName, at)
    expectKeyspace(span, this.details, at)
    this.validateDurability(span, at)

    expect(
      span.children,
      withCtx('nested spans are expected', at)
    ).not.toHaveLength(0)
    expect(
      span.children.length,
      withCtx('one span per nested operation is expected', at)
    ).toBeGreaterThanOrEqual(nested.length)

    const dispatchSpans: TestSpan[] = []

    for (const spanName of nested) {
      const childSpans = span.children.filter(
        (child) => child.name === spanName
      )
      if (PER_REPLICA_OPS.includes(spanName)) {
        expect(
          childSpans.length,
          withCtx(`at least one span is expected for ${spanName}`, at)
        ).toBeGreaterThanOrEqual(1)
      } else {
        expect(
          childSpans,
          withCtx(`exactly one span is expected for ${spanName}`, at)
        ).toHaveLength(1)
      }

      for (const childSpan of childSpans) {
        dispatchSpans.push(
          ...childSpan.children.filter(
            (child) => child.name === DISPATCH_SPAN_NAME
          )
        )
        this.validateNestedChildSpan(childSpan, spanName, span)
      }
    }

    expect(
      dispatchSpans.length,
      withCtx('one dispatch span per nested operation is expected', at)
    ).toBeGreaterThanOrEqual(nested.length)
  }

  private validateNestedChildSpan(
    span: TestSpan,
    opName: OpType,
    parentSpan: TestSpan
  ): void {
    const at = spanCtx(span, `op=${opName}`)

    expect(span.parentSpan, withCtx('span parent', at)).toBe(parentSpan)

    this.validateBaseSpanProperties(span, opName, false)
    this.validateOperation(span, opName, at)
    expectKeyspace(span, this.details, at)
    this.validateDurability(span, at)

    expect(
      span.children,
      withCtx('the span should have children', at)
    ).not.toHaveLength(0)

    const dispatchSpans = span.children.filter(
      (child) => child.name === DISPATCH_SPAN_NAME
    )
    expect(
      dispatchSpans.length,
      withCtx('a dispatch span is expected', at)
    ).toBeGreaterThanOrEqual(1)

    for (const dispatchSpan of dispatchSpans) {
      this.validateKvDispatchSpan(dispatchSpan, span)
    }

    this.validateEncodingSpans(span, opName)
  }

  validate(): void {
    const opName = this.declaredOp()
    const span = spanFromTracer(
      this.recordingTracer,
      opName,
      this.expected.parentSpan
    )

    if (this.expected.nested) {
      this.validateNestedSpan(span, opName, this.expected.nested)
    } else {
      this.validateSingleSpan(span, opName)
    }
  }
}

/**
 * A data structure operation: an outer span and one child span per key-value
 * operation it ran. `childKvOps()` declares the children, and both count and
 * order are asserted, so a retry loop shows as repeated children.
 */
class DatastructureSpanValidator extends BaseSpanValidator {
  constructor(
    tracer: TestTracer,
    private readonly details: CollectionDetails,
    clusterName: ClusterName,
    mockBackend: boolean
  ) {
    super(tracer, details, clusterName, mockBackend)
  }

  /**
   * The child's error status follows `childKvOpError()`, not `error()`:
   * `list.getAt(5)` on a two-element list fails, but the lookup it ran
   * succeeded.
   */
  private validateChildKvSpan(
    span: TestSpan,
    parentSpan: TestSpan,
    spanName: OpType
  ): void {
    const at = spanCtx(span, `childOp=${spanName}`)

    expect(span.parentSpan, withCtx('child span parent', at)).toBe(parentSpan)

    this.validateBaseSpanProperties(
      span,
      spanName,
      this.expected.validateChildKvOpError
    )
    expect(
      span.attributes[OpAttributeName.OperationName],
      withCtx(OpAttributeName.OperationName, at)
    ).toBe(spanName)
    expectKeyspace(span, this.details, at)

    expect(
      span.children,
      withCtx('the span should have children', at)
    ).not.toHaveLength(0)

    const dispatchSpans = span.children.filter(
      (child) => child.name === DISPATCH_SPAN_NAME
    )
    if (!this.expected.validateError) {
      expect(
        dispatchSpans.length,
        withCtx('a dispatch span is expected', at)
      ).toBeGreaterThanOrEqual(1)
    }

    for (const dispatchSpan of dispatchSpans) {
      this.validateKvDispatchSpan(dispatchSpan, span)
    }
  }

  validate(): void {
    const opName = this.declaredOp()
    const declaredChildren = this.expected.childKvOpNames
    expectDefined(
      declaredChildren,
      'no child operations were declared: call childKvOps() before validate()'
    )

    const dsSpan = this.recordingTracer.getSpanByName(opName)
    const at = spanCtx(dsSpan, `dsOp=${opName}`)
    expectDefined(
      dsSpan,
      withCtx('no span was recorded for this operation', at)
    )

    this.validateBaseSpanProperties(dsSpan, opName, this.expected.validateError)
    this.validateSpanTime(dsSpan, at)

    expect(
      dsSpan.children,
      withCtx('one child span per declared key-value operation', at)
    ).toHaveLength(declaredChildren.length)

    for (let i = 0; i < declaredChildren.length; ++i) {
      const childSpan = dsSpan.children[i]
      expect(childSpan.name, withCtx(`child span ${i}`, at)).toBe(
        declaredChildren[i]
      )
      this.validateChildKvSpan(childSpan, dsSpan, declaredChildren[i])
    }
  }
}

/**
 * Checks the shipped threshold tracer's arithmetic, not attributes: that the
 * durations and sockets it reports match its dispatch spans, and that the span
 * was filed on the correct side of its threshold.
 */
abstract class BaseThresholdLoggingValidator extends BaseValidator {
  protected constructor(
    protected readonly thresholdTracer: ThresholdLoggingTestTracer
  ) {
    super(thresholdTracer)
  }

  protected attributeOf(
    span: ThresholdLoggingTestSpan,
    attributeName: string
  ): string | number | null {
    const value = span.testAttributes[attributeName]
    return typeof value === 'string' || typeof value === 'number' ? value : null
  }

  protected collectSpansByName(
    targetName: string,
    currentSpan: ThresholdLoggingTestSpan
  ): ThresholdLoggingTestSpan[] {
    const found: ThresholdLoggingTestSpan[] = []
    if (currentSpan.name === targetName) {
      found.push(currentSpan)
    }
    for (const child of currentSpan.children) {
      found.push(...this.collectSpansByName(targetName, child))
    }
    return found
  }

  protected durationOf(span: ThresholdLoggingTestSpan): number {
    const endTime = span._endTime
    expectDefined(endTime, withCtx('the span should have ended', spanCtx(span)))
    return hiResTimeToMicros(getHiResTimeDelta(span._startTime, endTime))
  }

  /** The socket string the shipped span builds; null when both are null. */
  private socketOf(
    address: string | number | null,
    port: string | number | null
  ): string | null {
    if (address === null && port === null) {
      return null
    }
    return `${address ?? ''}:${port ?? ''}`
  }

  /**
   * Totals are summed over every dispatch span; single-dispatch figures come
   * from the last one, as the shipped span keeps the attempt that succeeded.
   */
  protected validateDispatchFigures(span: ThresholdLoggingTestSpan): void {
    const at = spanCtx(span, 'dispatch')
    const dispatchSpans = this.collectSpansByName(DISPATCH_SPAN_NAME, span)
    expect(
      dispatchSpans.length,
      withCtx('a dispatch span is expected', at)
    ).toBeGreaterThan(0)
    const dispatchTotalTime = dispatchSpans.reduce(
      (total, dispatchSpan) => total + this.durationOf(dispatchSpan),
      0
    )
    const lastDispatch = dispatchSpans[dispatchSpans.length - 1]
    const lastLocalSocket = this.socketOf(
      this.attributeOf(lastDispatch, DispatchAttributeName.PeerAddress),
      this.attributeOf(lastDispatch, DispatchAttributeName.PeerPort)
    )
    const lastRemoteSocket = this.socketOf(
      this.attributeOf(lastDispatch, DispatchAttributeName.ServerAddress),
      this.attributeOf(lastDispatch, DispatchAttributeName.ServerPort)
    )

    expect(
      span.totalDispatchDuration,
      withCtx('totalDispatchDuration', at)
    ).toBe(dispatchTotalTime)
    expect(span.dispatchDuration, withCtx('dispatchDuration', at)).toBe(
      this.durationOf(lastDispatch)
    )
    expect(span.localId, withCtx('localId', at)).toBe(
      this.attributeOf(lastDispatch, DispatchAttributeName.LocalId)
    )
    expect(span.operationId, withCtx('operationId', at)).toBe(
      this.attributeOf(lastDispatch, DispatchAttributeName.OperationId)
    )
    expect(span.remoteSocket, withCtx('remoteSocket', at)).toBe(
      lastRemoteSocket
    )
    expect(span.localSocket, withCtx('localSocket', at)).toBe(lastLocalSocket)

    this.validateServiceDispatchFigures(span, dispatchSpans, at)
  }

  /**
   * Service-specific dispatch figures. None by default: server duration comes
   * from the memcached response, so an HTTP span has none.
   */
  protected validateServiceDispatchFigures(
    _span: ThresholdLoggingTestSpan,
    _dispatchSpans: readonly ThresholdLoggingTestSpan[],
    _at: AssertCtx
  ): void {}

  protected validateServiceFigures(_span: ThresholdLoggingTestSpan): void {}

  private validateThresholdFiling(
    span: ThresholdLoggingTestSpan,
    at: AssertCtx
  ): void {
    const totalDuration = this.durationOf(span)
    const serviceType = span.serviceType
    expectDefined(serviceType, withCtx('the span should name its service', at))
    const threshold = this.thresholdTracer._getServiceTypeThreshold(serviceType)
    const snapshot = span.snapshot
    expectDefined(
      snapshot,
      withCtx('the span should have a snapshot, so should have ended', at)
    )
    if (totalDuration > threshold) {
      expect(
        this.thresholdTracer.overThresholdSpans,
        withCtx('the span should be filed over its threshold', at)
      ).toContain(snapshot)
    } else {
      expect(
        this.thresholdTracer.underThresholdSpans,
        withCtx('the span should be filed under its threshold', at)
      ).toContain(snapshot)
    }
  }

  protected validateOne(span: ThresholdLoggingTestSpan, opName: OpType): void {
    if (!this.expected.errorBeforeDispatch) {
      this.validateDispatchFigures(span)
    }
    this.validateServiceFigures(span)
    this.validateThresholdFiling(
      span,
      spanCtx(span, `op=${opName} | spanName=${span.name}`)
    )
  }

  validate(): void {
    const opName = this.declaredOp()
    const span = spanFromTracer(
      this.thresholdTracer,
      opName,
      this.expected.parentSpan
    )
    this.validateOne(span, opName)
  }
}

class HttpThresholdLoggingValidator extends BaseThresholdLoggingValidator {
  constructor(tracer: ThresholdLoggingTestTracer) {
    super(tracer)
  }
}

/**
 * Adds the two server durations and the encoding total to the HTTP figures.
 *
 * A data structure operation is validated through its children: the shipped
 * span folds its timings into the key-value operations underneath, so the
 * outer span has no dispatch of its own.
 */
class KeyValueThresholdLoggingValidator extends BaseThresholdLoggingValidator {
  constructor(
    tracer: ThresholdLoggingTestTracer,
    private readonly isDsOp = false
  ) {
    super(tracer)
  }

  protected override validateServiceDispatchFigures(
    span: ThresholdLoggingTestSpan,
    dispatchSpans: readonly ThresholdLoggingTestSpan[],
    at: AssertCtx
  ): void {
    expect(
      dispatchSpans.length,
      withCtx('a dispatch span is expected for the server duration', at)
    ).toBeGreaterThan(0)
    const lastDispatch = dispatchSpans[dispatchSpans.length - 1]
    const totalServerDuration = dispatchSpans.reduce((total, dispatchSpan) => {
      const duration = this.attributeOf(
        dispatchSpan,
        DispatchAttributeName.ServerDuration
      )
      return total + (typeof duration === 'number' ? duration : 0)
    }, 0)

    expect(span.totalServerDuration, withCtx('totalServerDuration', at)).toBe(
      totalServerDuration
    )
    expect(span.serverDuration, withCtx('serverDuration', at)).toBe(
      this.attributeOf(lastDispatch, DispatchAttributeName.ServerDuration) ?? 0
    )
  }

  protected override validateServiceFigures(
    span: ThresholdLoggingTestSpan
  ): void {
    const at = spanCtx(span, 'encoding')
    const encodingSpans = this.collectSpansByName(ENCODING_SPAN_NAME, span)
    const encodingTotalTime = encodingSpans.reduce(
      (total, encodingSpan) => total + this.durationOf(encodingSpan),
      0
    )
    expect(span.totalEncodeDuration, withCtx('totalEncodeDuration', at)).toBe(
      encodingTotalTime
    )
  }

  override validate(): void {
    const opName = this.declaredOp()
    const span = spanFromTracer(
      this.thresholdTracer,
      opName,
      this.expected.parentSpan
    )

    if (this.isDsOp) {
      const childOps = this.expected.childKvOpNames
      expectDefined(
        childOps,
        'no child operations were declared: call childKvOps() before validate()'
      )
      expect(
        span.children,
        withCtx(
          'one child span per declared key-value operation',
          spanCtx(span, `dsOp=${opName}`)
        )
      ).toHaveLength(childOps.length)
      for (const childSpan of span.children) {
        this.validateOne(childSpan, opName)
      }
    } else {
      this.validateOne(span, opName)
    }
  }
}

/**
 * A tracer that opted out: nothing may reach it. The suite runs the same
 * operations as against the recording tracer, so a handler that ignored the
 * no-op selection would open spans here.
 */
class NoOpValidator extends BaseValidator {
  constructor(private readonly noOpTracer: NoOpTestTracer) {
    super(noOpTracer)
  }

  validate(): void {
    expect(
      this.noOpTracer,
      'the suite is expected to be running against a no-op tracer'
    ).toBeInstanceOf(NoOpTracer)

    const parentSpan = this.expected.parentSpan
    if (parentSpan) {
      expect(
        parentSpan,
        'a parent span opened under a no-op tracer should be a no-op span'
      ).toBeInstanceOf(NoOpSpan)
      expect(
        this.noOpTracer.spans,
        'only the parent span the test opened should be present'
      ).toHaveLength(1)
      expect(
        this.noOpTracer.spans[0],
        'the first span should be the parent span'
      ).toBe(parentSpan)
    } else {
      expect(
        this.noOpTracer.spans,
        'a no-op tracer should have been asked for no spans'
      ).toHaveLength(0)
    }
  }
}

export function createKeyValueValidator(
  tracer: AnyTestTracer,
  collectionDetails: CollectionDetails,
  clusterName: ClusterName,
  mockBackend = false
): TracingValidator {
  if (tracer instanceof NoOpTestTracer) {
    return new NoOpValidator(tracer)
  }
  if (tracer instanceof ThresholdLoggingTestTracer) {
    return new KeyValueThresholdLoggingValidator(tracer)
  }
  return new KeyValueSpanValidator(
    tracer,
    collectionDetails,
    clusterName,
    mockBackend
  )
}

export function createDatastructureValidator(
  tracer: AnyTestTracer,
  collectionDetails: CollectionDetails,
  clusterName: ClusterName,
  mockBackend = false
): TracingValidator {
  if (tracer instanceof NoOpTestTracer) {
    return new NoOpValidator(tracer)
  }
  if (tracer instanceof ThresholdLoggingTestTracer) {
    return new KeyValueThresholdLoggingValidator(tracer, true)
  }
  return new DatastructureSpanValidator(
    tracer,
    collectionDetails,
    clusterName,
    mockBackend
  )
}

export function createHttpValidator(
  tracer: AnyTestTracer,
  collectionDetails: CollectionDetails | undefined,
  clusterName: ClusterName
): TracingValidator {
  if (tracer instanceof NoOpTestTracer) {
    return new NoOpValidator(tracer)
  }
  if (tracer instanceof ThresholdLoggingTestTracer) {
    return new HttpThresholdLoggingValidator(tracer)
  }
  return new HttpSpanValidator(tracer, collectionDetails, clusterName)
}

function expectKeyspace(
  span: TestSpan,
  details: CollectionDetails,
  at: AssertCtx
): void {
  expect(
    span.attributes[OpAttributeName.BucketName],
    withCtx(OpAttributeName.BucketName, at)
  ).toBe(details.bucketName)
  expect(
    span.attributes[OpAttributeName.ScopeName],
    withCtx(OpAttributeName.ScopeName, at)
  ).toBe(details.scopeName)
  expect(
    span.attributes[OpAttributeName.CollectionName],
    withCtx(OpAttributeName.CollectionName, at)
  ).toBe(details.collName)
}

/**
 * Also used by the metrics validators; keep the tracing side free of imports
 * from the metrics side to avoid a cycle.
 */
export function expectNonEmptyString(
  value: unknown,
  what: string,
  at: AssertCtx
): void {
  expect(value, withCtx(`${what} should be a string`, at)).toBeTypeOf('string')
  expect(value, withCtx(`${what} should not be empty`, at)).not.toBe('')
}
