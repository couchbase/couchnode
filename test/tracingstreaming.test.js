'use strict'

const assert = require('chai').assert
const H = require('./harness')
const {
  NoOpTestTracer,
  TestTracer,
  ThresholdLoggingTestTracer,
} = require('./tracing/tracingtypes')
const { createHttpValidator } = require('./tracing/validators')
const { StreamingOp } = require('../lib/observabilitytypes')
const { DesignDocumentNamespace } = require('../lib/viewtypes')

function tracingTests(
  clusterFn,
  bucketFn,
  collFn,
  tracerFn,
  collectionDetailsFn
) {
  describe('#Streaming Operations', function () {
    let tracer
    let cluster
    let bucket
    let coll
    let collectionDetails
    let validator

    before(async function () {
      cluster = clusterFn()
      bucket = bucketFn()
      coll = collFn()
      tracer = tracerFn()
      collectionDetails = collectionDetailsFn()
      validator = createHttpValidator(
        tracer,
        collectionDetails,
        H.supportsClusterLabels
      )
    })

    describe('#Analytics Operations', function () {
      before(function () {
        H.skipIfMissingFeature(this, H.Features.Analytics)
      })

      it('should perform analytics query operation', async function () {
        let statement = 'SELECT 1=1;'
        validator.reset().op(StreamingOp.Analytics)
        let res = await cluster.analyticsQuery(statement)
        assert.isArray(res.rows)
        validator.validate()

        statement = 'SELECT $named_param as param'
        validator.reset().op(StreamingOp.Analytics).statement(statement)
        res = await cluster.analyticsQuery(statement, {
          parameters: { named_param: 5 },
        })
        assert.isArray(res.rows)
        validator.validate()

        statement = 'SELECT $1 as param'
        validator.reset().op(StreamingOp.Analytics).statement(statement)
        res = await cluster.analyticsQuery(statement, { parameters: ['hello'] })
        assert.isArray(res.rows)
        validator.validate()

        statement = 'SELECT 1=1;'
        validator.reset()
        let parentSpan = tracer.requestSpan('analytics-parent-span')
        validator.op(StreamingOp.Analytics).parent(parentSpan)
        res = await cluster.analyticsQuery(statement, {
          parentSpan: parentSpan,
        })
        assert.isArray(res.rows)
        validator.validate()

        statement = 'This is not SQL++;'
        validator.reset().op(StreamingOp.Analytics).error(true)
        try {
          await cluster.analyticsQuery(statement)
        } catch (_e) {
          // ignore
        }
        validator.validate()
      })
    })

    describe('#Query Operations', function () {
      const queryLevelMap = {
        cluster: { op: StreamingOp.Query, executor: () => cluster },
        scope: { op: StreamingOp.Query, executor: () => coll.scope },
      }

      before(function () {
        H.skipIfMissingFeature(this, H.Features.Query)
      })

      Object.keys(queryLevelMap).forEach((queryLevel) => {
        it(`should perform ${queryLevel} level query operations`, async function () {
          let statement = 'SELECT 1=1;'
          validator.reset().op(queryLevelMap[queryLevel].op)
          if (queryLevel === 'scope') {
            validator.bucketName(bucket.name)
            validator.scopeName(coll.scope.name)
          }
          let res = await queryLevelMap[queryLevel].executor().query(statement)
          assert.isArray(res.rows)
          validator.validate()

          statement = 'SELECT $named_param as param'
          validator
            .reset()
            .op(queryLevelMap[queryLevel].op)
            .statement(statement)
          if (queryLevel === 'scope') {
            validator.bucketName(bucket.name)
            validator.scopeName(coll.scope.name)
          }
          res = await queryLevelMap[queryLevel]
            .executor()
            .query(statement, { parameters: { named_param: 5 } })
          assert.isArray(res.rows)
          validator.validate()

          statement = 'SELECT $1 as param'
          validator
            .reset()
            .op(queryLevelMap[queryLevel].op)
            .statement(statement)

          if (queryLevel === 'scope') {
            validator.bucketName(bucket.name)
            validator.scopeName(coll.scope.name)
          }
          res = await queryLevelMap[queryLevel]
            .executor()
            .query(statement, { parameters: ['hello'] })
          assert.isArray(res.rows)
          validator.validate()

          statement = 'SELECT 1=1;'
          validator.reset()
          let parentSpan = tracer.requestSpan('query-parent-span')
          validator.op(queryLevelMap[queryLevel].op).parent(parentSpan)
          if (queryLevel === 'scope') {
            validator.bucketName(bucket.name)
            validator.scopeName(coll.scope.name)
          }
          res = await queryLevelMap[queryLevel]
            .executor()
            .query(statement, { parentSpan: parentSpan })
          assert.isArray(res.rows)
          validator.validate()

          statement = 'This is not SQL++;'
          validator.reset().op(queryLevelMap[queryLevel].op).error(true)
          if (queryLevel === 'scope') {
            validator.bucketName(bucket.name)
            validator.scopeName(coll.scope.name)
          }
          try {
            await queryLevelMap[queryLevel].executor().query(statement)
          } catch (_e) {
            // ignore
          }
          validator.validate()
        })
      })
    })

    describe('#Search Operations', function () {
      const searchLevelMap = {
        cluster: { op: StreamingOp.Search, executor: () => cluster },
        scope: { op: StreamingOp.Search, executor: () => coll.scope },
      }

      before(function () {
        H.skipIfMissingFeature(this, H.Features.Search)
      })

      Object.keys(searchLevelMap).forEach((searchLevel) => {
        it(`should perform ${searchLevel} level search operation`, async function () {
          if (searchLevel === 'scope') {
            H.skipIfMissingFeature(this, H.Features.ScopeSearch)
          }
          // search is a ROYAL PITA to setup, only testing errors (but we still talk to the server)
          validator.reset().op(searchLevelMap[searchLevel].op).error(true)
          if (searchLevel === 'scope') {
            validator.bucketName(bucket.name)
            validator.scopeName(coll.scope.name)
          }
          try {
            await searchLevelMap[searchLevel]
              .executor()
              .search('not-an-index', H.lib.SearchQuery.term('test'))
          } catch (_e) {
            // ignore
          }
          validator.validate()

          validator.reset()
          let parentSpan = tracer.requestSpan('search-parent-span')
          validator
            .op(searchLevelMap[searchLevel].op)
            .parent(parentSpan)
            .error(true)
          if (searchLevel === 'scope') {
            validator.bucketName(bucket.name)
            validator.scopeName(coll.scope.name)
          }
          try {
            await searchLevelMap[searchLevel]
              .executor()
              .search('not-an-index', H.lib.SearchQuery.term('test'), {
                parentSpan: parentSpan,
              })
          } catch (_e) {
            // ignore
          }
          validator.validate()
        })
      })
    })

    describe('#View Operations', function () {
      before(function () {
        H.skipIfMissingFeature(this, H.Features.Views)
      })

      it('should perform view operation', async function () {
        // views are deprecated, only testing errors (but we still talk to the server)
        validator
          .reset()
          .op(StreamingOp.View)
          .bucketName(bucket.name)
          .error(true)
        try {
          await bucket.viewQuery('not-a-design-doc', 'not-a-view', {
            namespace: DesignDocumentNamespace.Development,
          })
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset()
        let parentSpan = tracer.requestSpan('view-parent-span')
        validator
          .op(StreamingOp.View)
          .bucketName(bucket.name)
          .parent(parentSpan)
          .error(true)
        try {
          await bucket.viewQuery('not-a-design-doc', 'not-a-view', {
            namespace: DesignDocumentNamespace.Development,
            parentSpan: parentSpan,
          })
        } catch (_e) {
          // ignore
        }
        validator.validate()
      })
    })
  })
}

describe('#basic tracing', function () {
  let tracer
  let cluster
  let bucket
  let coll
  let collectionDetails

  before(async function () {
    let opts = H.connOpts
    opts.tracingConfig = { enableTracing: true }
    tracer = new TestTracer()
    opts.tracer = tracer
    cluster = await H.lib.Cluster.connect(H.connStr, opts)
    bucket = cluster.bucket(H.bucketName)
    coll = bucket.defaultCollection()
  })

  after(async function () {
    await cluster.close()
  })

  tracingTests(
    () => cluster,
    () => bucket,
    () => coll,
    () => tracer,
    () => collectionDetails
  )
})

describe('#no-op tracing', function () {
  let tracer
  let cluster
  let bucket
  let coll
  let collectionDetails

  before(async function () {
    let opts = H.connOpts
    opts.tracingConfig = { enableTracing: true }
    tracer = new NoOpTestTracer()
    opts.tracer = tracer
    cluster = await H.lib.Cluster.connect(H.connStr, opts)
    bucket = cluster.bucket(H.bucketName)
    coll = bucket.defaultCollection()
  })

  after(async function () {
    await cluster.close()
  })

  tracingTests(
    () => cluster,
    () => bucket,
    () => coll,
    () => tracer,
    () => collectionDetails
  )
})

describe('#threshold tracing', function () {
  let tracer
  let cluster
  let bucket
  let coll
  let collectionDetails

  before(async function () {
    let opts = H.connOpts
    opts.tracingConfig = { enableTracing: true }
    tracer = new ThresholdLoggingTestTracer()
    opts.tracer = tracer
    cluster = await H.lib.Cluster.connect(H.connStr, opts)
    bucket = cluster.bucket(H.bucketName)
    coll = bucket.defaultCollection()
  })

  after(async function () {
    await cluster.close()
  })

  tracingTests(
    () => cluster,
    () => bucket,
    () => coll,
    () => tracer,
    () => collectionDetails
  )
})
