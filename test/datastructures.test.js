'use strict'

const assert = require('chai').assert
const H = require('./harness')

function genericTests(collFn) {
  describe('#list', function () {
    let testKeyLst
    let listObj = null

    before(function () {
      testKeyLst = H.genTestKey()
    })

    it('should successfully get a list reference', async function () {
      listObj = collFn().list(testKeyLst)
    })

    it('should successfully append to a list', async function () {
      await listObj.push('test2')
    })

    it('should successfully prepend to a list', async function () {
      await listObj.unshift('test1')
    })

    it('should successfully fetch the whole list', async function () {
      var items = await listObj.getAll()

      assert.lengthOf(items, 2)
      assert.deepEqual(items[0], 'test1')
      assert.deepEqual(items[1], 'test2')
    })

    it('should successfully fetch a particular index', async function () {
      var item = await listObj.getAt(1)
      assert.deepEqual(item, 'test2')
    })

    it('should error accessing an invalid index', async function () {
      await H.throwsHelper(async () => {
        await listObj.getAt(4)
      }, H.CouchbaseError)
    })

    it('should successfully iterate a list', async function () {
      H.skipIfMissingAwaitOf()

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

    it('should successfully iterate a list with forEach', async function () {
      var iteratedItems = []
      await listObj.forEach((item) => {
        iteratedItems.push(item)
      })

      assert.lengthOf(iteratedItems, 2)
      assert.deepEqual(iteratedItems[0], 'test1')
      assert.deepEqual(iteratedItems[1], 'test2')
    })

    it('should successfully find the index of an item', async function () {
      var test2Idx = await listObj.indexOf('test2')
      assert.equal(test2Idx, 1)
    })

    it('should successfully return -1 for an invalid item', async function () {
      var missingIdx = await listObj.indexOf('missing-item')
      assert.equal(missingIdx, -1)
    })

    it('should successfully get the size', async function () {
      var listSize = await listObj.size()
      assert.equal(listSize, 2)
    })

    it('should successfully remove by index', async function () {
      await listObj.removeAt(1)

      var remainingItems = await listObj.getAll()
      assert.lengthOf(remainingItems, 1)
      assert.deepEqual(remainingItems[0], 'test1')
    })

    it('should fail to remove an invalid index', async function () {
      await H.throwsHelper(async () => {
        await listObj.removeAt(4)
      }, H.CouchbaseError)
    })
  })

  describe('#map', function () {
    let testKeyMap
    let mapObj = null

    before(function () {
      testKeyMap = H.genTestKey()
    })

    it('should successfully get a map reference', async function () {
      mapObj = collFn().map(testKeyMap)
    })

    it('should successfully add an item', async function () {
      await mapObj.set('foo', 'test2')
    })

    it('should successfully set a second item', async function () {
      await mapObj.set('bar', 'test4')
    })

    it('should successfully fetch the whole map', async function () {
      var items = await mapObj.getAll()

      assert.deepEqual(items, {
        foo: 'test2',
        bar: 'test4',
      })
    })

    it('should successfully fetch a particular item', async function () {
      var item = await mapObj.get('bar')
      assert.deepEqual(item, 'test4')
    })

    it('should error fetching an invalid item', async function () {
      await H.throwsHelper(async () => {
        await mapObj.get('invalid-item')
      }, H.CouchbaseError)
    })

    it('should successfully check the existance of a particular item', async function () {
      var result = await mapObj.exists('bar')
      assert.equal(result, true)
    })

    it('should return false when checking existance of an invalid item', async function () {
      var result = await mapObj.exists('invalid-item')
      assert.equal(result, false)
    })

    it('should successfully iterate', async function () {
      H.skipIfMissingAwaitOf()

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

    it('should successfully iterate with forEach', async function () {
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

    it('should successfully get the size', async function () {
      var mapSize = await mapObj.size()
      assert.equal(mapSize, 2)
    })

    it('should successfully remove an item', async function () {
      await mapObj.remove('bar')

      var stillExists = await mapObj.exists('bar')
      assert.equal(stillExists, false)
    })

    it('should fail to remove an invalid item', async function () {
      await H.throwsHelper(async () => {
        await mapObj.remove('invalid-item')
      }, H.CouchbaseError)
    })
  })

  describe('#queue', function () {
    let testKeyQue
    let queueObj = null

    before(function () {
      testKeyQue = H.genTestKey()
    })

    it('should successfully get a queue reference', async function () {
      queueObj = collFn().queue(testKeyQue)
    })

    it('should successfully push', async function () {
      await queueObj.push('test2')
    })

    it('should successfully get the size', async function () {
      var queueSize = await queueObj.size()
      assert.equal(queueSize, 1)
    })

    it('should successfully pop', async function () {
      var res = await queueObj.pop()
      assert.deepEqual(res, 'test2')
    })

    it('should successfully push-pop in order', async function () {
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

    it('should error poping with no items', async function () {
      await H.throwsHelper(async () => {
        await queueObj.pop()
      }, H.lib.CouchbaseError)
    })

    it('should error popping from an empty array', async function () {
      await collFn().upsert(testKeyQue, [])
      await H.throwsHelper(async () => {
        await queueObj.pop()
      }, H.lib.CouchbaseError)
    })
  })

  describe('#sets', function () {
    let testKeySet
    let setObj

    before(function () {
      testKeySet = H.genTestKey()
    })

    it('should successfully get a set reference', async function () {
      setObj = collFn().set(testKeySet)
    })

    it('should successfully add an item', async function () {
      var res = await setObj.add('test1')
      assert.equal(res, true)
    })

    it('should successfully add a second item', async function () {
      var res = await setObj.add('test2')
      assert.equal(res, true)
    })

    it('should semi-successfully add another matching item', async function () {
      var res = await setObj.add('test2')
      assert.equal(res, false)
    })

    it('should successfully get the size', async function () {
      var setSize = await setObj.size()
      assert.equal(setSize, 2)
    })

    it('should successfully fetch all the values', async function () {
      var values = await setObj.values()

      assert.lengthOf(values, 2)
      assert.oneOf('test1', values)
      assert.oneOf('test2', values)
    })

    it('should successfully check if an item exists', async function () {
      var res = await setObj.contains('test1')
      assert.equal(res, true)
    })

    it('should successfully check if an invalid item exists', async function () {
      var res = await setObj.contains('invalid-item')
      assert.equal(res, false)
    })

    it('should successfully remove an item', async function () {
      await setObj.remove('test2')
    })

    it('should error removing an invalid item', async function () {
      await H.throwsHelper(async () => {
        await setObj.remove('invalid-item')
      }, H.lib.CouchbaseError)
    })
  })
}

describe('#datastructures', function () {
  /* eslint-disable-next-line mocha/no-setup-in-describe */
  genericTests(() => H.dco)
})

describe('#collections-datastructures', function () {
  /* eslint-disable-next-line mocha/no-hooks-for-single-case */
  before(function () {
    H.skipIfMissingFeature(this, H.Features.Collections)
  })

  /* eslint-disable-next-line mocha/no-setup-in-describe */
  genericTests(() => H.co)
})
