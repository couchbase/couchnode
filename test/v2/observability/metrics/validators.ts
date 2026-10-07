// A fluent builder, because a metric assertion has six independent parts and a
// test sets two or three of them:
//
//     validator.reset().op(KeyValueOp.Get).error(true)
//     await collection.get('not-a-key').catch(() => undefined)
//     validator.validate()
//
// `reset()` clears the meter as well as the expectation, so `validate()` sees
// only what the operation between the two calls recorded, and can assert
// exactly one metric for exactly this operation.
//
// The cluster name label is compared against `env.clusterName()`. The uuid has
// no independent source and is only asserted to be a non-empty string.

import { expect } from 'vitest'

import { NoOpMeter } from '../../../../lib/observability'
import {
  DatastructureOp,
  OpAttributeName,
  OpType,
} from '../../../../lib/observabilitytypes'
import { AssertCtx, withCtx } from '../../asserts/ctx'
import { expectDefined } from '../../asserts/defined'
import { ClusterName, expectNonEmptyString } from '../tracing/validators'
import {
  AnyTestMeter,
  NoOpTestMeter,
  TestMeter,
  TestValueRecorder,
} from './metertypes'

export interface KeyValueDetails {
  readonly bucketName: string
  readonly scopeName: string
  readonly collectionName: string
}

export interface MetricsValidator {
  /** Clears the expectation and, unless told otherwise, the meter with it. */
  reset(opts?: { readonly clearRecords?: boolean }): this
  op(value: OpType): this
  /** Whether the metric is expected to carry an `error.type`. */
  error(flag?: boolean): this
  /**
   * Operations the SDK is expected to have recorded underneath `op`, one entry
   * per recording. `atLeast` is for a call that polls, where how many times it
   * asks depends on the server.
   */
  nestedOps(
    value: readonly OpType[],
    opts?: { readonly atLeast?: boolean }
  ): this
  /**
   * The nested operations a failing data structure operation expects to carry
   * an `error.type`. Such an operation records no metric of its own, so this is
   * the only place its failure shows.
   */
  nestedErrors(value: readonly OpType[]): this
  bucketName(value: string): this
  scopeName(value: string): this
  collectionName(value: string): this
  /** Asserts everything declared since the last `reset()`. */
  validate(): void
}

interface Expectation {
  opName: OpType | undefined
  validateError: boolean
  nested: readonly OpType[] | undefined
  nestedAtLeast: boolean
  nestedErrors: ReadonlySet<OpType>
  bucket: string | undefined
  scope: string | undefined
  collection: string | undefined
}

function noExpectation(): Expectation {
  return {
    opName: undefined,
    validateError: false,
    nested: undefined,
    nestedAtLeast: false,
    nestedErrors: new Set(),
    bucket: undefined,
    scope: undefined,
    collection: undefined,
  }
}

abstract class BaseValidator implements MetricsValidator {
  protected expected: Expectation = noExpectation()

  protected constructor(private readonly clearable: { clear(): void }) {}

  reset({ clearRecords = true } = {}): this {
    this.expected = noExpectation()
    if (clearRecords) {
      this.clearable.clear()
    }
    return this
  }

  op(value: OpType): this {
    this.expected.opName = value
    return this
  }

  error(flag = true): this {
    this.expected.validateError = flag
    return this
  }

  nestedOps(
    value: readonly OpType[],
    { atLeast = false }: { readonly atLeast?: boolean } = {}
  ): this {
    this.expected.nested = value
    this.expected.nestedAtLeast = atLeast
    return this
  }

  nestedErrors(value: readonly OpType[]): this {
    this.expected.nestedErrors = new Set(value)
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

function recorderCtx(
  recorder: TestValueRecorder | undefined,
  extra?: string
): AssertCtx {
  if (!recorder) {
    return { extra }
  }
  const parts = [
    `name=${recorder.name}`,
    `attrs=${Object.keys(recorder.attributes).join(',')}`,
  ]
  if (recorder.opName) {
    parts.push(`opName=${recorder.opName}`)
  }
  parts.push(`values=${recorder.values.join(',')}`)
  if (extra) {
    parts.push(extra)
  }
  return { extra: parts.join(' | ') }
}

/** Every data structure operation, which records no metric of its own. */
const DS_OPS: ReadonlySet<OpType> = new Set(Object.values(DatastructureOp))

abstract class RecordingValidator extends BaseValidator {
  protected constructor(
    protected readonly meter: TestMeter,
    protected readonly clusterName: ClusterName
  ) {
    super(meter)
  }

  /**
   * `isDatastructureOp` inverts the assertion: a data structure operation
   * records only the key-value operations it is built from, so a recorder for
   * it is the failure.
   */
  protected recorderFor(
    opName: OpType,
    isDatastructureOp = false
  ): TestValueRecorder | undefined {
    const at = { op: opName } satisfies AssertCtx

    expect(
      this.meter.recorders.size,
      withCtx('the meter should hold exactly one metric name', at)
    ).toBe(1)
    expect(
      this.meter.recorders.get(OpAttributeName.MeterNameOpDuration) ?? [],
      withCtx(
        `${OpAttributeName.MeterNameOpDuration} should have been recorded`,
        at
      )
    ).not.toHaveLength(0)

    const recorder = this.meter.getValueRecorderByOpName(opName)

    if (isDatastructureOp) {
      expect(
        recorder,
        withCtx(
          'a data structure operation should record no metric of its own',
          at
        )
      ).toBeUndefined()
      return undefined
    }

    expect(
      recorder,
      withCtx('no metric was recorded for this operation', at)
    ).toBeDefined()
    return recorder
  }

  /** The attributes every recorded metric carries, whatever the operation. */
  protected validateBaseProperties(
    recorder: TestValueRecorder | undefined,
    opName: OpType,
    validateError: boolean
  ): TestValueRecorder {
    const at = recorderCtx(recorder, `expectedOp=${opName}`)
    expectDefined(recorder, withCtx('the recorder should be defined', at))
    const attrs = recorder.attributes

    expect(recorder.opName, withCtx('recorder operation name', at)).toBe(opName)
    expect(attrs, withCtx('recorder attributes', at)).toBeTypeOf('object')
    expect(
      attrs[OpAttributeName.SystemName],
      withCtx(OpAttributeName.SystemName, at)
    ).toBe('couchbase')
    expect(
      attrs[OpAttributeName.ReservedUnit],
      withCtx(OpAttributeName.ReservedUnit, at)
    ).toBe(OpAttributeName.ReservedUnitSeconds)

    if (this.clusterName !== null) {
      expect(
        attrs[OpAttributeName.ClusterName],
        withCtx(OpAttributeName.ClusterName, at)
      ).toBe(this.clusterName)
      expectNonEmptyString(
        attrs[OpAttributeName.ClusterUUID],
        OpAttributeName.ClusterUUID,
        at
      )
    }

    if (validateError) {
      expectNonEmptyString(
        attrs[OpAttributeName.ErrorType],
        OpAttributeName.ErrorType,
        at
      )
    }

    return recorder
  }

  protected abstract validateMetrics(
    recorder: TestValueRecorder | undefined,
    opName: OpType,
    validateError: boolean
  ): void

  validate(): void {
    const opName = this.declaredOp()
    const { nested, nestedAtLeast, nestedErrors, validateError } = this.expected
    const isDatastructureOp = DS_OPS.has(opName)
    const at = { op: opName } satisfies AssertCtx

    if (isDatastructureOp) {
      // There is nothing at the top level for an error to be checked on, so a
      // declared one could only ever pass.
      expect(
        validateError,
        withCtx(
          'a data structure failure is declared with nestedErrors(), not error()',
          at
        )
      ).toBe(false)
      this.recorderFor(opName, true)
    } else {
      expect(
        [...nestedErrors],
        withCtx('only a data structure operation reads nestedErrors()', at)
      ).toHaveLength(0)
      this.validateMetrics(this.recorderFor(opName), opName, validateError)
    }

    // Regression guard (JSCBC-1485): every recording of a nested operation is
    // counted and checked, so N declared entries need N recorders.
    for (const [nestedOp, declared] of countByOp(nested ?? [])) {
      const recorders = this.meter.getValueRecordersByOpName(nestedOp)
      const nestedAt = { op: opName, extra: `nested=${nestedOp}` }
      if (nestedAtLeast) {
        expect(
          recorders.length,
          withCtx(`at least ${declared} recordings are expected`, nestedAt)
        ).toBeGreaterThanOrEqual(declared)
      } else {
        expect(
          recorders.length,
          withCtx('one recording per declared entry is expected', nestedAt)
        ).toBe(declared)
      }

      // Regression guard (JSCBC-1484): a data structure operation's nested
      // metrics are checked for `error.type`, present on the operations
      // declared to fail and absent on the rest.
      const failed = nestedErrors.has(nestedOp)
      for (const recorder of recorders) {
        if (!isDatastructureOp) {
          this.validateMetrics(recorder, nestedOp, validateError)
          continue
        }
        this.validateMetrics(recorder, nestedOp, failed)
        if (!failed) {
          expect(
            recorder.attributes[OpAttributeName.ErrorType],
            withCtx(
              `${OpAttributeName.ErrorType} on a nested operation that succeeded`,
              recorderCtx(recorder, `expectedOp=${nestedOp}`)
            )
          ).toBeUndefined()
        }
      }
    }
  }
}

function countByOp(ops: readonly OpType[]): Map<OpType, number> {
  const counts = new Map<OpType, number>()
  for (const op of ops) {
    counts.set(op, (counts.get(op) ?? 0) + 1)
  }
  return counts
}

/** A key-value metric, which names the full keyspace it operated on. */
class KeyValueRecorderValidator extends RecordingValidator {
  constructor(
    meter: TestMeter,
    private readonly details: KeyValueDetails,
    clusterName: ClusterName
  ) {
    super(meter, clusterName)
  }

  protected validateMetrics(
    recorder: TestValueRecorder | undefined,
    opName: OpType,
    validateError: boolean
  ): void {
    const found = this.validateBaseProperties(recorder, opName, validateError)
    const at = recorderCtx(found, `expectedOp=${opName}`)
    const attrs = found.attributes

    expect(
      attrs[OpAttributeName.OperationName],
      withCtx(OpAttributeName.OperationName, at)
    ).toBe(opName)
    expect(
      attrs[OpAttributeName.BucketName],
      withCtx(OpAttributeName.BucketName, at)
    ).toBe(this.details.bucketName)
    expect(
      attrs[OpAttributeName.ScopeName],
      withCtx(OpAttributeName.ScopeName, at)
    ).toBe(this.details.scopeName)
    expect(
      attrs[OpAttributeName.CollectionName],
      withCtx(OpAttributeName.CollectionName, at)
    ).toBe(this.details.collectionName)
  }
}

/**
 * An HTTP metric, whose keyspace attributes are asserted only when declared: a
 * cluster-level query names no bucket, a scope-level one names bucket and
 * scope, and a view query names only the bucket.
 */
class HttpRecorderValidator extends RecordingValidator {
  constructor(meter: TestMeter, clusterName: ClusterName) {
    super(meter, clusterName)
  }

  protected validateMetrics(
    recorder: TestValueRecorder | undefined,
    opName: OpType,
    validateError: boolean
  ): void {
    const found = this.validateBaseProperties(recorder, opName, validateError)
    const at = recorderCtx(found, `expectedOp=${opName}`)
    const attrs = found.attributes

    expect(
      attrs[OpAttributeName.OperationName],
      withCtx(OpAttributeName.OperationName, at)
    ).toBe(opName)

    if (this.expected.bucket !== undefined) {
      expect(
        attrs[OpAttributeName.BucketName],
        withCtx(OpAttributeName.BucketName, at)
      ).toBe(this.expected.bucket)
    }
    if (this.expected.scope !== undefined) {
      expect(
        attrs[OpAttributeName.ScopeName],
        withCtx(OpAttributeName.ScopeName, at)
      ).toBe(this.expected.scope)
    }
    if (this.expected.collection !== undefined) {
      expect(
        attrs[OpAttributeName.CollectionName],
        withCtx(OpAttributeName.CollectionName, at)
      ).toBe(this.expected.collection)
    }
  }
}

/**
 * A meter that opted out: nothing may reach it. The suite runs the same
 * operations as against the recording meter, so a handler that ignored the
 * no-op selection would put recorders here.
 */
class NoOpRecorderValidator extends BaseValidator {
  constructor(private readonly meter: NoOpTestMeter) {
    super(meter)
  }

  validate(): void {
    expect(
      this.meter,
      'the suite is expected to be running against a no-op meter'
    ).toBeInstanceOf(NoOpMeter)
    expect(
      [...this.meter.recorders.keys()],
      'a no-op meter should have been given no recorders to create'
    ).toHaveLength(0)
  }
}

export function createKeyValueValidator(
  meter: AnyTestMeter,
  details: KeyValueDetails,
  clusterName: ClusterName
): MetricsValidator {
  return meter instanceof NoOpTestMeter
    ? new NoOpRecorderValidator(meter)
    : new KeyValueRecorderValidator(meter, details, clusterName)
}

export function createHttpValidator(
  meter: AnyTestMeter,
  clusterName: ClusterName
): MetricsValidator {
  return meter instanceof NoOpTestMeter
    ? new NoOpRecorderValidator(meter)
    : new HttpRecorderValidator(meter, clusterName)
}
