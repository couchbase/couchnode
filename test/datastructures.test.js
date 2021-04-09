'use strict'

const assert = require('chai').assert
const H = require('./harness')

function genericTests(collFn) {
  describe('#list', () => {
    const testKeyLst = H.genTestKey()
    var listObj = null

    it('should successfully get a list reference', async () => {
      listObj = collFn().list(testKeyLst)
    })

    it('should successfully append to a list', async () => {
      await listObj.push('test2')
    })

    it('should successfully prepend to a list', async () => {
      await listObj.unshift('test1')
    })

    it('should successfully fetch the whole list', async () => {
      var items = await listObj.getAll()

      assert.lengthOf(items, 2)
      assert.deepEqual(items[0], 'test1')
      assert.deepEqual(items[1], 'test2')
    })

    it('should successfully fetch a particular index', async () => {
      var item = await listObj.getAt(1)
      assert.deepEqual(item, 'test2')
    })

    it('should error accessing an invalid index', async () => {
      await H.throwsHelper(async () => {
        await listObj.getAt(4)
      }, H.CouchbaseError)
    })

    H.requireForAwaitOf(() => {
      it('should successfully iterate a list', async () => {
        var iteratedItems = []
        // We run this with eval to ensure that the use of await which is a
        // reserved word in some versions does not trigger a script parse error.
        await eval(`
            (async function() {
              for await (var item of listObj) {
                iteratedItems.push(item);
              }
            })()
          `)

        assert.lengthOf(iteratedItems, 2)
        assert.deepEqual(iteratedItems[0], 'test1')
        assert.deepEqual(iteratedItems[1], 'test2')
      })
    })

    it('should successfully iterate a list with forEach', async () => {
      var iteratedItems = []
      await listObj.forEach((item) => {
        iteratedItems.push(item)
      })

      assert.lengthOf(iteratedItems, 2)
      assert.deepEqual(iteratedItems[0], 'test1')
      assert.deepEqual(iteratedItems[1], 'test2')
    })

    it('should successfully find the index of an item', async () => {
      var test2Idx = await listObj.indexOf('test2')
      assert.equal(test2Idx, 1)
    })

    it('should successfully return -1 for an invalid item', async () => {
      var missingIdx = await listObj.indexOf('missing-item')
      assert.equal(missingIdx, -1)
    })

    it('should successfully get the size', async () => {
      var listSize = await listObj.size()
      assert.equal(listSize, 2)
    })

    it('should successfully remove by index', async () => {
      await listObj.removeAt(1)

      var remainingItems = await listObj.getAll()
      assert.lengthOf(remainingItems, 1)
      assert.deepEqual(remainingItems[0], 'test1')
    })

    it('should fail to remove an invalid index', async () => {
      await H.throwsHelper(async () => {
        await listObj.removeAt(4)
      }, H.CouchbaseError)
    })
  })

  describe('#map', () => {
    const testKeyMap = H.genTestKey()
    var mapObj = null

    it('should successfully get a map reference', async () => {
      mapObj = collFn().map(testKeyMap)
    })

    it('should successfully add an item', async () => {
      await mapObj.set('foo', 'test2')
    })

    it('should successfully set a second item', async () => {
      await mapObj.set('bar', 'test4')
    })

    it('should successfully fetch the whole map', async () => {
      var items = await mapObj.getAll()

      assert.deepEqual(items, {
        foo: 'test2',
        bar: 'test4',
      })
    })

    it('should successfully fetch a particular item', async () => {
      var item = await mapObj.get('bar')
      assert.deepEqual(item, 'test4')
    })

    it('should error fetching an invalid item', async () => {
      await H.throwsHelper(async () => {
        await mapObj.get('invalid-item')
      }, H.CouchbaseError)
    })

    it('should successfully check the existance of a particular item', async () => {
      var result = await mapObj.exists('bar')
      assert.equal(result, true)
    })

    it('should return false when checking existance of an invalid item', async () => {
      var result = await mapObj.exists('invalid-item')
      assert.equal(result, false)
    })

    H.requireForAwaitOf(() => {
      it('should successfully iterate', async () => {
        var iteratedItems = {}
        var iteratedCount = 0
        // We run this with eval to ensure that the use of await which is a
        // reserved word in some versions does not trigger a script parse error.
        await eval(`
            (async function() {
              for await (var [v, k] of mapObj) {
                iteratedItems[k] = v;
                iteratedCount++;
              }
            })()
          `)

        assert.equal(iteratedCount, 2)
        assert.deepEqual(iteratedItems, {
          foo: 'test2',
          bar: 'test4',
        })
      })
    })

    it('should successfully iterate with forEach', async () => {
      var iteratedItems = {}
      var iteratedCount = 0
      await mapObj.forEach((v, k) => {
        iteratedItems[k] = v
        iteratedCount++
      })

      assert.equal(iteratedCount, 2)
      assert.deepEqual(iteratedItems, {
        foo: 'test2',
        bar: 'test4',
      })
    })

    it('should successfully get the size', async () => {
      var mapSize = await mapObj.size()
      assert.equal(mapSize, 2)
    })

    it('should successfully remove an item', async () => {
      await mapObj.remove('bar')

      var stillExists = await mapObj.exists('bar')
      assert.equal(stillExists, false)
    })

    it('should fail to remove an invalid item', async () => {
      await H.throwsHelper(async () => {
        await mapObj.remove('invalid-item')
      }, H.CouchbaseError)
    })
  })

  describe('#queue', () => {
    const testKeyQue = H.genTestKey()
    var queueObj = null

    it('should successfully get a queue reference', async () => {
      queueObj = collFn().queue(testKeyQue)
    })

    it('should successfully push', async () => {
      await queueObj.push('test2')
    })

    it('should successfully get the size', async () => {
      var queueSize = await queueObj.size()
      assert.equal(queueSize, 1)
    })

    it('should successfully pop', async () => {
      var res = await queueObj.pop()
      assert.deepEqual(res, 'test2')
    })

    it('should successfully push-pop in order', async () => {
      await queueObj.push('test1')
      await queueObj.push('test2')
      await queueObj.push('test3')

      var res1 = await queueObj.pop()
      var res2 = await queueObj.pop()
      var res3 = await queueObj.pop()

      assert.deepEqual(res1, 'test1')
      assert.deepEqual(res2, 'test2')
      assert.deepEqual(res3, 'test3')
    })

    it('should error poping with no items', async () => {
      await H.throwsHelper(async () => {
        await queueObj.pop()
      }, H.lib.CouchbaseError)
    })

    it('should error popping from an empty array', async () => {
      await collFn().upsert(testKeyQue, [])
      await H.throwsHelper(async () => {
        await queueObj.pop()
      }, H.lib.CouchbaseError)
    })
  })

  describe('#sets', () => {
    const testKeySet = H.genTestKey()
    var setObj = null

    it('should successfully get a set reference', async () => {
      setObj = collFn().set(testKeySet)
    })

    it('should successfully add an item', async () => {
      var res = await setObj.add('test1')
      assert.equal(res, true)
    })

    it('should successfully add a second item', async () => {
      var res = await setObj.add('test2')
      assert.equal(res, true)
    })

    it('should semi-successfully add another matching item', async () => {
      var res = await setObj.add('test2')
      assert.equal(res, false)
    })

    it('should successfully get the size', async () => {
      var setSize = await setObj.size()
      assert.equal(setSize, 2)
    })

    it('should successfully fetch all the values', async () => {
      var values = await setObj.values()

      assert.lengthOf(values, 2)
      assert.oneOf('test1', values)
      assert.oneOf('test2', values)
    })

    it('should successfully check if an item exists', async () => {
      var res = await setObj.contains('test1')
      assert.equal(res, true)
    })

    it('should successfully check if an invalid item exists', async () => {
      var res = await setObj.contains('invalid-item')
      assert.equal(res, false)
    })

    it('should successfully remove an item', async () => {
      await setObj.remove('test2')
    })

    it('should error removing an invalid item', async () => {
      await H.throwsHelper(async () => {
        await setObj.remove('invalid-item')
      }, H.lib.CouchbaseError)
    })
  })
}

describe('#datastructures', () => {
  genericTests(() => H.dco)
})

describe('#collections-datastructures', () => {
  H.requireFeature(H.Features.Collections, () => {
    genericTests(() => H.co)
  })
})
