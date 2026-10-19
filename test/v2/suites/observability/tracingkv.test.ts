import { describe, expect } from 'vitest'
import type { TestError } from 'vitest'

import type { Collection } from '../../../../lib/collection'
import { GetReplicaStrategy, ReplicaIndex } from '../../../../lib/collection'
import type {
  CounterResult,
  ExistsResult,
  GetReplicaResult,
  GetResult,
  LookupInReplicaResult,
  LookupInResult,
  MutateInResult,
  MutationResult,
} from '../../../../lib/crudoptypes'
import {
  CouchbaseError,
  DecodingFailureError,
  EncodingFailureError,
} from '../../../../lib/errors'
import { DurabilityLevel } from '../../../../lib/generaltypes'
import { KeyValueOp } from '../../../../lib/observabilitytypes'
import { LookupInSpec, MutateInSpec } from '../../../../lib/sdspecs'
import type { Transcoder } from '../../../../lib/transcoders'
import { expectThrows } from '../../asserts/errors'
import { awaitCallback } from '../../infra/callbacks'
import { ServerFeature } from '../../infra/capabilities'
import { TestEnv } from '../../infra/env'
import type { CollectionLease } from '../../infra/leases/collection-lease'
import { skipWithoutReplicas, waitUntilReplicated } from '../../infra/replicas'
import { CollectionStrategy } from '../../infra/requirements'
import { defineSuite } from '../../infra/suite'
import {
  TRACER_KINDS,
  TracerKind,
  tracedCollection,
  tracedTarget,
} from '../../observability/tracing/target'
import type { AnyTestSpan } from '../../observability/tracing/tracingtypes'
import {
  TracingValidator,
  createKeyValueValidator,
} from '../../observability/tracing/validators'

// Every key-value operation records one span naming itself, its keyspace and
// its retry count, with a dispatch span per round trip underneath it.
//
// The leased named collection is what makes the scope and collection name
// assertions meaningful: `_default` against `_default` would pass an SDK that
// hardcoded them. An error test asserts the failure itself, because under the
// no-op tracer nothing else would catch an operation that succeeded.

const OBJECT_VALUE = { foo: 'bar', baz: 19 }
const MISSING_KEY = 'not-a-key'
const LOCK_SECONDS = 5
/**
 * Must stay under the upsert timeout in the retries test, or the upsert fails
 * with `AmbiguousTimeoutError` instead of retrying through. The timeout is
 * well above the lock because the retry backoff grows.
 */
const RETRY_LOCK_SECONDS = 1
const TOUCH_SECONDS = 1
const COUNTER_START = 14
const COUNTER_DELTA = 3
const RETRY_TIMEOUT_MS = 10_000

const WRONG_CAS = '100'

const DURABILITY = 'majority'

/**
 * Reruns a durable write the server reports ambiguous. A single write can
 * stall for the server's whole durability limit, so a longer timeout only
 * waits longer. These tests assert the span, not the durability.
 */
const SYNC_WRITE_AMBIGUOUS_OPTS = {
  retry: {
    count: 2,
    delay: 1000,
    condition: (err: TestError) => err.name === 'DurabilityAmbiguousError',
  },
}

/**
 * Reruns an any-replica read when a sibling read's span arrives unfinished,
 * with no peer socket or server duration (CXXCBC-1058). Only the assertions
 * such a span trips are rerun. Drop this once the core fix lands.
 */
const OPEN_SIBLING_SPAN_OPTS = {
  retry: {
    count: 3,
    delay: 1000,
    condition: new RegExp(
      '^(network\\.peer\\.|server\\.|couchbase\\.server_duration|' +
        'totalDispatchDuration|dispatchDuration|totalServerDuration|' +
        'serverDuration|localId|operationId|remoteSocket|localSocket)\\b'
    ),
  },
}

/**
 * The encode failure happens before the operation reaches the network, so the
 * span carries an error status and no dispatch span.
 */
const failingTranscoder: Transcoder = {
  encode: () => {
    throw new EncodingFailureError(new Error('encode error'))
  },
  decode: () => {
    throw new DecodingFailureError(new Error('decode error'))
  },
}

interface TracingTarget {
  readonly collection: Collection
  readonly validator: TracingValidator
  readonly parentSpan: (name: string) => AnyTestSpan
}

async function targetFor(
  env: TestEnv,
  lease: CollectionLease,
  kind: TracerKind
): Promise<TracingTarget> {
  const target = await tracedTarget(env, kind)
  return {
    collection: tracedCollection(target, lease),
    validator: createKeyValueValidator(
      target.tracer,
      {
        bucketName: lease.bucketName,
        scopeName: lease.scopeName,
        collName: lease.collectionName,
      },
      target.clusterName,
      target.mockBackend
    ),
    parentSpan: (name: string) => target.tracer.requestSpan(name),
  }
}

function freshKey(_collection: Collection, env: TestEnv): Promise<string> {
  return Promise.resolve(env.key())
}

async function seededKey(
  collection: Collection,
  env: TestEnv
): Promise<string> {
  const key = env.key()
  await collection.upsert(key, OBJECT_VALUE)
  return key
}

async function counterKey(
  collection: Collection,
  env: TestEnv
): Promise<string> {
  const key = env.key()
  await collection.insert(key, COUNTER_START)
  return key
}

function missingKey(): Promise<string> {
  return Promise.resolve(MISSING_KEY)
}

function settleReplicas(
  collection: Collection,
  env: TestEnv,
  key: string,
  signal: AbortSignal
): Promise<void> {
  return waitUntilReplicated(
    env,
    collection,
    collection.scope.bucket.name,
    key,
    { signal }
  )
}

interface OpCase {
  readonly label: string
  readonly op: KeyValueOp
  readonly nested?: readonly KeyValueOp[]
  readonly arrayResult?: boolean
  readonly mutationResult?: boolean
  /** False for an any-replica read. See `serverDurationAboveZero()`. */
  readonly serverDurationAboveZero?: boolean
  /** Prepares what the successful call needs and returns its key. */
  readonly setup: (c: Collection, env: TestEnv) => Promise<string>
  /** The replica reads wait here for the replicas. */
  readonly settle?: (
    c: Collection,
    env: TestEnv,
    key: string,
    signal: AbortSignal
  ) => Promise<void>
  readonly call: (c: Collection, key: string) => Promise<unknown>
  readonly callback: (c: Collection, key: string) => Promise<unknown>
  readonly withParent: (
    c: Collection,
    key: string,
    parentSpan: AnyTestSpan
  ) => Promise<unknown>
  readonly failSetup: (c: Collection, env: TestEnv) => Promise<string>
  /** Defaults to `call`. */
  readonly fail?: (c: Collection, key: string) => Promise<unknown>
  readonly failBeforeDispatch?: boolean
  /** True when the failing call still records the nested spans. */
  readonly failNested?: boolean
  readonly durable?: (c: Collection, key: string) => Promise<unknown>
}

function expectRecordedResult(subject: OpCase, res: unknown): void {
  if (subject.arrayResult) {
    expect(res, `${subject.label} result`).toBeInstanceOf(Array)
  } else {
    expect(res, `${subject.label} result`).toBeTypeOf('object')
  }
  if (subject.mutationResult) {
    expect((res as MutationResult).cas, `${subject.label} cas`).toBeTruthy()
  }
}

/**
 * Without the `reset()`: the parent-span form resets before opening its span,
 * and a second reset would discard that span.
 */
function declareInto(
  validator: TracingValidator,
  subject: OpCase
): TracingValidator {
  validator.op(subject.op)
  if (subject.nested) {
    validator.nestedOps(subject.nested)
  }
  if (subject.serverDurationAboveZero === false) {
    validator.serverDurationAboveZero(false)
  }
  return validator
}

function declare(
  validator: TracingValidator,
  subject: OpCase
): TracingValidator {
  return declareInto(validator.reset(), subject)
}

/**
 * Seed, then reset, then run the one operation. Seeding before the `reset()`
 * keeps it out of the tracer, so exactly one span can be asserted.
 */
async function runPerform(
  subject: OpCase,
  env: TestEnv,
  lease: CollectionLease,
  kind: TracerKind,
  signal: AbortSignal
): Promise<void> {
  const { collection, validator } = await targetFor(env, lease, kind)
  const key = await subject.setup(collection, env)
  await subject.settle?.(collection, env, key, signal)

  declare(validator, subject)
  expectRecordedResult(subject, await subject.call(collection, key))
  validator.validate()
}

async function runViaCallback(
  subject: OpCase,
  env: TestEnv,
  lease: CollectionLease,
  kind: TracerKind,
  signal: AbortSignal
): Promise<void> {
  const { collection, validator } = await targetFor(env, lease, kind)
  const key = await subject.setup(collection, env)
  await subject.settle?.(collection, env, key, signal)

  declare(validator, subject)
  expectRecordedResult(subject, await subject.callback(collection, key))
  validator.validate()
}

/**
 * The parent span is opened after the `reset()`, which clears the tracer, so
 * the caller's span is the only root and the operation's its only child.
 */
async function runWithParentSpan(
  subject: OpCase,
  env: TestEnv,
  lease: CollectionLease,
  kind: TracerKind,
  signal: AbortSignal
): Promise<void> {
  const { collection, validator, parentSpan } = await targetFor(
    env,
    lease,
    kind
  )
  const key = await subject.setup(collection, env)
  await subject.settle?.(collection, env, key, signal)

  validator.reset()
  const span = parentSpan(`${subject.label}-parent-span`)
  declareInto(validator, subject).parent(span)
  expectRecordedResult(subject, await subject.withParent(collection, key, span))
  validator.validate()
}

async function runFailure(
  subject: OpCase,
  env: TestEnv,
  lease: CollectionLease,
  kind: TracerKind
): Promise<void> {
  const { collection, validator } = await targetFor(env, lease, kind)
  const key = await subject.failSetup(collection, env)
  const failing = subject.fail ?? subject.call

  validator.reset().op(subject.op).error(true)
  if (subject.failNested && subject.nested) {
    validator.nestedOps(subject.nested)
  }
  if (subject.failBeforeDispatch) {
    validator.errorBeforeDispatch(true)
  }
  await expectThrows(
    () => failing(collection, key),
    CouchbaseError,
    undefined,
    env.ctx({ op: subject.label, key })
  )
  validator.validate()
}

async function runWithDurability(
  subject: OpCase,
  env: TestEnv,
  lease: CollectionLease,
  kind: TracerKind
): Promise<void> {
  const { collection, validator } = await targetFor(env, lease, kind)
  const key = await subject.setup(collection, env)
  const durable = subject.durable
  if (!durable) {
    // A mistake in the table, not an SDK failure, so thrown, not asserted.
    throw new Error(`${subject.label} has no durable form`)
  }

  validator.reset().op(subject.op).durability(DURABILITY)
  expectRecordedResult(subject, await durable(collection, key))
  validator.validate()
}

const INSERT: OpCase = {
  label: 'insert',
  op: KeyValueOp.Insert,
  mutationResult: true,
  setup: freshKey,
  call: (c, key) => c.insert(key, OBJECT_VALUE),
  callback: (c, key) =>
    awaitCallback<MutationResult>((cb) => c.insert(key, OBJECT_VALUE, cb)),
  withParent: (c, key, parentSpan) =>
    c.insert(key, OBJECT_VALUE, { parentSpan }),
  // The one failing case that needs the document to exist.
  failSetup: seededKey,
  durable: (c, key) =>
    c.insert(key, OBJECT_VALUE, { durabilityLevel: DurabilityLevel.Majority }),
}

const REPLACE: OpCase = {
  label: 'replace',
  op: KeyValueOp.Replace,
  mutationResult: true,
  setup: seededKey,
  call: (c, key) => c.replace(key, OBJECT_VALUE),
  callback: (c, key) =>
    awaitCallback<MutationResult>((cb) => c.replace(key, OBJECT_VALUE, cb)),
  withParent: (c, key, parentSpan) =>
    c.replace(key, OBJECT_VALUE, { parentSpan }),
  failSetup: missingKey,
  durable: (c, key) =>
    c.replace(key, OBJECT_VALUE, { durabilityLevel: DurabilityLevel.Majority }),
}

const UPSERT: OpCase = {
  label: 'upsert',
  op: KeyValueOp.Upsert,
  mutationResult: true,
  setup: freshKey,
  call: (c, key) => c.upsert(key, OBJECT_VALUE),
  callback: (c, key) =>
    awaitCallback<MutationResult>((cb) => c.upsert(key, OBJECT_VALUE, cb)),
  withParent: (c, key, parentSpan) =>
    c.upsert(key, OBJECT_VALUE, { parentSpan }),
  // An upsert cannot fail on the document's state, so it fails on encoding,
  // before dispatch.
  failSetup: freshKey,
  fail: (c, key) =>
    c.upsert(key, OBJECT_VALUE, { transcoder: failingTranscoder }),
  failBeforeDispatch: true,
  durable: (c, key) =>
    c.upsert(key, OBJECT_VALUE, { durabilityLevel: DurabilityLevel.Majority }),
}

const REMOVE: OpCase = {
  label: 'remove',
  op: KeyValueOp.Remove,
  mutationResult: true,
  setup: seededKey,
  call: (c, key) => c.remove(key),
  callback: (c, key) =>
    awaitCallback<MutationResult>((cb) => c.remove(key, cb)),
  withParent: (c, key, parentSpan) => c.remove(key, { parentSpan }),
  failSetup: missingKey,
  durable: (c, key) =>
    c.remove(key, { durabilityLevel: DurabilityLevel.Majority }),
}

const MUTATE_IN_DURABLE: OpCase = {
  label: 'mutateIn',
  op: KeyValueOp.MutateIn,
  setup: seededKey,
  call: (c, key) =>
    c.mutateIn(key, [MutateInSpec.upsert('new_field', 'new_value')]),
  callback: (c, key) =>
    awaitCallback<MutateInResult>((cb) =>
      c.mutateIn(key, [MutateInSpec.upsert('new_field', 'new_value')], cb)
    ),
  withParent: (c, key, parentSpan) =>
    c.mutateIn(key, [MutateInSpec.upsert('new_field', 'new_value')], {
      parentSpan,
    }),
  failSetup: missingKey,
  durable: (c, key) =>
    c.mutateIn(key, [MutateInSpec.upsert('durability_test', 'value')], {
      durabilityLevel: DurabilityLevel.Majority,
    }),
}

const GET: OpCase = {
  label: 'get',
  op: KeyValueOp.Get,
  setup: seededKey,
  call: (c, key) => c.get(key),
  callback: (c, key) => awaitCallback<GetResult>((cb) => c.get(key, cb)),
  withParent: (c, key, parentSpan) => c.get(key, { parentSpan }),
  failSetup: missingKey,
}

const GET_AND_TOUCH: OpCase = {
  label: 'getAndTouch',
  op: KeyValueOp.GetAndTouch,
  setup: seededKey,
  call: (c, key) => c.getAndTouch(key, TOUCH_SECONDS),
  callback: (c, key) =>
    awaitCallback<GetResult>((cb) => c.getAndTouch(key, TOUCH_SECONDS, cb)),
  withParent: (c, key, parentSpan) =>
    c.getAndTouch(key, TOUCH_SECONDS, { parentSpan }),
  failSetup: missingKey,
  fail: (c, key) => c.getAndTouch(key, TOUCH_SECONDS),
}

const TOUCH: OpCase = {
  label: 'touch',
  op: KeyValueOp.Touch,
  mutationResult: true,
  setup: seededKey,
  call: (c, key) => c.touch(key, TOUCH_SECONDS),
  callback: (c, key) =>
    awaitCallback<MutationResult>((cb) => c.touch(key, TOUCH_SECONDS, cb)),
  withParent: (c, key, parentSpan) =>
    c.touch(key, TOUCH_SECONDS, { parentSpan }),
  failSetup: missingKey,
  fail: (c, key) => c.touch(key, TOUCH_SECONDS),
}

/** No failing case: a missing document is a result, not an error. */
const EXISTS: OpCase = {
  label: 'exists',
  op: KeyValueOp.Exists,
  setup: seededKey,
  call: (c, key) => c.exists(key),
  callback: (c, key) => awaitCallback<ExistsResult>((cb) => c.exists(key, cb)),
  withParent: (c, key, parentSpan) => c.exists(key, { parentSpan }),
  failSetup: missingKey,
}

const GET_PROJECT: OpCase = {
  label: 'getProject',
  op: KeyValueOp.Get,
  // A projection is a subdocument lookup underneath, traced as a nested span.
  nested: [KeyValueOp.LookupIn],
  setup: seededKey,
  call: (c, key) => c.get(key, { project: ['baz'] }),
  callback: (c, key) =>
    awaitCallback<GetResult>((cb) => c.get(key, { project: ['baz'] }, cb)),
  withParent: (c, key, parentSpan) =>
    c.get(key, { project: ['baz'], parentSpan }),
  failSetup: missingKey,
  failNested: true,
}

const GET_ALL_REPLICAS: OpCase = {
  label: 'getAllReplicas',
  op: KeyValueOp.GetAllReplicas,
  nested: [KeyValueOp.Get, KeyValueOp.GetReplica],
  arrayResult: true,
  setup: seededKey,
  settle: settleReplicas,
  call: (c, key) => c.getAllReplicas(key),
  callback: (c, key) =>
    awaitCallback<GetReplicaResult[]>((cb) => c.getAllReplicas(key, cb)),
  withParent: (c, key, parentSpan) => c.getAllReplicas(key, { parentSpan }),
  failSetup: missingKey,
}

const GET_ANY_REPLICA: OpCase = {
  label: 'getAnyReplica',
  op: KeyValueOp.GetAnyReplica,
  nested: [KeyValueOp.Get, KeyValueOp.GetReplica],
  serverDurationAboveZero: false,
  setup: seededKey,
  settle: settleReplicas,
  call: (c, key) => c.getAnyReplica(key),
  callback: (c, key) =>
    awaitCallback<GetReplicaResult>((cb) => c.getAnyReplica(key, cb)),
  withParent: (c, key, parentSpan) => c.getAnyReplica(key, { parentSpan }),
  failSetup: missingKey,
}

const GET_REPLICA: OpCase = {
  label: 'getReplica',
  op: KeyValueOp.GetReplica,
  setup: seededKey,
  settle: settleReplicas,
  call: (c, key) =>
    c.getReplica(key, GetReplicaStrategy.fromIndex(ReplicaIndex.First)),
  callback: (c, key) =>
    awaitCallback<GetReplicaResult>((cb) =>
      c.getReplica(key, GetReplicaStrategy.fromIndex(ReplicaIndex.First), cb)
    ),
  withParent: (c, key, parentSpan) =>
    c.getReplica(key, GetReplicaStrategy.fromIndex(ReplicaIndex.First), {
      parentSpan,
    }),
  failSetup: missingKey,
}

const LOOKUP_IN: OpCase = {
  label: 'lookupIn',
  op: KeyValueOp.LookupIn,
  setup: seededKey,
  call: (c, key) => c.lookupIn(key, [LookupInSpec.get('baz')]),
  callback: (c, key) =>
    awaitCallback<LookupInResult>((cb) =>
      c.lookupIn(key, [LookupInSpec.get('baz')], cb)
    ),
  withParent: (c, key, parentSpan) =>
    c.lookupIn(key, [LookupInSpec.get('baz')], { parentSpan }),
  failSetup: missingKey,
}

const MUTATE_IN: OpCase = {
  label: 'mutateIn',
  op: KeyValueOp.MutateIn,
  setup: seededKey,
  call: (c, key) =>
    c.mutateIn(key, [MutateInSpec.upsert('new_field', 'new_value')]),
  callback: (c, key) =>
    awaitCallback<MutateInResult>((cb) =>
      c.mutateIn(key, [MutateInSpec.upsert('new_field', 'new_value')], cb)
    ),
  withParent: (c, key, parentSpan) =>
    c.mutateIn(key, [MutateInSpec.upsert('new_field', 'new_value')], {
      parentSpan,
    }),
  failSetup: missingKey,
}

const LOOKUP_IN_ALL_REPLICAS: OpCase = {
  label: 'lookupInAllReplicas',
  op: KeyValueOp.LookupInAllReplicas,
  nested: [KeyValueOp.LookupIn, KeyValueOp.LookupInReplica],
  arrayResult: true,
  setup: seededKey,
  settle: settleReplicas,
  call: (c, key) => c.lookupInAllReplicas(key, [LookupInSpec.get('baz')]),
  callback: (c, key) =>
    awaitCallback<LookupInReplicaResult[]>((cb) =>
      c.lookupInAllReplicas(key, [LookupInSpec.get('baz')], cb)
    ),
  withParent: (c, key, parentSpan) =>
    c.lookupInAllReplicas(key, [LookupInSpec.get('baz')], { parentSpan }),
  failSetup: missingKey,
  failNested: true,
}

const LOOKUP_IN_ANY_REPLICA: OpCase = {
  label: 'lookupInAnyReplica',
  op: KeyValueOp.LookupInAnyReplica,
  nested: [KeyValueOp.LookupIn, KeyValueOp.LookupInReplica],
  serverDurationAboveZero: false,
  setup: seededKey,
  settle: settleReplicas,
  call: (c, key) => c.lookupInAnyReplica(key, [LookupInSpec.get('baz')]),
  callback: (c, key) =>
    awaitCallback<LookupInReplicaResult>((cb) =>
      c.lookupInAnyReplica(key, [LookupInSpec.get('baz')], cb)
    ),
  withParent: (c, key, parentSpan) =>
    c.lookupInAnyReplica(key, [LookupInSpec.get('baz')], { parentSpan }),
  failSetup: missingKey,
  failNested: true,
}

const INCREMENT: OpCase = {
  label: 'increment',
  op: KeyValueOp.Increment,
  setup: counterKey,
  call: (c, key) => c.binary().increment(key, COUNTER_DELTA),
  callback: (c, key) =>
    awaitCallback<CounterResult>((cb) =>
      c.binary().increment(key, COUNTER_DELTA, cb)
    ),
  withParent: (c, key, parentSpan) =>
    c.binary().increment(key, COUNTER_DELTA, { parentSpan }),
  failSetup: missingKey,
  fail: (c, key) => c.binary().increment(key, -1),
}

const DECREMENT: OpCase = {
  label: 'decrement',
  op: KeyValueOp.Decrement,
  setup: counterKey,
  call: (c, key) => c.binary().decrement(key, COUNTER_DELTA),
  callback: (c, key) =>
    awaitCallback<CounterResult>((cb) =>
      c.binary().decrement(key, COUNTER_DELTA, cb)
    ),
  withParent: (c, key, parentSpan) =>
    c.binary().decrement(key, COUNTER_DELTA, { parentSpan }),
  failSetup: missingKey,
  fail: (c, key) => c.binary().decrement(key, -1),
}

const APPEND: OpCase = {
  label: 'append',
  op: KeyValueOp.Append,
  setup: counterKey,
  call: (c, key) => c.binary().append(key, 'world'),
  callback: (c, key) =>
    awaitCallback<MutationResult>((cb) => c.binary().append(key, 'hello', cb)),
  withParent: (c, key, parentSpan) =>
    c.binary().append(key, 'world', { parentSpan }),
  failSetup: missingKey,
  fail: (c, key) => c.binary().append(key, 'hello'),
}

const PREPEND: OpCase = {
  label: 'prepend',
  op: KeyValueOp.Prepend,
  setup: counterKey,
  call: (c, key) => c.binary().prepend(key, 'world'),
  callback: (c, key) =>
    awaitCallback<MutationResult>((cb) => c.binary().prepend(key, 'hello', cb)),
  withParent: (c, key, parentSpan) =>
    c.binary().prepend(key, 'world', { parentSpan }),
  failSetup: missingKey,
  fail: (c, key) => c.binary().prepend(key, 'hello'),
}

for (const kind of TRACER_KINDS) {
  defineSuite(
    kind.suiteName,
    {
      tier: 'slow',
      features: [ServerFeature.KeyValue],
      collection: CollectionStrategy.Named,
    },
    (ctx) => {
      const { group, lacking, test } = ctx

      describe('#Key-Value Operations', () => {
        describe('#Mutation Operations', () => {
          describe('#insert', () => {
            test('should perform insert', ({ env, collectionLease, signal }) =>
              runPerform(INSERT, env, collectionLease, kind, signal))
            test('should perform insert via callback', ({
              env,
              collectionLease,
              signal,
            }) => runViaCallback(INSERT, env, collectionLease, kind, signal))
            test('should perform insert with parent span', ({
              env,
              collectionLease,
              signal,
            }) => runWithParentSpan(INSERT, env, collectionLease, kind, signal))
            test('should handle error in insert', ({ env, collectionLease }) =>
              runFailure(INSERT, env, collectionLease, kind))
          })

          describe('#replace', () => {
            test('should perform replace', ({ env, collectionLease, signal }) =>
              runPerform(REPLACE, env, collectionLease, kind, signal))
            test('should perform replace via callback', ({
              env,
              collectionLease,
              signal,
            }) => runViaCallback(REPLACE, env, collectionLease, kind, signal))
            test('should perform replace with parent span', ({
              env,
              collectionLease,
              signal,
            }) =>
              runWithParentSpan(REPLACE, env, collectionLease, kind, signal))
            test('should handle error in replace', ({ env, collectionLease }) =>
              runFailure(REPLACE, env, collectionLease, kind))
          })

          describe('#upsert', () => {
            test('should perform upsert', ({ env, collectionLease, signal }) =>
              runPerform(UPSERT, env, collectionLease, kind, signal))
            test('should perform upsert via callback', ({
              env,
              collectionLease,
              signal,
            }) => runViaCallback(UPSERT, env, collectionLease, kind, signal))
            test('should perform upsert with parent span', ({
              env,
              collectionLease,
              signal,
            }) => runWithParentSpan(UPSERT, env, collectionLease, kind, signal))
            test('should handle error in upsert', ({ env, collectionLease }) =>
              runFailure(UPSERT, env, collectionLease, kind))
          })

          describe('#remove', () => {
            test('should perform remove', ({ env, collectionLease, signal }) =>
              runPerform(REMOVE, env, collectionLease, kind, signal))
            test('should perform remove via callback', ({
              env,
              collectionLease,
              signal,
            }) => runViaCallback(REMOVE, env, collectionLease, kind, signal))
            test('should perform remove with parent span', ({
              env,
              collectionLease,
              signal,
            }) => runWithParentSpan(REMOVE, env, collectionLease, kind, signal))
            test('should handle error in remove', ({ env, collectionLease }) =>
              runFailure(REMOVE, env, collectionLease, kind))
            // Gated on the test, as a `group` would add a title segment.
            test.skipIf(lacking(ServerFeature.ServerDurability))(
              'should perform remove with durability',
              SYNC_WRITE_AMBIGUOUS_OPTS,
              ({ env, collectionLease }) =>
                runWithDurability(REMOVE, env, collectionLease, kind)
            )
          })

          group(
            '#Mutation Durability',
            [ServerFeature.ServerDurability],
            () => {
              test(
                'should perform insert with durability',
                SYNC_WRITE_AMBIGUOUS_OPTS,
                ({ env, collectionLease }) =>
                  runWithDurability(INSERT, env, collectionLease, kind)
              )
              test(
                'should perform replace with durability',
                SYNC_WRITE_AMBIGUOUS_OPTS,
                ({ env, collectionLease }) =>
                  runWithDurability(REPLACE, env, collectionLease, kind)
              )
              test(
                'should perform upsert with durability',
                SYNC_WRITE_AMBIGUOUS_OPTS,
                ({ env, collectionLease }) =>
                  runWithDurability(UPSERT, env, collectionLease, kind)
              )
              test(
                'should perform mutateIn with durability',
                SYNC_WRITE_AMBIGUOUS_OPTS,
                ({ env, collectionLease }) =>
                  runWithDurability(
                    MUTATE_IN_DURABLE,
                    env,
                    collectionLease,
                    kind
                  )
              )
            }
          )
        })

        describe('#Non-Mutation Operations', () => {
          describe('#get', () => {
            test('should perform get', ({ env, collectionLease, signal }) =>
              runPerform(GET, env, collectionLease, kind, signal))
            test('should perform get via callback', ({
              env,
              collectionLease,
              signal,
            }) => runViaCallback(GET, env, collectionLease, kind, signal))
            test('should perform get with parent span', ({
              env,
              collectionLease,
              signal,
            }) => runWithParentSpan(GET, env, collectionLease, kind, signal))
            test('should handle error in get', ({ env, collectionLease }) =>
              runFailure(GET, env, collectionLease, kind))
          })

          describe('#getAndTouch', () => {
            test('should perform getAndTouch', ({
              env,
              collectionLease,
              signal,
            }) => runPerform(GET_AND_TOUCH, env, collectionLease, kind, signal))
            test('should perform getAndTouch via callback', ({
              env,
              collectionLease,
              signal,
            }) =>
              runViaCallback(GET_AND_TOUCH, env, collectionLease, kind, signal))
            test('should perform getAndTouch with parent span', ({
              env,
              collectionLease,
              signal,
            }) =>
              runWithParentSpan(
                GET_AND_TOUCH,
                env,
                collectionLease,
                kind,
                signal
              ))
            test('should handle error in getAndTouch', ({
              env,
              collectionLease,
            }) => runFailure(GET_AND_TOUCH, env, collectionLease, kind))
          })

          describe('#touch', () => {
            test('should perform touch', ({ env, collectionLease, signal }) =>
              runPerform(TOUCH, env, collectionLease, kind, signal))
            test('should perform touch via callback', ({
              env,
              collectionLease,
              signal,
            }) => runViaCallback(TOUCH, env, collectionLease, kind, signal))
            test('should perform touch with parent span', ({
              env,
              collectionLease,
              signal,
            }) => runWithParentSpan(TOUCH, env, collectionLease, kind, signal))
            test('should handle error in touch', ({ env, collectionLease }) =>
              runFailure(TOUCH, env, collectionLease, kind))
          })

          group('#exists', [ServerFeature.GetMeta], () => {
            test('should perform exists', ({ env, collectionLease, signal }) =>
              runPerform(EXISTS, env, collectionLease, kind, signal))
            test('should perform exists via callback', ({
              env,
              collectionLease,
              signal,
            }) => runViaCallback(EXISTS, env, collectionLease, kind, signal))
            test('should perform exists with parent span', ({
              env,
              collectionLease,
              signal,
            }) => runWithParentSpan(EXISTS, env, collectionLease, kind, signal))
          })

          describe('#getProject', () => {
            test('should perform getProject', ({
              env,
              collectionLease,
              signal,
            }) => runPerform(GET_PROJECT, env, collectionLease, kind, signal))
            test('should perform getProject via callback', ({
              env,
              collectionLease,
              signal,
            }) =>
              runViaCallback(GET_PROJECT, env, collectionLease, kind, signal))
            test('should perform getProject with parent span', ({
              env,
              collectionLease,
              signal,
            }) =>
              runWithParentSpan(
                GET_PROJECT,
                env,
                collectionLease,
                kind,
                signal
              ))
            test('should handle error in getProject', ({
              env,
              collectionLease,
            }) => runFailure(GET_PROJECT, env, collectionLease, kind))
          })

          describe('#retries', () => {
            test('should perform kv op with retries', async ({
              env,
              collectionLease,
            }) => {
              const { collection, validator } = await targetFor(
                env,
                collectionLease,
                kind
              )
              const key = await seededKey(collection, env)
              // The lock forces the retries: the upsert cannot take the
              // document until the lock expires.
              await collection.getAndLock(key, RETRY_LOCK_SECONDS)

              validator.reset().op(KeyValueOp.Upsert).retryCountAboveZero(true)
              const res = await collection.upsert(key, OBJECT_VALUE, {
                timeout: RETRY_TIMEOUT_MS,
              })
              expect(res, 'upsert result').toBeTypeOf('object')
              validator.validate()
            })
          })
        })

        group('#Replica Operations', [ServerFeature.Replicas], () => {
          describe('#getAllReplicas', () => {
            test('should perform getAllReplicas', ({
              env,
              collectionLease,
              signal,
            }) =>
              runPerform(GET_ALL_REPLICAS, env, collectionLease, kind, signal))
            test('should perform getAllReplicas via callback', ({
              env,
              collectionLease,
              signal,
            }) =>
              runViaCallback(
                GET_ALL_REPLICAS,
                env,
                collectionLease,
                kind,
                signal
              ))
            test('should perform getAllReplicas with parent span', ({
              env,
              collectionLease,
              signal,
            }) =>
              runWithParentSpan(
                GET_ALL_REPLICAS,
                env,
                collectionLease,
                kind,
                signal
              ))
            test('should handle error in getAllReplicas', ({
              env,
              collectionLease,
            }) => runFailure(GET_ALL_REPLICAS, env, collectionLease, kind))
          })

          describe('#getAnyReplica', () => {
            test(
              'should perform getAnyReplica',
              OPEN_SIBLING_SPAN_OPTS,
              ({ env, collectionLease, signal }) =>
                runPerform(GET_ANY_REPLICA, env, collectionLease, kind, signal)
            )
            test(
              'should perform getAnyReplica via callback',
              OPEN_SIBLING_SPAN_OPTS,
              ({ env, collectionLease, signal }) =>
                runViaCallback(
                  GET_ANY_REPLICA,
                  env,
                  collectionLease,
                  kind,
                  signal
                )
            )
            test(
              'should perform getAnyReplica with parent span',
              OPEN_SIBLING_SPAN_OPTS,
              ({ env, collectionLease, signal }) =>
                runWithParentSpan(
                  GET_ANY_REPLICA,
                  env,
                  collectionLease,
                  kind,
                  signal
                )
            )
            test('should handle error in getAnyReplica', ({
              env,
              collectionLease,
            }) => runFailure(GET_ANY_REPLICA, env, collectionLease, kind))
          })

          describe('#getReplica', () => {
            test('should perform getReplica', async ({
              env,
              collectionLease,
              signal,
              skip,
            }) => {
              await skipWithoutReplicas(env, collectionLease.bucketName, skip)
              return runPerform(GET_REPLICA, env, collectionLease, kind, signal)
            })
            test('should perform getReplica via callback', async ({
              env,
              collectionLease,
              signal,
              skip,
            }) => {
              await skipWithoutReplicas(env, collectionLease.bucketName, skip)
              return runViaCallback(
                GET_REPLICA,
                env,
                collectionLease,
                kind,
                signal
              )
            })
            test('should perform getReplica with parent span', async ({
              env,
              collectionLease,
              signal,
              skip,
            }) => {
              await skipWithoutReplicas(env, collectionLease.bucketName, skip)
              return runWithParentSpan(
                GET_REPLICA,
                env,
                collectionLease,
                kind,
                signal
              )
            })
            test('should handle error in getReplica', ({
              env,
              collectionLease,
            }) => runFailure(GET_REPLICA, env, collectionLease, kind))
          })
        })

        describe('#Subdoc Operations', () => {
          describe('#lookupIn', () => {
            test('should perform lookupIn', ({
              env,
              collectionLease,
              signal,
            }) => runPerform(LOOKUP_IN, env, collectionLease, kind, signal))
            test('should perform lookupIn via callback', ({
              env,
              collectionLease,
              signal,
            }) => runViaCallback(LOOKUP_IN, env, collectionLease, kind, signal))
            test('should perform lookupIn with parent span', ({
              env,
              collectionLease,
              signal,
            }) =>
              runWithParentSpan(LOOKUP_IN, env, collectionLease, kind, signal))
            test('should handle error in lookupIn', ({
              env,
              collectionLease,
            }) => runFailure(LOOKUP_IN, env, collectionLease, kind))
          })

          describe('#mutateIn', () => {
            test('should perform mutateIn', ({
              env,
              collectionLease,
              signal,
            }) => runPerform(MUTATE_IN, env, collectionLease, kind, signal))
            test('should perform mutateIn via callback', ({
              env,
              collectionLease,
              signal,
            }) => runViaCallback(MUTATE_IN, env, collectionLease, kind, signal))
            test('should perform mutateIn with parent span', ({
              env,
              collectionLease,
              signal,
            }) =>
              runWithParentSpan(MUTATE_IN, env, collectionLease, kind, signal))
            test('should handle error in mutateIn', ({
              env,
              collectionLease,
            }) => runFailure(MUTATE_IN, env, collectionLease, kind))
          })
        })

        group(
          '#Subdoc Replica Operations',
          [ServerFeature.SubdocReadReplica, ServerFeature.Replicas],
          () => {
            describe('#lookupInAllReplicas', () => {
              test('should perform lookupInAllReplicas', ({
                env,
                collectionLease,
                signal,
              }) =>
                runPerform(
                  LOOKUP_IN_ALL_REPLICAS,
                  env,
                  collectionLease,
                  kind,
                  signal
                ))
              test('should perform lookupInAllReplicas via callback', ({
                env,
                collectionLease,
                signal,
              }) =>
                runViaCallback(
                  LOOKUP_IN_ALL_REPLICAS,
                  env,
                  collectionLease,
                  kind,
                  signal
                ))
              test('should perform lookupInAllReplicas with parent span', ({
                env,
                collectionLease,
                signal,
              }) =>
                runWithParentSpan(
                  LOOKUP_IN_ALL_REPLICAS,
                  env,
                  collectionLease,
                  kind,
                  signal
                ))
              test('should handle error in lookupInAllReplicas', ({
                env,
                collectionLease,
              }) =>
                runFailure(LOOKUP_IN_ALL_REPLICAS, env, collectionLease, kind))
            })

            describe('#lookupInAnyReplica', () => {
              test(
                'should perform lookupInAnyReplica',
                OPEN_SIBLING_SPAN_OPTS,
                ({ env, collectionLease, signal }) =>
                  runPerform(
                    LOOKUP_IN_ANY_REPLICA,
                    env,
                    collectionLease,
                    kind,
                    signal
                  )
              )
              test(
                'should perform lookupInAnyReplica via callback',
                OPEN_SIBLING_SPAN_OPTS,
                ({ env, collectionLease, signal }) =>
                  runViaCallback(
                    LOOKUP_IN_ANY_REPLICA,
                    env,
                    collectionLease,
                    kind,
                    signal
                  )
              )
              test(
                'should perform lookupInAnyReplica with parent span',
                OPEN_SIBLING_SPAN_OPTS,
                ({ env, collectionLease, signal }) =>
                  runWithParentSpan(
                    LOOKUP_IN_ANY_REPLICA,
                    env,
                    collectionLease,
                    kind,
                    signal
                  )
              )
              test('should handle error in lookupInAnyReplica', ({
                env,
                collectionLease,
              }) =>
                runFailure(LOOKUP_IN_ANY_REPLICA, env, collectionLease, kind))
            })
          }
        )

        describe('#Lock Operations', () => {
          test('should perform getAndLock and unlock', async ({
            env,
            collectionLease,
          }) => {
            const { collection, validator } = await targetFor(
              env,
              collectionLease,
              kind
            )
            const key = await seededKey(collection, env)

            validator.reset().op(KeyValueOp.GetAndLock)
            const result = await collection.getAndLock(key, LOCK_SECONDS)
            expect(result, 'getAndLock result').toBeTypeOf('object')
            validator.validate()

            validator.reset().op(KeyValueOp.Unlock)
            await collection.unlock(key, result.cas)
            validator.validate()
          })

          test('should perform getAndLock and unlock via callback', async ({
            env,
            collectionLease,
          }) => {
            const { collection, validator } = await targetFor(
              env,
              collectionLease,
              kind
            )
            const key = await seededKey(collection, env)

            validator.reset().op(KeyValueOp.GetAndLock)
            const result = await awaitCallback<GetResult>((cb) =>
              collection.getAndLock(key, LOCK_SECONDS, cb)
            )
            expect(result, 'getAndLock result').toBeTypeOf('object')
            validator.validate()

            validator.reset().op(KeyValueOp.Unlock)
            await awaitCallback<void>((cb) =>
              collection.unlock(key, result.cas, cb)
            )
            validator.validate()
          })

          test('should perform getAndLock and unlock with parent span', async ({
            env,
            collectionLease,
          }) => {
            const { collection, validator, parentSpan } = await targetFor(
              env,
              collectionLease,
              kind
            )
            const key = await seededKey(collection, env)

            validator.reset()
            const lockSpan = parentSpan('getAndLock-parent-span')
            validator.op(KeyValueOp.GetAndLock).parent(lockSpan)
            const result = await collection.getAndLock(key, LOCK_SECONDS, {
              parentSpan: lockSpan,
            })
            expect(result, 'getAndLock result').toBeTypeOf('object')
            validator.validate()

            validator.reset()
            const unlockSpan = parentSpan('unlock-parent-span')
            validator.op(KeyValueOp.Unlock).parent(unlockSpan)
            await collection.unlock(key, result.cas, {
              parentSpan: unlockSpan,
            })
            validator.validate()
          })

          test('should handle error in getAndLock and unlock', async ({
            env,
            collectionLease,
          }) => {
            const { collection, validator } = await targetFor(
              env,
              collectionLease,
              kind
            )

            validator.reset().op(KeyValueOp.GetAndLock).error(true)
            await expectThrows(
              () => collection.getAndLock(MISSING_KEY, RETRY_LOCK_SECONDS),
              CouchbaseError,
              undefined,
              env.ctx({ op: 'getAndLock', key: MISSING_KEY })
            )
            validator.validate()

            validator.reset().op(KeyValueOp.Unlock).error(true)
            await expectThrows(
              () => collection.unlock(MISSING_KEY, WRONG_CAS),
              CouchbaseError,
              undefined,
              env.ctx({ op: 'unlock', key: MISSING_KEY })
            )
            validator.validate()
          })
        })

        describe('#Binary Operations', () => {
          describe('#counter-ops', () => {
            describe('#increment', () => {
              test('should perform increment', ({
                env,
                collectionLease,
                signal,
              }) => runPerform(INCREMENT, env, collectionLease, kind, signal))
              test('should perform increment via callback', ({
                env,
                collectionLease,
                signal,
              }) =>
                runViaCallback(INCREMENT, env, collectionLease, kind, signal))
              test('should perform increment with parent span', ({
                env,
                collectionLease,
                signal,
              }) =>
                runWithParentSpan(
                  INCREMENT,
                  env,
                  collectionLease,
                  kind,
                  signal
                ))
              test('should handle error in increment', ({
                env,
                collectionLease,
              }) => runFailure(INCREMENT, env, collectionLease, kind))
            })

            describe('#decrement', () => {
              test('should perform decrement', ({
                env,
                collectionLease,
                signal,
              }) => runPerform(DECREMENT, env, collectionLease, kind, signal))
              test('should perform decrement via callback', ({
                env,
                collectionLease,
                signal,
              }) =>
                runViaCallback(DECREMENT, env, collectionLease, kind, signal))
              test('should perform decrement with parent span', ({
                env,
                collectionLease,
                signal,
              }) =>
                runWithParentSpan(
                  DECREMENT,
                  env,
                  collectionLease,
                  kind,
                  signal
                ))
              test('should handle error in decrement', ({
                env,
                collectionLease,
              }) => runFailure(DECREMENT, env, collectionLease, kind))
            })
          })

          describe('#mutation-ops', () => {
            describe('#append', () => {
              test('should perform append', ({
                env,
                collectionLease,
                signal,
              }) => runPerform(APPEND, env, collectionLease, kind, signal))
              test('should perform append via callback', ({
                env,
                collectionLease,
                signal,
              }) => runViaCallback(APPEND, env, collectionLease, kind, signal))
              test('should perform append with parent span', ({
                env,
                collectionLease,
                signal,
              }) =>
                runWithParentSpan(APPEND, env, collectionLease, kind, signal))
              test('should handle error in append', ({
                env,
                collectionLease,
              }) => runFailure(APPEND, env, collectionLease, kind))
            })

            describe('#prepend', () => {
              test('should perform prepend', ({
                env,
                collectionLease,
                signal,
              }) => runPerform(PREPEND, env, collectionLease, kind, signal))
              test('should perform prepend via callback', ({
                env,
                collectionLease,
                signal,
              }) => runViaCallback(PREPEND, env, collectionLease, kind, signal))
              test('should perform prepend with parent span', ({
                env,
                collectionLease,
                signal,
              }) =>
                runWithParentSpan(PREPEND, env, collectionLease, kind, signal))
              test('should handle error in prepend', ({
                env,
                collectionLease,
              }) => runFailure(PREPEND, env, collectionLease, kind))
            })
          })
        })
      })
    }
  )
}
