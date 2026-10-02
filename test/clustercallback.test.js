'use strict'

const assert = require('chai').assert

const { Cluster } = require('../lib/cluster')
const { connect } = require('../lib/couchbase')

// These tests need no server.  A connect fails in the Cluster constructor
// before anything reaches the binding, and a close runs against a stubbed
// connection and transactions object.
describe('#cluster callbacks', function () {
  const failure = new Error('close failed')

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

  // An unregistered profile makes the Cluster constructor throw.
  const connects = [
    { name: 'Cluster.connect', fn: Cluster.connect },
    { name: 'connect', fn: connect },
  ]
  const badProfile = /unregistered is not a registered profile/

  connects.forEach((t) => {
    const call = (cb) =>
      t.fn('couchbase://localhost', { configProfile: 'unregistered' }, cb)

    it(`${t.name} reports a failure through the callback only`, async function () {
      let callbackError
      await new Promise((resolve) => {
        call((err) => {
          callbackError = err
          resolve()
        })
      })
      await settle()

      assert.match(callbackError.message, badProfile)
      assert.strictEqual(unhandledRejections, 0)
    })

    it(`${t.name} still rejects the promise it returns`, async function () {
      let rejection
      try {
        await call(() => {})
      } catch (err) {
        rejection = err
      }
      await settle()

      assert.match(rejection.message, badProfile)
      assert.strictEqual(unhandledRejections, 0)
    })
  })

  // Cluster.close cancels open query streams and waits for transactions to
  // close before it shuts down the connection, so a failure in either has to
  // reach the callback as well.
  function closingCluster(closeTransactions, openQueryStreams = []) {
    const c = Object.create(Cluster.prototype)
    c._openQueryStreams = new Set(openQueryStreams)
    c._transactions = { _close: closeTransactions }
    c._conn = { shutdown: (cb) => cb(null) }
    return c
  }

  it('Cluster.close reports a failure through the callback only', async function () {
    const c = closingCluster(() => Promise.reject(failure))
    let callbackError
    c.close((err) => {
      callbackError = err
    })
    await settle()

    assert.strictEqual(callbackError, failure)
    assert.strictEqual(unhandledRejections, 0)
  })

  it('Cluster.close still rejects the promise it returns', async function () {
    const c = closingCluster(() => Promise.reject(failure))
    let rejection
    try {
      await c.close(() => {})
    } catch (err) {
      rejection = err
    }
    await settle()

    assert.strictEqual(rejection, failure)
    assert.strictEqual(unhandledRejections, 0)
  })

  it('Cluster.close succeeds through the callback and the promise', async function () {
    const c = closingCluster(() => Promise.resolve())
    let callbackError
    await c.close((err) => {
      callbackError = err
    })
    await settle()

    assert.isNull(callbackError)
    assert.isUndefined(c._transactions)
    assert.strictEqual(unhandledRejections, 0)
  })

  it('Cluster.close reports a stream cancel failure through the callback only', async function () {
    const stream = {
      cancel: () => {
        throw failure
      },
      ended: Promise.resolve(),
    }
    const c = closingCluster(() => Promise.resolve(), [stream])
    let callbackError
    c.close((err) => {
      callbackError = err
    })
    await settle()

    assert.strictEqual(callbackError, failure)
    assert.isTrue(c._closing)
    assert.strictEqual(unhandledRejections, 0)
  })

  // A method declared async wraps what it returns in a promise no caller
  // holds, so a callback-form failure surfaces as an unhandled rejection.
  // Only the internal helpers, which take no callback, stay async.
  it('declares only the callback-free helpers async', function () {
    const asyncMethods = []
    Object.getOwnPropertyNames(Cluster.prototype).forEach((name) => {
      const desc = Object.getOwnPropertyDescriptor(Cluster.prototype, name)
      if (
        desc.value instanceof Function &&
        desc.value.constructor.name === 'AsyncFunction'
      ) {
        asyncMethods.push(`Cluster.${name}`)
      }
    })
    connects.forEach((t) => {
      if (t.fn.constructor.name === 'AsyncFunction') {
        asyncMethods.push(t.name)
      }
    })

    assert.sameMembers(asyncMethods, [
      'Cluster._cancelQueryStreams',
      'Cluster._connect',
    ])
  })
})
