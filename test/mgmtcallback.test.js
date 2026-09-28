'use strict'

const assert = require('chai').assert

const { AnalyticsIndexManager } = require('../lib/analyticsindexmanager')
const { BucketManager } = require('../lib/bucketmanager')
const { CollectionManager } = require('../lib/collectionmanager')
const { InvalidArgumentError } = require('../lib/errors')
const { EventingFunctionManager } = require('../lib/eventingfunctionmanager')
const { NoOpMeter, NoOpTracer } = require('../lib/observability')
const { ObservabilityInstruments } = require('../lib/observabilitytypes')
const {
  CollectionQueryIndexManager,
  QueryIndexManager,
} = require('../lib/queryindexmanager')
const {
  ScopeEventingFunctionManager,
} = require('../lib/scopeeventingfunctionmanager')
const { ScopeSearchIndexManager } = require('../lib/scopesearchindexmanager')
const { SearchIndexManager } = require('../lib/searchindexmanager')
const { UserManager } = require('../lib/usermanager')
const { ViewIndexManager } = require('../lib/viewindexmanager')

// These tests need no server.  Every binding call on the stub connection
// fails, so each management call below takes its error path.
describe('#management callbacks', function () {
  const failure = new Error('binding call failed')

  const conn = new Proxy(
    {},
    {
      get: () => () => {
        throw failure
      },
    }
  )
  const cluster = {
    conn: conn,
    managementTimeout: 1000,
    observabilityInstruments: new ObservabilityInstruments(
      new NoOpTracer(),
      new NoOpMeter()
    ),
  }
  const bucket = { name: 'bucket', conn: conn, cluster: cluster }
  const collection = {
    name: 'collection',
    scope: { name: 'scope', bucket: bucket },
    cluster: cluster,
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

  const managers = [
    {
      name: 'AnalyticsIndexManager.connectLink',
      manager: () => new AnalyticsIndexManager(cluster),
      call: (m, cb) => m.connectLink(cb),
    },
    {
      name: 'BucketManager.dropBucket',
      manager: () => new BucketManager(cluster),
      call: (m, cb) => m.dropBucket('bucket', cb),
    },
    {
      name: 'CollectionManager.getAllScopes',
      manager: () => new CollectionManager(bucket),
      call: (m, cb) => m.getAllScopes(cb),
    },
    {
      name: 'EventingFunctionManager.getAllFunctions',
      manager: () => new EventingFunctionManager(cluster),
      call: (m, cb) => m.getAllFunctions(cb),
    },
    {
      name: 'QueryIndexManager.getAllIndexes',
      manager: () => new QueryIndexManager(cluster),
      call: (m, cb) => m.getAllIndexes('bucket', cb),
    },
    {
      name: 'CollectionQueryIndexManager.getAllIndexes',
      manager: () => new CollectionQueryIndexManager(collection),
      call: (m, cb) => m.getAllIndexes(cb),
    },
    {
      name: 'ScopeEventingFunctionManager.getAllFunctions',
      manager: () => new ScopeEventingFunctionManager(cluster, 'b', 's'),
      call: (m, cb) => m.getAllFunctions(cb),
    },
    {
      name: 'ScopeSearchIndexManager.getAllIndexes',
      manager: () => new ScopeSearchIndexManager(cluster, 'b', 's'),
      call: (m, cb) => m.getAllIndexes(cb),
    },
    {
      name: 'SearchIndexManager.getAllIndexes',
      manager: () => new SearchIndexManager(cluster),
      call: (m, cb) => m.getAllIndexes(cb),
    },
    {
      name: 'UserManager.getAllGroups',
      manager: () => new UserManager(cluster),
      call: (m, cb) => m.getAllGroups(cb),
    },
    {
      name: 'ViewIndexManager.getAllDesignDocuments',
      manager: () => new ViewIndexManager(bucket),
      call: (m, cb) => m.getAllDesignDocuments(cb),
    },
  ]

  managers.forEach((t) => {
    it(`${t.name} reports a failure through the callback only`, async function () {
      let callbackError
      await new Promise((resolve) => {
        t.call(t.manager(), (err) => {
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
        await t.call(t.manager(), () => {})
      } catch (err) {
        rejection = err
      }
      await settle()

      assert.strictEqual(rejection, failure)
      assert.strictEqual(unhandledRejections, 0)
    })
  })

  it('reports an invalid argument without leaking a rejection', async function () {
    const manager = new UserManager(cluster)
    let callbackCalled = false
    assert.throws(
      () =>
        manager.getAllUsers({ domainName: 'not-a-domain' }, () => {
          callbackCalled = true
        }),
      InvalidArgumentError
    )
    await settle()

    assert.isFalse(callbackCalled)
    assert.strictEqual(unhandledRejections, 0)
  })

  // A method declared async wraps what it returns in a promise no caller
  // holds, so a callback-form failure surfaces as an unhandled rejection.
  it('declares no management method async', function () {
    const classes = managers.map((t) => t.manager().constructor)
    classes.push(new QueryIndexManager(cluster)._manager.constructor)

    const asyncMethods = []
    new Set(classes).forEach((cls) => {
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

    assert.deepStrictEqual(asyncMethods, [])
  })
})
