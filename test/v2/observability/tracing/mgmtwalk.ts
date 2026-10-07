// Shared by `tracingmgmt.exclusive.test.ts` and
// `tracingeventing.periodic.test.ts`. A caller brings the operation and the
// call; this decides what the mode adds to it and when the validator is read.

import type { Bucket } from '../../../../lib/bucket'
import type { Cluster } from '../../../../lib/cluster'
import { CouchbaseError } from '../../../../lib/errors'
import { OpType } from '../../../../lib/observabilitytypes'
import type { AssertCtx } from '../../asserts/ctx'
import { expectThrows } from '../../asserts/errors'
import { TestEnv } from '../../infra/env'
import { TracedTarget, TracerKind, tracedTarget } from './target'
import type { AnyTestSpan } from './tracingtypes'
import { TracingValidator, createHttpValidator } from './validators'

export interface TracingTarget {
  readonly cluster: Cluster
  readonly bucket: Bucket
  readonly validator: TracingValidator
  /** The tracer a parented walk opens its span on, and its connection. */
  readonly traced: TracedTarget
}

export async function targetFor(
  env: TestEnv,
  kind: TracerKind
): Promise<TracingTarget> {
  const target = await tracedTarget(env, kind)
  return {
    cluster: target.cluster,
    bucket: target.cluster.bucket(env.config.bucket),
    // No collection details: every assertion here declares the keyspace it
    // expects, and the one walk that runs in a leased collection asserts on
    // index operations, which name no keyspace on their span.
    validator: createHttpValidator(
      target.tracer,
      undefined,
      target.clusterName
    ),
    traced: target,
  }
}

export interface Parented {
  readonly parentSpan?: AnyTestSpan
}

/**
 * The difference between a plain walk and a parented one. `declare` resets the
 * validator, declares the operation, and returns what the call should carry.
 */
export interface Mode {
  readonly suffix: string
  readonly declare: (target: TracingTarget, op: OpType) => Parented
}

export const PLAIN: Mode = {
  suffix: '',
  declare: (target, op) => {
    target.validator.reset().op(op)
    return {}
  },
}

export const PARENTED: Mode = {
  suffix: ' w/ parent span',
  declare: (target, op) => {
    // Reset before opening the parent: `reset()` clears the tracer, and would
    // take a span opened before it along.
    target.validator.reset()
    const parentSpan = target.traced.tracer.requestSpan(`${op}-parent-span`)
    target.validator.op(op).parent(parentSpan)
    return { parentSpan }
  },
}

export const MODES: readonly Mode[] = [PLAIN, PARENTED]

/**
 * Declares one operation, runs it, and asserts the span it recorded. `also`
 * adds further expectations (usually the keyspace) after the mode has declared
 * the operation.
 */
export async function step<T>(
  target: TracingTarget,
  mode: Mode,
  op: OpType,
  call: (opts: Parented) => Promise<T>,
  also?: (validator: TracingValidator) => void
): Promise<T> {
  const opts = mode.declare(target, op)
  also?.(target.validator)
  const result = await call(opts)
  target.validator.validate()
  return result
}

/**
 * As `step`, for an operation expected to fail. Success fails the step; the
 * span is validated either way.
 */
export async function failingStep(
  target: TracingTarget,
  mode: Mode,
  op: OpType,
  call: (opts: Parented) => Promise<unknown>,
  at: AssertCtx,
  also?: (validator: TracingValidator) => void
): Promise<void> {
  const opts = mode.declare(target, op)
  also?.(target.validator)
  target.validator.error(true)
  await expectThrows(() => call(opts), CouchbaseError, undefined, at)
  target.validator.validate()
}
