import { describe, expect } from 'vitest'

import { Collection } from '../../../../lib/collection'
import { CouchbaseError } from '../../../../lib/errors'
import { expectThrows } from '../../asserts/errors'
import { ServerFeature } from '../../infra/capabilities'
import { TestEnv } from '../../infra/env'
import { CollectionStrategy } from '../../infra/requirements'
import { defineSuite } from '../../infra/suite'

// Each block walks one document through a sequence of tests, because that
// sequence (`push` then `getAll` then `removeAt` on the same list) is the
// behavior under test.

const blockKeys = new Map<string, string>()

/**
 * The document one block walks, removed by the env on any path. Keyed by
 * collection because `CollectionStrategy.Both` runs this body twice, and a
 * module-level key would hand both runs the same document.
 */
function blockKey(env: TestEnv, collection: Collection, block: string): string {
  const id = `${collection.name}:${block}`
  const existing = blockKeys.get(id)
  if (existing) {
    return existing
  }
  const key = env.key()
  blockKeys.set(id, key)
  env.registerCleanup(async () => {
    await collection.remove(key).catch(() => undefined)
  })
  return key
}

defineSuite(
  '#datastructures',
  { features: [ServerFeature.KeyValue], collection: CollectionStrategy.Both },
  ({ test }) => {
    describe('#list', () => {
      test('should successfully get a list reference', async ({
        collection,
        env,
      }) => {
        collection.list(blockKey(env, collection, 'list'))
      })

      test('should successfully append to a list', async ({
        collection,
        env,
      }) => {
        await collection.list(blockKey(env, collection, 'list')).push('test2')
      })

      test('should successfully prepend to a list', async ({
        collection,
        env,
      }) => {
        await collection
          .list(blockKey(env, collection, 'list'))
          .unshift('test1')
      })

      test('should successfully fetch the whole list', async ({
        collection,
        env,
      }) => {
        const items = await collection
          .list(blockKey(env, collection, 'list'))
          .getAll()
        expect(items, 'list length').toHaveLength(2)
        expect(items[0], 'first item').toEqual('test1')
        expect(items[1], 'second item').toEqual('test2')
      })

      test('should successfully fetch a particular index', async ({
        collection,
        env,
      }) => {
        const item = await collection
          .list(blockKey(env, collection, 'list'))
          .getAt(1)
        expect(item, 'item at index 1').toEqual('test2')
      })

      test('should error accessing an invalid index', async ({
        collection,
        env,
      }) => {
        const listObj = collection.list(blockKey(env, collection, 'list'))
        await expectThrows(
          () => listObj.getAt(4),
          CouchbaseError,
          undefined,
          env.ctx({ op: 'list.getAt', extra: 'index=4' })
        )
      })

      test('should successfully iterate a list', async ({
        collection,
        env,
      }) => {
        const listObj = collection.list(blockKey(env, collection, 'list'))
        const iteratedItems: unknown[] = []
        for await (const item of listObj) {
          iteratedItems.push(item)
        }

        expect(iteratedItems, 'iterated length').toHaveLength(2)
        expect(iteratedItems[0], 'first item').toEqual('test1')
        expect(iteratedItems[1], 'second item').toEqual('test2')
      })

      test('should successfully iterate a list with forEach', async ({
        collection,
        env,
      }) => {
        const listObj = collection.list(blockKey(env, collection, 'list'))
        const iteratedItems: unknown[] = []
        await listObj.forEach((item) => {
          iteratedItems.push(item)
        })

        expect(iteratedItems, 'iterated length').toHaveLength(2)
        expect(iteratedItems[0], 'first item').toEqual('test1')
        expect(iteratedItems[1], 'second item').toEqual('test2')
      })

      test('should successfully find the index of an item', async ({
        collection,
        env,
      }) => {
        const test2Idx = await collection
          .list(blockKey(env, collection, 'list'))
          .indexOf('test2')
        expect(test2Idx, "indexOf('test2')").toEqual(1)
      })

      test('should successfully return -1 for an invalid item', async ({
        collection,
        env,
      }) => {
        const missingIdx = await collection
          .list(blockKey(env, collection, 'list'))
          .indexOf('missing-item')
        expect(missingIdx, "indexOf('missing-item')").toEqual(-1)
      })

      test('should successfully get the size', async ({ collection, env }) => {
        const listSize = await collection
          .list(blockKey(env, collection, 'list'))
          .size()
        expect(listSize, 'list size').toEqual(2)
      })

      test('should successfully remove by index', async ({
        collection,
        env,
      }) => {
        const listObj = collection.list(blockKey(env, collection, 'list'))
        await listObj.removeAt(1)

        const remainingItems = await listObj.getAll()
        expect(remainingItems, 'remaining length').toHaveLength(1)
        expect(remainingItems[0], 'remaining item').toEqual('test1')
      })

      test('should fail to remove an invalid index', async ({
        collection,
        env,
      }) => {
        const listObj = collection.list(blockKey(env, collection, 'list'))
        await expectThrows(
          () => listObj.removeAt(4),
          CouchbaseError,
          undefined,
          env.ctx({ op: 'list.removeAt', extra: 'index=4' })
        )
      })
    })

    describe('#map', () => {
      test('should successfully get a map reference', async ({
        collection,
        env,
      }) => {
        collection.map(blockKey(env, collection, 'map'))
      })

      test('should successfully add an item', async ({ collection, env }) => {
        await collection
          .map(blockKey(env, collection, 'map'))
          .set('foo', 'test2')
      })

      test('should successfully set a second item', async ({
        collection,
        env,
      }) => {
        await collection
          .map(blockKey(env, collection, 'map'))
          .set('bar', 'test4')
      })

      test('should successfully fetch the whole map', async ({
        collection,
        env,
      }) => {
        const items = await collection
          .map(blockKey(env, collection, 'map'))
          .getAll()
        expect(items, 'whole map').toEqual({ foo: 'test2', bar: 'test4' })
      })

      test('should successfully fetch a particular item', async ({
        collection,
        env,
      }) => {
        const item = await collection
          .map(blockKey(env, collection, 'map'))
          .get('bar')
        expect(item, "map['bar']").toEqual('test4')
      })

      test('should error fetching an invalid item', async ({
        collection,
        env,
      }) => {
        const mapObj = collection.map(blockKey(env, collection, 'map'))
        await expectThrows(
          () => mapObj.get('invalid-item'),
          CouchbaseError,
          undefined,
          env.ctx({ op: 'map.get', extra: 'invalid-item' })
        )
      })

      test('should successfully check the existance of a particular item', async ({
        collection,
        env,
      }) => {
        const result = await collection
          .map(blockKey(env, collection, 'map'))
          .exists('bar')
        expect(result, "exists('bar')").toEqual(true)
      })

      test('should return false when checking existance of an invalid item', async ({
        collection,
        env,
      }) => {
        const result = await collection
          .map(blockKey(env, collection, 'map'))
          .exists('invalid-item')
        expect(result, "exists('invalid-item')").toEqual(false)
      })

      test('should successfully iterate', async ({ collection, env }) => {
        const mapObj = collection.map(blockKey(env, collection, 'map'))
        const iteratedItems: Record<string, unknown> = {}
        let iteratedCount = 0
        for await (const [v, k] of mapObj) {
          iteratedItems[k] = v
          iteratedCount++
        }

        expect(iteratedCount, 'iterated count').toEqual(2)
        expect(iteratedItems, 'iterated items').toEqual({
          foo: 'test2',
          bar: 'test4',
        })
      })

      test('should successfully iterate with forEach', async ({
        collection,
        env,
      }) => {
        const mapObj = collection.map(blockKey(env, collection, 'map'))
        const iteratedItems: Record<string, unknown> = {}
        let iteratedCount = 0
        await mapObj.forEach((v, k) => {
          iteratedItems[k] = v
          iteratedCount++
        })

        expect(iteratedCount, 'iterated count').toEqual(2)
        expect(iteratedItems, 'iterated items').toEqual({
          foo: 'test2',
          bar: 'test4',
        })
      })

      test('should successfully get the size', async ({ collection, env }) => {
        const mapSize = await collection
          .map(blockKey(env, collection, 'map'))
          .size()
        expect(mapSize, 'map size').toEqual(2)
      })

      test('should successfully remove an item', async ({
        collection,
        env,
      }) => {
        const mapObj = collection.map(blockKey(env, collection, 'map'))
        await mapObj.remove('bar')

        const stillExists = await mapObj.exists('bar')
        expect(stillExists, "exists('bar') after remove").toEqual(false)
      })

      test('should fail to remove an invalid item', async ({
        collection,
        env,
      }) => {
        const mapObj = collection.map(blockKey(env, collection, 'map'))
        await expectThrows(
          () => mapObj.remove('invalid-item'),
          CouchbaseError,
          undefined,
          env.ctx({ op: 'map.remove', extra: 'invalid-item' })
        )
      })
    })

    describe('#queue', () => {
      test('should successfully get a queue reference', async ({
        collection,
        env,
      }) => {
        collection.queue(blockKey(env, collection, 'queue'))
      })

      test('should successfully push', async ({ collection, env }) => {
        await collection.queue(blockKey(env, collection, 'queue')).push('test2')
      })

      test('should successfully get the size', async ({ collection, env }) => {
        const queueSize = await collection
          .queue(blockKey(env, collection, 'queue'))
          .size()
        expect(queueSize, 'queue size').toEqual(1)
      })

      test('should successfully pop', async ({ collection, env }) => {
        const res = await collection
          .queue(blockKey(env, collection, 'queue'))
          .pop()
        expect(res, 'popped value').toEqual('test2')
      })

      test('should successfully push-pop in order', async ({
        collection,
        env,
      }) => {
        const queueObj = collection.queue(blockKey(env, collection, 'queue'))
        await queueObj.push('test1')
        await queueObj.push('test2')
        await queueObj.push('test3')

        const res1 = await queueObj.pop()
        const res2 = await queueObj.pop()
        const res3 = await queueObj.pop()

        expect(res1, 'first pop').toEqual('test1')
        expect(res2, 'second pop').toEqual('test2')
        expect(res3, 'third pop').toEqual('test3')
      })

      test('should error poping with no items', async ({ collection, env }) => {
        const queueObj = collection.queue(blockKey(env, collection, 'queue'))
        await expectThrows(
          () => queueObj.pop(),
          CouchbaseError,
          undefined,
          env.ctx({ op: 'queue.pop', extra: 'empty' })
        )
      })

      test('should error popping from an empty array', async ({
        collection,
        env,
      }) => {
        const key = blockKey(env, collection, 'queue')
        const queueObj = collection.queue(key)
        await collection.upsert(key, [])
        await expectThrows(
          () => queueObj.pop(),
          CouchbaseError,
          undefined,
          env.ctx({ op: 'queue.pop', key, extra: 'empty array' })
        )
      })
    })

    describe('#sets', () => {
      test('should successfully get a set reference', async ({
        collection,
        env,
      }) => {
        collection.set(blockKey(env, collection, 'set'))
      })

      test('should successfully add an item', async ({ collection, env }) => {
        const res = await collection
          .set(blockKey(env, collection, 'set'))
          .add('test1')
        expect(res, "add('test1')").toEqual(true)
      })

      test('should successfully add a second item', async ({
        collection,
        env,
      }) => {
        const res = await collection
          .set(blockKey(env, collection, 'set'))
          .add('test2')
        expect(res, "add('test2')").toEqual(true)
      })

      test('should semi-successfully add another matching item', async ({
        collection,
        env,
      }) => {
        const res = await collection
          .set(blockKey(env, collection, 'set'))
          .add('test2')
        expect(res, "re-add('test2')").toEqual(false)
      })

      test('should successfully get the size', async ({ collection, env }) => {
        const setSize = await collection
          .set(blockKey(env, collection, 'set'))
          .size()
        expect(setSize, 'set size').toEqual(2)
      })

      test('should successfully fetch all the values', async ({
        collection,
        env,
      }) => {
        const values = await collection
          .set(blockKey(env, collection, 'set'))
          .values()
        expect(values, 'values length').toHaveLength(2)
        expect(values, "contains 'test1'").toContain('test1')
        expect(values, "contains 'test2'").toContain('test2')
      })

      test('should successfully check if an item exists', async ({
        collection,
        env,
      }) => {
        const res = await collection
          .set(blockKey(env, collection, 'set'))
          .contains('test1')
        expect(res, "contains('test1')").toEqual(true)
      })

      test('should successfully check if an invalid item exists', async ({
        collection,
        env,
      }) => {
        const res = await collection
          .set(blockKey(env, collection, 'set'))
          .contains('invalid-item')
        expect(res, "contains('invalid-item')").toEqual(false)
      })

      test('should successfully remove an item', async ({
        collection,
        env,
      }) => {
        await collection.set(blockKey(env, collection, 'set')).remove('test2')
      })

      test('should error removing an invalid item', async ({
        collection,
        env,
      }) => {
        const setObj = collection.set(blockKey(env, collection, 'set'))
        await expectThrows(
          () => setObj.remove('invalid-item'),
          CouchbaseError,
          undefined,
          env.ctx({ op: 'set.remove', extra: 'invalid-item' })
        )
      })
    })
  }
)
