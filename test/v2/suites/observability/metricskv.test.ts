import { describe, expect } from 'vitest'

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
  METER_KINDS,
  MeterKind,
  meteredCollection,
  meteredTarget,
} from '../../observability/metrics/target'
import {
  MetricsValidator,
  createKeyValueValidator,
} from '../../observability/metrics/validators'

// Every key-value operation records one operation-duration metric naming
// itself and its keyspace.
//
// The leased named collection is what makes the scope and collection name
// assertions meaningful: `_default` against `_default` would pass an SDK that
// hardcoded them. An error test asserts the failure itself, because under the
// no-op meter nothing else would catch an operation that succeeded.

const OBJECT_VALUE = { foo: 'bar', baz: 19 }
const MISSING_KEY = 'not-a-key'
const LOCK_SECONDS = 5
const TOUCH_SECONDS = 1
const COUNTER_START = 14
const COUNTER_DELTA = 3
/** For the unlock meant to fail. A string, as `CasInput` accepts one. */
const WRONG_CAS = '100'

/**
 * The encode failure happens before the operation reaches the server, and the
 * metric is still expected to carry an `error.type`.
 */
const failingTranscoder: Transcoder = {
  encode: () => {
    throw new EncodingFailureError(new Error('encode error'))
  },
  decode: () => {
    throw new DecodingFailureError(new Error('decode error'))
  },
}

interface MetricsTarget {
  readonly collection: Collection
  readonly validator: MetricsValidator
}

async function targetFor(
  env: TestEnv,
  lease: CollectionLease,
  kind: MeterKind
): Promise<MetricsTarget> {
  const target = await meteredTarget(env, kind)
  return {
    collection: meteredCollection(target, lease),
    validator: createKeyValueValidator(
      target.meter,
      {
        bucketName: lease.bucketName,
        scopeName: lease.scopeName,
        collectionName: lease.collectionName,
      },
      target.clusterName
    ),
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
  /** Prepares what the successful call needs and returns its key. */
  readonly setup: (c: Collection, env: TestEnv) => Promise<string>
  /**
   * The replica reads that need every replica, or one particular replica, to
   * hold the document wait for it here. See `infra/replicas.ts` for why that
   * wait is required.
   */
  readonly settle?: (
    c: Collection,
    env: TestEnv,
    key: string,
    signal: AbortSignal
  ) => Promise<void>
  readonly call: (c: Collection, key: string) => Promise<unknown>
  readonly callback: (c: Collection, key: string) => Promise<unknown>
  readonly failSetup: (c: Collection, env: TestEnv) => Promise<string>
  /** Defaults to `call`. */
  readonly fail?: (c: Collection, key: string) => Promise<unknown>
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

function declare(
  validator: MetricsValidator,
  subject: OpCase
): MetricsValidator {
  validator.reset().op(subject.op)
  if (subject.nested) {
    validator.nestedOps(subject.nested)
  }
  return validator
}

/**
 * Seed, then reset, then run the one operation. Seeding before the `reset()`
 * keeps it out of the meter, so exactly one metric can be asserted.
 */
async function runPerform(
  subject: OpCase,
  env: TestEnv,
  lease: CollectionLease,
  kind: MeterKind,
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
  kind: MeterKind,
  signal: AbortSignal
): Promise<void> {
  const { collection, validator } = await targetFor(env, lease, kind)
  const key = await subject.setup(collection, env)
  await subject.settle?.(collection, env, key, signal)

  declare(validator, subject)
  expectRecordedResult(subject, await subject.callback(collection, key))
  validator.validate()
}

async function runFailure(
  subject: OpCase,
  env: TestEnv,
  lease: CollectionLease,
  kind: MeterKind
): Promise<void> {
  const { collection, validator } = await targetFor(env, lease, kind)
  const key = await subject.failSetup(collection, env)
  const failing = subject.fail ?? subject.call

  declare(validator, subject).error(true)
  await expectThrows(
    () => failing(collection, key),
    CouchbaseError,
    undefined,
    env.ctx({ op: subject.label, key })
  )
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
  // The one failing case that needs the document to exist.
  failSetup: seededKey,
}

const REPLACE: OpCase = {
  label: 'replace',
  op: KeyValueOp.Replace,
  mutationResult: true,
  setup: seededKey,
  call: (c, key) => c.replace(key, OBJECT_VALUE),
  callback: (c, key) =>
    awaitCallback<MutationResult>((cb) => c.replace(key, OBJECT_VALUE, cb)),
  failSetup: missingKey,
}

const UPSERT: OpCase = {
  label: 'upsert',
  op: KeyValueOp.Upsert,
  mutationResult: true,
  setup: freshKey,
  call: (c, key) => c.upsert(key, OBJECT_VALUE),
  callback: (c, key) =>
    awaitCallback<MutationResult>((cb) => c.upsert(key, OBJECT_VALUE, cb)),
  // An upsert cannot fail on the document's state, so it fails on encoding.
  failSetup: freshKey,
  fail: (c, key) =>
    c.upsert(key, OBJECT_VALUE, { transcoder: failingTranscoder }),
}

const REMOVE: OpCase = {
  label: 'remove',
  op: KeyValueOp.Remove,
  mutationResult: true,
  setup: seededKey,
  call: (c, key) => c.remove(key),
  callback: (c, key) =>
    awaitCallback<MutationResult>((cb) => c.remove(key, cb)),
  failSetup: missingKey,
}

const GET: OpCase = {
  label: 'get',
  op: KeyValueOp.Get,
  setup: seededKey,
  call: (c, key) => c.get(key),
  callback: (c, key) => awaitCallback<GetResult>((cb) => c.get(key, cb)),
  failSetup: missingKey,
}

const GET_ALL_REPLICAS: OpCase = {
  label: 'getAllReplicas',
  op: KeyValueOp.GetAllReplicas,
  arrayResult: true,
  setup: seededKey,
  settle: settleReplicas,
  call: (c, key) => c.getAllReplicas(key),
  callback: (c, key) =>
    awaitCallback<GetReplicaResult[]>((cb) => c.getAllReplicas(key, cb)),
  failSetup: missingKey,
}

const GET_ANY_REPLICA: OpCase = {
  label: 'getAnyReplica',
  op: KeyValueOp.GetAnyReplica,
  setup: seededKey,
  call: (c, key) => c.getAnyReplica(key),
  callback: (c, key) =>
    awaitCallback<GetReplicaResult>((cb) => c.getAnyReplica(key, cb)),
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
  failSetup: missingKey,
}

const GET_AND_TOUCH: OpCase = {
  label: 'getAndTouch',
  op: KeyValueOp.GetAndTouch,
  setup: seededKey,
  call: (c, key) => c.getAndTouch(key, TOUCH_SECONDS),
  callback: (c, key) =>
    awaitCallback<GetResult>((cb) => c.getAndTouch(key, TOUCH_SECONDS, cb)),
  failSetup: missingKey,
}

const TOUCH: OpCase = {
  label: 'touch',
  op: KeyValueOp.Touch,
  setup: seededKey,
  call: (c, key) => c.touch(key, TOUCH_SECONDS),
  callback: (c, key) =>
    awaitCallback<MutationResult>((cb) => c.touch(key, TOUCH_SECONDS, cb)),
  failSetup: missingKey,
}

/** No failing case: a missing document is a result, not an error. */
const EXISTS: OpCase = {
  label: 'exists',
  op: KeyValueOp.Exists,
  setup: seededKey,
  call: (c, key) => c.exists(key),
  callback: (c, key) => awaitCallback<ExistsResult>((cb) => c.exists(key, cb)),
  failSetup: missingKey,
}

const GET_PROJECT: OpCase = {
  label: 'getProject',
  op: KeyValueOp.Get,
  // A projection is a subdocument lookup underneath, recorded as a nested
  // metric.
  nested: [KeyValueOp.LookupIn],
  setup: seededKey,
  call: (c, key) => c.get(key, { project: ['baz'] }),
  callback: (c, key) =>
    awaitCallback<GetResult>((cb) => c.get(key, { project: ['baz'] }, cb)),
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
  failSetup: missingKey,
}

const LOOKUP_IN_ALL_REPLICAS: OpCase = {
  label: 'lookupInAllReplicas',
  op: KeyValueOp.LookupInAllReplicas,
  arrayResult: true,
  setup: seededKey,
  settle: settleReplicas,
  call: (c, key) => c.lookupInAllReplicas(key, [LookupInSpec.get('baz')]),
  callback: (c, key) =>
    awaitCallback<LookupInReplicaResult[]>((cb) =>
      c.lookupInAllReplicas(key, [LookupInSpec.get('baz')], cb)
    ),
  failSetup: missingKey,
}

const LOOKUP_IN_ANY_REPLICA: OpCase = {
  label: 'lookupInAnyReplica',
  op: KeyValueOp.LookupInAnyReplica,
  setup: seededKey,
  call: (c, key) => c.lookupInAnyReplica(key, [LookupInSpec.get('baz')]),
  callback: (c, key) =>
    awaitCallback<LookupInReplicaResult>((cb) =>
      c.lookupInAnyReplica(key, [LookupInSpec.get('baz')], cb)
    ),
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
  failSetup: missingKey,
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
  failSetup: missingKey,
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
  failSetup: missingKey,
}

const APPEND: OpCase = {
  label: 'append',
  op: KeyValueOp.Append,
  setup: counterKey,
  call: (c, key) => c.binary().append(key, 'world'),
  callback: (c, key) =>
    awaitCallback<MutationResult>((cb) => c.binary().append(key, 'hello', cb)),
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
  failSetup: missingKey,
  fail: (c, key) => c.binary().prepend(key, 'hello'),
}

for (const kind of METER_KINDS) {
  defineSuite(
    kind.suiteName,
    {
      features: [ServerFeature.KeyValue],
      collection: CollectionStrategy.Named,
    },
    (ctx) => {
      const { group, test } = ctx

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
            test('should handle error in remove', ({ env, collectionLease }) =>
              runFailure(REMOVE, env, collectionLease, kind))
          })
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
            test('should handle error in get', ({ env, collectionLease }) =>
              runFailure(GET, env, collectionLease, kind))
          })

          group('#getAllReplicas', [ServerFeature.Replicas], () => {
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
            test('should handle error in getAllReplicas', ({
              env,
              collectionLease,
            }) => runFailure(GET_ALL_REPLICAS, env, collectionLease, kind))
          })

          group('#getAnyReplica', [ServerFeature.Replicas], () => {
            test('should perform getAnyReplica', ({
              env,
              collectionLease,
              signal,
            }) =>
              runPerform(GET_ANY_REPLICA, env, collectionLease, kind, signal))
            test('should perform getAnyReplica via callback', ({
              env,
              collectionLease,
              signal,
            }) =>
              runViaCallback(
                GET_ANY_REPLICA,
                env,
                collectionLease,
                kind,
                signal
              ))
            test('should handle error in getAnyReplica', ({
              env,
              collectionLease,
            }) => runFailure(GET_ANY_REPLICA, env, collectionLease, kind))
          })

          group('#getReplica', [ServerFeature.Replicas], () => {
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
            test('should handle error in getReplica', ({
              env,
              collectionLease,
            }) => runFailure(GET_REPLICA, env, collectionLease, kind))
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
            test('should handle error in getProject', ({
              env,
              collectionLease,
            }) => runFailure(GET_PROJECT, env, collectionLease, kind))
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
            test('should handle error in lookupIn', ({
              env,
              collectionLease,
            }) => runFailure(LOOKUP_IN, env, collectionLease, kind))
          })

          group(
            '#lookupInAllReplicas',
            [ServerFeature.SubdocReadReplica, ServerFeature.Replicas],
            () => {
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
              test('should handle error in lookupInAllReplicas', ({
                env,
                collectionLease,
              }) =>
                runFailure(LOOKUP_IN_ALL_REPLICAS, env, collectionLease, kind))
            }
          )

          group(
            '#lookupInAnyReplica',
            [ServerFeature.SubdocReadReplica, ServerFeature.Replicas],
            () => {
              test('should perform lookupInAnyReplica', ({
                env,
                collectionLease,
                signal,
              }) =>
                runPerform(
                  LOOKUP_IN_ANY_REPLICA,
                  env,
                  collectionLease,
                  kind,
                  signal
                ))
              test('should perform lookupInAnyReplica via callback', ({
                env,
                collectionLease,
                signal,
              }) =>
                runViaCallback(
                  LOOKUP_IN_ANY_REPLICA,
                  env,
                  collectionLease,
                  kind,
                  signal
                ))
              test('should handle error in lookupInAnyReplica', ({
                env,
                collectionLease,
              }) =>
                runFailure(LOOKUP_IN_ANY_REPLICA, env, collectionLease, kind))
            }
          )

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
            test('should handle error in mutateIn', ({
              env,
              collectionLease,
            }) => runFailure(MUTATE_IN, env, collectionLease, kind))
          })
        })

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
            const locked = await collection.getAndLock(key, LOCK_SECONDS)
            expect(locked, 'getAndLock result').toBeTypeOf('object')
            validator.validate()

            validator.reset().op(KeyValueOp.Unlock)
            await collection.unlock(key, locked.cas)
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
            const locked = await awaitCallback<GetResult>((cb) =>
              collection.getAndLock(key, LOCK_SECONDS, cb)
            )
            expect(locked, 'getAndLock result').toBeTypeOf('object')
            validator.validate()

            validator.reset().op(KeyValueOp.Unlock)
            await awaitCallback<void>((cb) =>
              collection.unlock(key, locked.cas, cb)
            )
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
              () => collection.getAndLock(MISSING_KEY, TOUCH_SECONDS),
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
