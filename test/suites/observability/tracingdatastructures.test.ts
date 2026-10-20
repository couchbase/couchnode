import { describe, expect } from 'vitest'

import type { Collection } from '../../../lib/collection'
import { CouchbaseError } from '../../../lib/errors'
import { DatastructureOp, KeyValueOp } from '../../../lib/observabilitytypes'
import { expectThrows } from '../../asserts/errors'
import { ServerFeature } from '../../infra/capabilities'
import { TestEnv } from '../../infra/env'
import type { CollectionLease } from '../../infra/leases/collection-lease'
import { CollectionStrategy } from '../../infra/requirements'
import { defineSuite } from '../../infra/suite'
import {
  TRACER_KINDS,
  TracerKind,
  tracedCollection,
  tracedTarget,
} from '../../observability/tracing/target'
import {
  TracingValidator,
  createDatastructureValidator,
} from '../../observability/tracing/validators'

// A data structure records a span of its own with one child span per
// key-value operation it is built from. Each test is one long sequence because
// splitting it up would rebuild the structure per test.

interface TracingTarget {
  readonly collection: Collection
  readonly validator: TracingValidator
}

async function targetFor(
  env: TestEnv,
  lease: CollectionLease,
  kind: TracerKind
): Promise<TracingTarget> {
  const target = await tracedTarget(env, kind)
  return {
    collection: tracedCollection(target, lease),
    validator: createDatastructureValidator(
      target.tracer,
      {
        bucketName: lease.bucketName,
        scopeName: lease.scopeName,
        collName: lease.collectionName,
      },
      target.clusterName,
      target.mockBackend
    ),
  }
}

/**
 * A failing `pop` or `remove` retries its read-modify-write this many times,
 * and each attempt records its own spans.
 */
const RETRY_ROUNDS = 16

function repeated(...ops: KeyValueOp[]): KeyValueOp[] {
  const all: KeyValueOp[] = []
  for (let round = 0; round < RETRY_ROUNDS; ++round) {
    all.push(...ops)
  }
  return all
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
      const { test } = ctx

      describe('#Data Structure Operations', () => {
        describe('#CouchbaseList', () => {
          test('should handle all list operations', async ({
            env,
            collectionLease,
          }) => {
            const { collection, validator } = await targetFor(
              env,
              collectionLease,
              kind
            )
            const list = collection.list(env.key())

            validator
              .reset()
              .op(DatastructureOp.ListPush)
              .childKvOps(KeyValueOp.MutateIn)
            await list.push('test2')
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.ListUnshift)
              .childKvOps(KeyValueOp.MutateIn)
            await list.unshift('test1')
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.ListGetAll)
              .childKvOps(KeyValueOp.Get)
            const items = await list.getAll()
            expect(items, 'list contents').toHaveLength(2)
            expect(items[0], 'list[0]').toStrictEqual('test1')
            expect(items[1], 'list[1]').toStrictEqual('test2')
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.ListGetAt)
              .childKvOps(KeyValueOp.LookupIn)
            expect(await list.getAt(1), 'list.getAt(1)').toStrictEqual('test2')
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.ListGetAt)
              .childKvOps(KeyValueOp.LookupIn)
              .error(true)
            await expectThrows(
              () => list.getAt(5),
              CouchbaseError,
              undefined,
              env.ctx({ op: 'list.getAt', extra: 'index=5' })
            )
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.ListIndexOf)
              .childKvOps(KeyValueOp.Get)
            expect(await list.indexOf('test2'), 'indexOf(test2)').toBe(1)
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.ListIndexOf)
              .childKvOps(KeyValueOp.Get)
            expect(
              await list.indexOf('missing-item'),
              'indexOf(missing-item)'
            ).toBe(-1)
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.ListSize)
              .childKvOps(KeyValueOp.LookupIn)
            expect(await list.size(), 'list size').toBe(2)
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.ListRemoveAt)
              .childKvOps(KeyValueOp.MutateIn)
            await list.removeAt(1)
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.ListRemoveAt)
              .childKvOps(KeyValueOp.MutateIn)
              .error(true)
            await expectThrows(
              () => list.removeAt(4),
              CouchbaseError,
              undefined,
              env.ctx({ op: 'list.removeAt', extra: 'index=4' })
            )
            validator.validate()
          })
        })

        describe('#CouchbaseMap', () => {
          test('should handle all map operations', async ({
            env,
            collectionLease,
          }) => {
            const { collection, validator } = await targetFor(
              env,
              collectionLease,
              kind
            )
            const map = collection.map(env.key())

            validator
              .reset()
              .op(DatastructureOp.MapSet)
              .childKvOps(KeyValueOp.MutateIn)
            await map.set('foo', 'test2')
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.MapSet)
              .childKvOps(KeyValueOp.MutateIn)
            await map.set('bar', 'test4')
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.MapGetAll)
              .childKvOps(KeyValueOp.Get)
            expect(await map.getAll(), 'map contents').toStrictEqual({
              foo: 'test2',
              bar: 'test4',
            })
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.MapGet)
              .childKvOps(KeyValueOp.LookupIn)
            expect(await map.get('bar'), 'map.get(bar)').toStrictEqual('test4')
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.MapGet)
              .childKvOps(KeyValueOp.LookupIn)
              .error(true)
            await expectThrows(
              () => map.get('invalid-item'),
              CouchbaseError,
              undefined,
              env.ctx({ op: 'map.get', extra: 'item=invalid-item' })
            )
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.MapExists)
              .childKvOps(KeyValueOp.LookupIn)
            expect(await map.exists('bar'), 'map.exists(bar)').toBe(true)
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.MapExists)
              .childKvOps(KeyValueOp.LookupIn)
            expect(
              await map.exists('invalid-item'),
              'map.exists(invalid-item)'
            ).toBe(false)
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.MapSize)
              .childKvOps(KeyValueOp.LookupIn)
            expect(await map.size(), 'map size').toBe(2)
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.MapRemove)
              .childKvOps(KeyValueOp.MutateIn)
            await map.remove('bar')
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.MapRemove)
              .childKvOps(KeyValueOp.MutateIn)
              .error(true)
            await expectThrows(
              () => map.remove('invalid-item'),
              CouchbaseError,
              undefined,
              env.ctx({ op: 'map.remove', extra: 'item=invalid-item' })
            )
            validator.validate()
          })
        })

        describe('#CouchbaseQueue', () => {
          test('should handle all queue operations', async ({
            env,
            collectionLease,
          }) => {
            const { collection, validator } = await targetFor(
              env,
              collectionLease,
              kind
            )
            const key = env.key()
            const queue = collection.queue(key)

            validator
              .reset()
              .op(DatastructureOp.QueuePush)
              .childKvOps(KeyValueOp.MutateIn)
            await queue.push('test2')
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.QueueSize)
              .childKvOps(KeyValueOp.LookupIn)
            expect(await queue.size(), 'queue size').toBe(1)
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.QueuePop)
              .childKvOps([KeyValueOp.LookupIn, KeyValueOp.MutateIn])
            expect(await queue.pop(), 'queue.pop()').toStrictEqual('test2')
            validator.validate()

            // FIFO is the queue's contract, so each pop asserts its value.
            for (const value of ['test1', 'test2', 'test3']) {
              validator
                .reset()
                .op(DatastructureOp.QueuePush)
                .childKvOps(KeyValueOp.MutateIn)
              await queue.push(value)
              validator.validate()
            }

            for (const value of ['test1', 'test2', 'test3']) {
              validator
                .reset()
                .op(DatastructureOp.QueuePop)
                .childKvOps([KeyValueOp.LookupIn, KeyValueOp.MutateIn])
              expect(
                await queue.pop(),
                `queue.pop() for ${value}`
              ).toStrictEqual(value)
              validator.validate()
            }

            validator
              .reset()
              .op(DatastructureOp.QueuePop)
              .childKvOps(repeated(KeyValueOp.LookupIn, KeyValueOp.MutateIn))
              .error(true)
            await expectThrows(
              () => queue.pop(),
              CouchbaseError,
              undefined,
              env.ctx({ op: 'queue.pop', key, extra: 'queue is empty' })
            )
            validator.validate()

            // The same failure, against a document that holds an empty array
            // rather than one the pops have emptied.
            await collection.upsert(key, [])
            validator
              .reset()
              .op(DatastructureOp.QueuePop)
              .childKvOps(repeated(KeyValueOp.LookupIn, KeyValueOp.MutateIn))
              .error(true)
            await expectThrows(
              () => queue.pop(),
              CouchbaseError,
              undefined,
              env.ctx({ op: 'queue.pop', key, extra: 'document is []' })
            )
            validator.validate()
          })
        })

        describe('#CouchbaseSet', () => {
          test('should handle all set operations', async ({
            env,
            collectionLease,
          }) => {
            const { collection, validator } = await targetFor(
              env,
              collectionLease,
              kind
            )
            const set = collection.set(env.key())

            validator
              .reset()
              .op(DatastructureOp.SetAdd)
              .childKvOps(KeyValueOp.MutateIn)
            expect(await set.add('test1'), 'add(test1)').toBe(true)
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.SetAdd)
              .childKvOps(KeyValueOp.MutateIn)
            expect(await set.add('test2'), 'add(test2)').toBe(true)
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.SetAdd)
              .childKvOps(KeyValueOp.MutateIn)
            expect(await set.add('test2'), 'add(test2) again').toBe(false)
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.SetSize)
              .childKvOps(KeyValueOp.LookupIn)
            expect(await set.size(), 'set size').toBe(2)
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.SetValues)
              .childKvOps(KeyValueOp.Get)
            const values = await set.values()
            expect(values, 'set values').toHaveLength(2)
            expect(values, 'set values').toContain('test1')
            expect(values, 'set values').toContain('test2')
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.SetContains)
              .childKvOps(KeyValueOp.Get)
            expect(await set.contains('test1'), 'contains(test1)').toBe(true)
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.SetContains)
              .childKvOps(KeyValueOp.Get)
            expect(
              await set.contains('invalid-item'),
              'contains(invalid-item)'
            ).toBe(false)
            validator.validate()

            validator
              .reset()
              .op(DatastructureOp.SetRemove)
              .childKvOps([KeyValueOp.Get, KeyValueOp.MutateIn])
            await set.remove('test2')
            validator.validate()

            // Only reads: `remove` re-reads the set looking for a member that
            // is not there, and gives up without mutating.
            validator
              .reset()
              .op(DatastructureOp.SetRemove)
              .childKvOps(repeated(KeyValueOp.Get))
              .error(true)
            await expectThrows(
              () => set.remove('invalid-item'),
              CouchbaseError,
              undefined,
              env.ctx({ op: 'set.remove', extra: 'item=invalid-item' })
            )
            validator.validate()
          })
        })
      })
    }
  )
}
