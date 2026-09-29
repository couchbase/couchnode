'use strict'

const assert = require('chai').assert

const { AnalyticsIndexManager } = require('../lib/analyticsindexmanager')
const { BucketManager } = require('../lib/bucketmanager')
const { CollectionManager } = require('../lib/collectionmanager')
const { EventingFunctionManager } = require('../lib/eventingfunctionmanager')
const {
  ObservabilityInstruments,
  OpAttributeName,
  SpanStatusCode,
} = require('../lib/observabilitytypes')
const { QueryIndexManager } = require('../lib/queryindexmanager')
const {
  ScopeEventingFunctionManager,
} = require('../lib/scopeeventingfunctionmanager')
const { ScopeSearchIndexManager } = require('../lib/scopesearchindexmanager')
const { SearchIndexManager } = require('../lib/searchindexmanager')
const { UserManager } = require('../lib/usermanager')
const { ViewIndexManager } = require('../lib/viewindexmanager')
const { TestMeter } = require('./metrics/metertypes')
const { TestTracer } = require('./tracing/tracingtypes')

// These tests need no server.  Every binding call on the stub connection
// succeeds with the response it is given, so each management call below
// reaches the step that turns that response into SDK types.
describe('#management spans', function () {
  let tracer
  let meter
  let response

  const conn = new Proxy(
    {},
    {
      get: () => (req, callback) => callback(null, response),
    }
  )
  const cluster = {
    conn: conn,
    managementTimeout: 1000,
  }
  const bucket = { name: 'bucket', conn: conn, cluster: cluster }

  beforeEach(function () {
    tracer = new TestTracer()
    meter = new TestMeter()
    cluster.observabilityInstruments = new ObservabilityInstruments(
      tracer,
      meter
    )
  })

  // Every field reads as null, which no decoding step accepts, and the
  // analysis a search index returns is not valid JSON.
  const undecodable = new Proxy(
    {},
    {
      get: (target, name) => (name === 'analysis' ? '{' : null),
    }
  )

  function recordedSpan() {
    assert.lengthOf(tracer.spans, 1)
    return tracer.spans[0]
  }

  function recordedMetric() {
    const recorders = meter.recorders.get(OpAttributeName.MeterNameOpDuration)
    assert.lengthOf(recorders, 1)
    return recorders[0]
  }

  const managers = [
    {
      name: 'AnalyticsIndexManager.getAllDatasets',
      call: () => new AnalyticsIndexManager(cluster).getAllDatasets(),
    },
    {
      name: 'BucketManager.getBucket',
      call: () => new BucketManager(cluster).getBucket('bucket'),
    },
    {
      name: 'CollectionManager.getAllScopes',
      call: () => new CollectionManager(bucket).getAllScopes(),
    },
    {
      name: 'EventingFunctionManager.getFunction',
      call: () => new EventingFunctionManager(cluster).getFunction('f'),
    },
    {
      name: 'QueryIndexManager.getAllIndexes',
      call: () => new QueryIndexManager(cluster).getAllIndexes('bucket'),
    },
    {
      name: 'ScopeEventingFunctionManager.getAllFunctions',
      call: () =>
        new ScopeEventingFunctionManager(cluster, 'b', 's').getAllFunctions(),
    },
    {
      name: 'ScopeSearchIndexManager.analyzeDocument',
      call: () =>
        new ScopeSearchIndexManager(cluster, 'b', 's').analyzeDocument(
          'index',
          {}
        ),
    },
    {
      name: 'SearchIndexManager.analyzeDocument',
      call: () => new SearchIndexManager(cluster).analyzeDocument('index', {}),
    },
    {
      name: 'UserManager.getAllGroups',
      call: () => new UserManager(cluster).getAllGroups(),
    },
    {
      name: 'ViewIndexManager.getDesignDocument',
      call: () => new ViewIndexManager(bucket).getDesignDocument('ddoc'),
    },
  ]

  managers.forEach((t) => {
    it(`${t.name} records a decoding failure as an error`, async function () {
      response = undecodable
      let rejection
      try {
        await t.call()
      } catch (err) {
        rejection = err
      }

      assert.isDefined(rejection)
      const span = recordedSpan()
      assert.isNotNull(span.endTime)
      assert.strictEqual(span.status.code, SpanStatusCode.ERROR)
      assert.strictEqual(span.status.message, rejection.message)
      assert.isDefined(recordedMetric().attributes[OpAttributeName.ErrorType])
    })
  })

  it('records a decoded response as a success', async function () {
    response = { groups: [] }
    const groups = await new UserManager(cluster).getAllGroups()

    assert.deepStrictEqual(groups, [])
    const span = recordedSpan()
    assert.isNotNull(span.endTime)
    assert.strictEqual(span.status.code, SpanStatusCode.UNSET)
    assert.isUndefined(recordedMetric().attributes[OpAttributeName.ErrorType])
  })
})
