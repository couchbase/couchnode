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
  METER_KINDS,
  MeterKind,
  meteredCollection,
  meteredTarget,
} from '../../observability/metrics/target'
import {
  MetricsValidator,
  createKeyValueValidator,
} from '../../observability/metrics/validators'

// A data structure records a metric for each key-value operation it is built
// from and none of its own. Each test is one long sequence because splitting
// it up would rebuild the structure per test.
//
// Regression guard (JSCBC-1484): a failing call shows `error.type` only on the
// nested operation the server refused, named with `nestedErrors()`. Three of
// the seven failing cases refuse nothing at the server (the wrapper raises
// after reads that succeeded), so they declare no nested error.

/** Each attempt allocates its own key, so a retry starts from nothing. */
const RETRIES = 2

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

/**
 * A failing `pop` or `remove` retries its read-modify-write this many times,
 * and each attempt records its own metrics.
 */
const RETRY_ROUNDS = 16

function repeated(...ops: KeyValueOp[]): KeyValueOp[] {
  const all: KeyValueOp[] = []
  for (let round = 0; round < RETRY_ROUNDS; ++round) {
    all.push(...ops)
  }
  return all
}

for (const kind of METER_KINDS) {
  defineSuite(
    kind.suiteName,
    {
      features: [ServerFeature.KeyValue],
      collection: CollectionStrategy.Named,
    },
    (ctx) => {
      const { test } = ctx

      describe('#Data Structure Operations', () => {
        describe('#CouchbaseList', () => {
          test(
            'should handle all list operations',
            { retry: RETRIES },
            async ({ env, collectionLease }) => {
              const { collection, validator } = await targetFor(
                env,
                collectionLease,
                kind
              )
              const list = collection.list(env.key())

              validator
                .reset()
                .op(DatastructureOp.ListPush)
                .nestedOps([KeyValueOp.MutateIn])
              await list.push('test2')
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.ListUnshift)
                .nestedOps([KeyValueOp.MutateIn])
              await list.unshift('test1')
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.ListGetAll)
                .nestedOps([KeyValueOp.Get])
              const items = await list.getAll()
              expect(items, 'list contents').toHaveLength(2)
              expect(items[0], 'list[0]').toStrictEqual('test1')
              expect(items[1], 'list[1]').toStrictEqual('test2')
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.ListGetAt)
                .nestedOps([KeyValueOp.LookupIn])
              expect(await list.getAt(1), 'list.getAt(1)').toStrictEqual(
                'test2'
              )
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.ListGetAt)
                .nestedOps([KeyValueOp.LookupIn])
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
                .nestedOps([KeyValueOp.Get])
              expect(await list.indexOf('test2'), 'indexOf(test2)').toBe(1)
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.ListIndexOf)
                .nestedOps([KeyValueOp.Get])
              expect(
                await list.indexOf('missing-item'),
                'indexOf(missing-item)'
              ).toBe(-1)
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.ListSize)
                .nestedOps([KeyValueOp.LookupIn])
              expect(await list.size(), 'list size').toBe(2)
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.ListRemoveAt)
                .nestedOps([KeyValueOp.MutateIn])
              await list.removeAt(1)
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.ListRemoveAt)
                .nestedOps([KeyValueOp.MutateIn])
                .nestedErrors([KeyValueOp.MutateIn])
              await expectThrows(
                () => list.removeAt(4),
                CouchbaseError,
                undefined,
                env.ctx({ op: 'list.removeAt', extra: 'index=4' })
              )
              validator.validate()
            }
          )
        })

        describe('#CouchbaseMap', () => {
          test(
            'should handle all map operations',
            { retry: RETRIES },
            async ({ env, collectionLease }) => {
              const { collection, validator } = await targetFor(
                env,
                collectionLease,
                kind
              )
              const map = collection.map(env.key())

              validator
                .reset()
                .op(DatastructureOp.MapSet)
                .nestedOps([KeyValueOp.MutateIn])
              await map.set('foo', 'test2')
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.MapSet)
                .nestedOps([KeyValueOp.MutateIn])
              await map.set('bar', 'test4')
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.MapGetAll)
                .nestedOps([KeyValueOp.Get])
              expect(await map.getAll(), 'map contents').toStrictEqual({
                foo: 'test2',
                bar: 'test4',
              })
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.MapGet)
                .nestedOps([KeyValueOp.LookupIn])
              expect(await map.get('bar'), 'map.get(bar)').toStrictEqual(
                'test4'
              )
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.MapGet)
                .nestedOps([KeyValueOp.LookupIn])
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
                .nestedOps([KeyValueOp.LookupIn])
              expect(await map.exists('bar'), 'map.exists(bar)').toBe(true)
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.MapExists)
                .nestedOps([KeyValueOp.LookupIn])
              expect(
                await map.exists('invalid-item'),
                'map.exists(invalid-item)'
              ).toBe(false)
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.MapSize)
                .nestedOps([KeyValueOp.LookupIn])
              expect(await map.size(), 'map size').toBe(2)
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.MapRemove)
                .nestedOps([KeyValueOp.MutateIn])
              await map.remove('bar')
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.MapRemove)
                .nestedOps([KeyValueOp.MutateIn])
                .nestedErrors([KeyValueOp.MutateIn])
              await expectThrows(
                () => map.remove('invalid-item'),
                CouchbaseError,
                undefined,
                env.ctx({ op: 'map.remove', extra: 'item=invalid-item' })
              )
              validator.validate()
            }
          )
        })

        describe('#CouchbaseQueue', () => {
          test(
            'should handle all queue operations',
            { retry: RETRIES },
            async ({ env, collectionLease }) => {
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
                .nestedOps([KeyValueOp.MutateIn])
              await queue.push('test2')
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.QueueSize)
                .nestedOps([KeyValueOp.LookupIn])
              expect(await queue.size(), 'queue size').toBe(1)
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.QueuePop)
                .nestedOps([KeyValueOp.LookupIn, KeyValueOp.MutateIn])
              expect(await queue.pop(), 'queue.pop()').toStrictEqual('test2')
              validator.validate()

              // FIFO is the queue's contract, so each pop asserts its value.
              for (const value of ['test1', 'test2', 'test3']) {
                validator
                  .reset()
                  .op(DatastructureOp.QueuePush)
                  .nestedOps([KeyValueOp.MutateIn])
                await queue.push(value)
                validator.validate()
              }

              for (const value of ['test1', 'test2', 'test3']) {
                validator
                  .reset()
                  .op(DatastructureOp.QueuePop)
                  .nestedOps([KeyValueOp.LookupIn, KeyValueOp.MutateIn])
                expect(
                  await queue.pop(),
                  `queue.pop() for ${value}`
                ).toStrictEqual(value)
                validator.validate()
              }

              validator
                .reset()
                .op(DatastructureOp.QueuePop)
                .nestedOps(repeated(KeyValueOp.LookupIn, KeyValueOp.MutateIn))
                .nestedErrors([KeyValueOp.MutateIn])
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
                .nestedOps(repeated(KeyValueOp.LookupIn, KeyValueOp.MutateIn))
                .nestedErrors([KeyValueOp.MutateIn])
              await expectThrows(
                () => queue.pop(),
                CouchbaseError,
                undefined,
                env.ctx({ op: 'queue.pop', key, extra: 'document is []' })
              )
              validator.validate()
            }
          )
        })

        describe('#CouchbaseSet', () => {
          test(
            'should handle all set operations',
            { retry: RETRIES },
            async ({ env, collectionLease }) => {
              const { collection, validator } = await targetFor(
                env,
                collectionLease,
                kind
              )
              const set = collection.set(env.key())

              validator
                .reset()
                .op(DatastructureOp.SetAdd)
                .nestedOps([KeyValueOp.MutateIn])
              expect(await set.add('test1'), 'add(test1)').toBe(true)
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.SetAdd)
                .nestedOps([KeyValueOp.MutateIn])
              expect(await set.add('test2'), 'add(test2)').toBe(true)
              validator.validate()

              // The server refuses the duplicate with `PathExists` and the set
              // turns that into `false`, so the add succeeds while its nested
              // `mutate_in` records the failure.
              validator
                .reset()
                .op(DatastructureOp.SetAdd)
                .nestedOps([KeyValueOp.MutateIn])
                .nestedErrors([KeyValueOp.MutateIn])
              expect(await set.add('test2'), 'add(test2) again').toBe(false)
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.SetSize)
                .nestedOps([KeyValueOp.LookupIn])
              expect(await set.size(), 'set size').toBe(2)
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.SetValues)
                .nestedOps([KeyValueOp.Get])
              const values = await set.values()
              expect(values, 'set values').toHaveLength(2)
              expect(values, 'set values').toContain('test1')
              expect(values, 'set values').toContain('test2')
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.SetContains)
                .nestedOps([KeyValueOp.Get])
              expect(await set.contains('test1'), 'contains(test1)').toBe(true)
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.SetContains)
                .nestedOps([KeyValueOp.Get])
              expect(
                await set.contains('invalid-item'),
                'contains(invalid-item)'
              ).toBe(false)
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.SetRemove)
                .nestedOps([KeyValueOp.Get, KeyValueOp.MutateIn])
              await set.remove('test2')
              validator.validate()

              validator
                .reset()
                .op(DatastructureOp.SetRemove)
                .nestedOps(repeated(KeyValueOp.Get))
              await expectThrows(
                () => set.remove('invalid-item'),
                CouchbaseError,
                undefined,
                env.ctx({ op: 'set.remove', extra: 'item=invalid-item' })
              )
              validator.validate()
            }
          )
        })
      })
    }
  )
}
