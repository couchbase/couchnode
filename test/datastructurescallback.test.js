'use strict'

const assert = require('chai').assert

const {
  CouchbaseList,
  CouchbaseMap,
  CouchbaseQueue,
  CouchbaseSet,
} = require('../lib/datastructures')
const { NoOpMeter, NoOpTracer } = require('../lib/observability')
const { ObservabilityInstruments } = require('../lib/observabilitytypes')

// These tests need no server.  The data structures sit on a collection rather
// than on the binding, so the stub is a collection whose every call fails.
describe('#data structure callbacks', function () {
  const failure = new Error('collection call failed')

  const collection = {
    observabilityInstruments: new ObservabilityInstruments(
      new NoOpTracer(),
      new NoOpMeter()
    ),
    _cppDocId: () => ({}),
    get: () => Promise.reject(failure),
    lookupIn: () => Promise.reject(failure),
    mutateIn: () => Promise.reject(failure),
  }

  let originalListeners
  let unhandledRejections

  function countUnhandledRejection() {
    unhandledRejections++
  }

  before(function () {
    // Mocha installs its own listener, which fails the run on the first
    // unhandled rejection.  Replace it so the count is ours to assert on.
    originalListeners = process.listeners('unhandledRejection')
    process.removeAllListeners('unhandledRejection')
    process.on('unhandledRejection', countUnhandledRejection)
  })

  after(function () {
    process.removeListener('unhandledRejection', countUnhandledRejection)
    originalListeners.forEach((l) => process.on('unhandledRejection', l))
  })

  beforeEach(function () {
    unhandledRejections = 0
  })

  // Node reports an unhandled rejection only once the microtask queue has
  // drained, which can be after the callback has already run.
  function settle() {
    return new Promise((resolve) => setTimeout(resolve, 20))
  }

  const structures = [
    {
      name: 'CouchbaseList.getAll',
      structure: () => new CouchbaseList(collection, 'key'),
      call: (s, cb) => s.getAll(cb),
    },
    {
      name: 'CouchbaseMap.get',
      structure: () => new CouchbaseMap(collection, 'key'),
      call: (s, cb) => s.get('item', cb),
    },
    {
      name: 'CouchbaseQueue.size',
      structure: () => new CouchbaseQueue(collection, 'key'),
      call: (s, cb) => s.size(cb),
    },
    {
      name: 'CouchbaseSet.add',
      structure: () => new CouchbaseSet(collection, 'key'),
      call: (s, cb) => s.add('item', cb),
    },
  ]

  structures.forEach((t) => {
    it(`${t.name} reports a failure through the callback only`, async function () {
      let callbackError
      await new Promise((resolve) => {
        t.call(t.structure(), (err) => {
          callbackError = err
          resolve()
        })
      })
      await settle()

      assert.strictEqual(callbackError, failure)
      assert.strictEqual(unhandledRejections, 0)
    })

    it(`${t.name} still rejects the promise it returns`, async function () {
      let rejection
      try {
        await t.call(t.structure(), () => {})
      } catch (err) {
        rejection = err
      }
      await settle()

      assert.strictEqual(rejection, failure)
      assert.strictEqual(unhandledRejections, 0)
    })
  })

  // A method declared async wraps what it returns in a promise no caller
  // holds, so a callback-form failure surfaces as an unhandled rejection.
  // Only the private readers, which take no callback, stay async.
  it('declares only the private readers async', function () {
    const asyncMethods = []
    structures.forEach((t) => {
      const cls = t.structure().constructor
      Object.getOwnPropertyNames(cls.prototype).forEach((name) => {
        const desc = Object.getOwnPropertyDescriptor(cls.prototype, name)
        if (
          desc.value instanceof Function &&
          desc.value.constructor.name === 'AsyncFunction'
        ) {
          asyncMethods.push(`${cls.name}.${name}`)
        }
      })
    })

    assert.sameMembers(asyncMethods, [
      'CouchbaseList._get',
      'CouchbaseMap._get',
      'CouchbaseQueue._get',
      'CouchbaseSet._get',
    ])
  })
})
