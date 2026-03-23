'use strict'

const assert = require('chai').assert
const H = require('./harness')
const { NoOpTestMeter, TestMeter } = require('./metrics/metertypes')
const { createHttpValidator } = require('./metrics/validators')
const {
  AnalyticsMgmtOp,
  BucketMgmtOp,
  CollectionMgmtOp,
  EventingFunctionMgmtOp,
  QueryIndexMgmtOp,
  SearchIndexMgmtOp,
  UserMgmtOp,
  ViewIndexMgmtOp,
} = require('../lib/observabilitytypes')
const { DesignDocumentNamespace } = require('../lib/viewtypes')
const {
  DesignDocument,
  DesignDocumentView,
} = require('../lib/viewindexmanager')
const { AnalyticsLinkType } = require('../lib/analyticsindexmanager')

function metricsTests(clusterFn, bucketFn, meterFn) {
  describe('#Management Operations', function () {
    let meter
    let cluster
    let bucket
    let validator

    before(async function () {
      cluster = clusterFn()
      bucket = bucketFn()
      meter = meterFn()
      validator = createHttpValidator(meter, H.supportsClusterLabels)
    })

    describe('#Analytics Management Operations', function () {
      this.timeout(30000)
      let amgr

      before(function () {
        H.skipIfMissingFeature(this, H.Features.Analytics)
        amgr = cluster.analyticsIndexes()
      })

      it('should successfully perform analytics index mgmt operations', async function () {
        const dvName = H.genTestKey()
        const dsName = H.genTestKey()
        const idxName = H.genTestKey()

        validator.reset().op(AnalyticsMgmtOp.AnalyticsDataverseCreate)
        await amgr.createDataverse(dvName)
        validator.validate()

        validator
          .reset()
          .op(AnalyticsMgmtOp.AnalyticsDataverseCreate)
          .error(true)
        try {
          await amgr.createDataverse(dvName)
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset().op(AnalyticsMgmtOp.AnalyticsDatasetCreate)
        await amgr.createDataset(H.b.name, dsName, { dataverseName: dvName })
        validator.validate()

        validator.reset().op(AnalyticsMgmtOp.AnalyticsDatasetCreate).error(true)
        try {
          await amgr.createDataset(H.b.name, dsName, { dataverseName: dvName })
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset().op(AnalyticsMgmtOp.AnalyticsDatasetGetAll)
        const datasets = await amgr.getAllDatasets()
        assert.isAtLeast(datasets.length, 1)
        validator.validate()

        validator.reset().op(AnalyticsMgmtOp.AnalyticsIndexCreate)
        await amgr.createIndex(
          dsName,
          idxName,
          { name: 'string' },
          { dataverseName: dvName }
        )
        validator.validate()

        validator.reset().op(AnalyticsMgmtOp.AnalyticsIndexCreate).error(true)
        try {
          await amgr.createIndex(
            dsName,
            idxName,
            { name: 'string' },
            { dataverseName: dvName }
          )
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset().op(AnalyticsMgmtOp.AnalyticsIndexGetAll)
        const indexes = await amgr.getAllIndexes()
        assert.isAtLeast(indexes.length, 1)
        validator.validate()

        validator.reset().op(AnalyticsMgmtOp.AnalyticsIndexDrop)
        await amgr.dropIndex(dsName, idxName, { dataverseName: dvName })
        validator.validate()

        validator.reset().op(AnalyticsMgmtOp.AnalyticsIndexDrop).error(true)
        try {
          await amgr.dropIndex(dsName, idxName, { dataverseName: dvName })
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset().op(AnalyticsMgmtOp.AnalyticsDatasetDrop)
        await amgr.dropDataset(dsName, { dataverseName: dvName })
        validator.validate()

        validator.reset().op(AnalyticsMgmtOp.AnalyticsDatasetDrop).error(true)
        try {
          await amgr.dropDataset(dsName, { dataverseName: dvName })
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset().op(AnalyticsMgmtOp.AnalyticsDataverseDrop)
        await amgr.dropDataverse(dvName)
        validator.validate()

        validator.reset().op(AnalyticsMgmtOp.AnalyticsDataverseDrop).error(true)
        try {
          await amgr.dropDataverse(dvName)
        } catch (_e) {
          // ignore
        }
        validator.validate()
      })

      it('should successfully perform analytics link mgmt operations (S3)', async function () {
        const dvName = H.genTestKey()
        const linkName = H.genTestKey()
        const s3Link = {
          linkType: AnalyticsLinkType.S3External,
          name: linkName,
          dataverse: dvName,
          accessKeyId: 'accesskey',
          region: 'us-east-1',
          secretAccessKey: 'supersecretkey',
        }

        await amgr.createDataverse(dvName)

        validator.reset().op(AnalyticsMgmtOp.AnalyticsLinkCreate)
        await amgr.createLink(s3Link)
        validator.validate()

        validator.reset().op(AnalyticsMgmtOp.AnalyticsLinkCreate).error(true)
        try {
          await amgr.createLink(s3Link)
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset().op(AnalyticsMgmtOp.AnalyticsLinkGetAll)
        const links = await amgr.getAllLinks({
          dataverse: dvName,
          linkType: AnalyticsLinkType.S3External,
        })
        assert.isAtLeast(links.length, 1)
        validator.validate()

        s3Link.region = 'us-west-2'
        validator.reset().op(AnalyticsMgmtOp.AnalyticsLinkReplace)
        await amgr.replaceLink(s3Link)
        validator.validate()

        validator.reset().op(AnalyticsMgmtOp.AnalyticsLinkDrop)
        await amgr.dropLink(linkName, dvName)
        validator.validate()

        validator.reset().op(AnalyticsMgmtOp.AnalyticsLinkDrop).error(true)
        try {
          await amgr.dropLink(linkName, dvName)
        } catch (_e) {
          // ignore
        }
        validator.validate()

        await amgr.dropDataverse(dvName)
      })
    })

    describe('#Bucket Management Operations', function () {
      let testBucket, bmgr

      before(function () {
        H.skipIfMissingFeature(this, H.Features.BucketManagement)
        bmgr = cluster.buckets()
      })

      beforeEach(async function () {
        testBucket = H.genTestKey()
      })

      afterEach(async function () {
        try {
          await bmgr.dropBucket(testBucket)
        } catch (_e) {
          // ignore
        }
      })

      it('should successfully perform bucket mgmt operations', async function () {
        validator.reset().op(BucketMgmtOp.BucketCreate).bucketName(testBucket)
        await bmgr.createBucket({
          name: testBucket,
          flushEnabled: true,
          ramQuotaMB: 256,
        })
        validator.validate()

        await H.consistencyUtils.waitUntilBucketPresent(testBucket)

        validator.reset().op(BucketMgmtOp.BucketGet).bucketName(testBucket)
        let res = await bmgr.getBucket(testBucket)
        assert.isObject(res)
        validator.validate()

        validator.reset().op(BucketMgmtOp.BucketGetAll)
        res = await bmgr.getAllBuckets()
        assert.isArray(res)
        validator.validate()

        validator
          .reset()
          .op(BucketMgmtOp.BucketCreate)
          .bucketName(testBucket)
          .error(true)
        try {
          await bmgr.createBucket({
            name: testBucket,
            flushEnabled: true,
            ramQuotaMB: 256,
          })
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator
          .reset()
          .op(BucketMgmtOp.BucketFlush)
          .bucketName('invalid-bucket')
          .error(true)
        try {
          await bmgr.flushBucket('invalid-bucket')
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset().op(BucketMgmtOp.BucketDrop).bucketName(testBucket)
        await bmgr.dropBucket(testBucket)
        validator.validate()
        await H.consistencyUtils.waitUntilBucketDropped(testBucket)

        validator
          .reset()
          .op(BucketMgmtOp.BucketGet)
          .bucketName(testBucket)
          .error(true)
        try {
          await bmgr.getBucket(testBucket)
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator
          .reset()
          .op(BucketMgmtOp.BucketDrop)
          .bucketName(testBucket)
          .error(true)
        try {
          await bmgr.dropBucket(testBucket)
        } catch (_e) {
          // ignore
        }
        validator.validate()
      }).timeout(10000)
    })

    describe('#Collection Management Operations', function () {
      let testScope, testCollection, cmgr

      before(async function () {
        H.skipIfMissingFeature(this, H.Features.Collections)

        testScope = H.genTestKey()
        testCollection = H.genTestKey()
        cmgr = bucket.collections()
      })

      afterEach(async function () {
        try {
          await cmgr.dropScope(testScope)
        } catch (_e) {
          // ignore
        }
      })

      it('should successfully perform collection mgmt operations', async function () {
        validator
          .reset()
          .op(CollectionMgmtOp.ScopeCreate)
          .bucketName(H.bucketName)
          .scopeName(testScope)
        await cmgr.createScope(testScope)
        validator.validate()
        await H.consistencyUtils.waitUntilScopePresent(H.bucketName, testScope)

        validator
          .reset()
          .op(CollectionMgmtOp.CollectionCreate)
          .bucketName(H.bucketName)
          .scopeName(testScope)
          .collectionName(testCollection)
        await cmgr.createCollection(testCollection, testScope)
        validator.validate()
        await H.consistencyUtils.waitUntilCollectionPresent(
          H.bucketName,
          testScope,
          testCollection
        )

        validator
          .reset()
          .op(CollectionMgmtOp.ScopeGetAll)
          .bucketName(H.bucketName)
        const scopes = await cmgr.getAllScopes()
        const foundScope = scopes.find((v) => v.name === testScope)
        assert.isOk(foundScope)
        const foundColl = foundScope.collections.find(
          (v) => v.name === testCollection
        )
        assert.isOk(foundColl)
        validator.validate()

        validator
          .reset()
          .op(CollectionMgmtOp.ScopeCreate)
          .bucketName(H.bucketName)
          .scopeName(testScope)
          .error(true)
        try {
          await cmgr.createScope(testScope)
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator
          .reset()
          .op(CollectionMgmtOp.CollectionCreate)
          .bucketName(H.bucketName)
          .scopeName(testScope)
          .collectionName(testCollection)
          .error(true)
        try {
          await cmgr.createCollection(testCollection, testScope)
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator
          .reset()
          .op(CollectionMgmtOp.CollectionDrop)
          .bucketName(H.bucketName)
          .scopeName(testScope)
          .collectionName(testCollection)
        await cmgr.dropCollection(testCollection, testScope)
        validator.validate()
        await H.consistencyUtils.waitUntilCollectionDropped(
          H.bucketName,
          testScope,
          testCollection
        )

        validator
          .reset()
          .op(CollectionMgmtOp.ScopeDrop)
          .bucketName(H.bucketName)
          .scopeName(testScope)
        await cmgr.dropScope(testScope)
        validator.validate()
        await H.consistencyUtils.waitUntilScopeDropped(H.bucketName, testScope)

        validator
          .reset()
          .op(CollectionMgmtOp.CollectionDrop)
          .bucketName(H.bucketName)
          .scopeName(testScope)
          .collectionName(testCollection)
          .error(true)
        try {
          await cmgr.dropCollection(testCollection, testScope)
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator
          .reset()
          .op(CollectionMgmtOp.ScopeDrop)
          .bucketName(H.bucketName)
          .scopeName(testScope)
          .error(true)
        try {
          await cmgr.dropScope(testScope)
        } catch (_e) {
          // ignore
        }
        validator.validate()
      })
    })

    describe('#Eventing Function Management Operations', function () {
      this.timeout(30000)
      this.retries(3)

      let cmgr, emgr, testScope, fnName, _fnDef
      const sourceCollectionName = 'source'
      const metadataCollectionName = 'meta'

      before(function () {
        H.skipIfMissingFeature(this, H.Features.Collections)
        H.skipIfMissingFeature(this, H.Features.Eventing)
        cmgr = bucket.collections()
        emgr = cluster.eventingFunctions()
      })

      beforeEach(async function () {
        testScope = H.genTestKey()
        await cmgr.createScope(testScope)
        await H.consistencyUtils.waitUntilScopePresent(H.bucketName, testScope)

        await cmgr.createCollection(sourceCollectionName, testScope)
        await H.consistencyUtils.waitUntilCollectionPresent(
          H.bucketName,
          testScope,
          sourceCollectionName
        )

        await cmgr.createCollection(metadataCollectionName, testScope)
        await H.consistencyUtils.waitUntilCollectionPresent(
          H.bucketName,
          testScope,
          metadataCollectionName
        )

        fnName = H.genTestKey()
        _fnDef = {
          name: fnName,
          code: `function OnUpdate(doc, meta) { log('data:', doc, meta) }`,
          bucketBindings: [],
          urlBindings: [],
          constantBindings: [],
          metadataKeyspace: new H.lib.EventingFunctionKeyspace({
            bucket: H.bucketName,
            scope: testScope,
            collection: metadataCollectionName,
          }),
          sourceKeyspace: new H.lib.EventingFunctionKeyspace({
            bucket: H.b.name,
            scope: testScope,
            collection: sourceCollectionName,
          }),
        }
      })

      this.afterEach(async function () {
        try {
          await cmgr.dropScope(testScope)
          await H.consistencyUtils.waitUntilScopeDropped(
            H.bucketName,
            testScope
          )
        } catch (_e) {
          // ignore
        }
      })

      // What I want to do is below, but EVT mgmt is soooooo flaky it is problematic for CI, especially when something
      // goes wrong, it is painful to cleanup and then it can impact other tests.
      // Running tests locally indicates that the operations themselves have the appropriate tracing hooks.
      it('should successfully perform eventing function mgmt operations', async function () {
        validator.reset().op(EventingFunctionMgmtOp.EventingGetAllFunctions)
        const fns = await emgr.getAllFunctions()
        assert.isArray(fns)
        validator.validate()
      })
    })

    describe('#Query Index Management Operations', function () {
      this.timeout(60000)
      let idxName, pIdxName, qmgr, indexes, testBucket

      before(async function () {
        H.skipIfMissingFeature(this, H.Features.Query)

        testBucket = H.b.name
        idxName = H.genTestKey()
        pIdxName = `${idxName}-primary`
        indexes = [idxName, pIdxName]
        qmgr = cluster.queryIndexes()
      })

      afterEach(async function () {
        for (const idx of indexes) {
          try {
            await qmgr.dropIndex(testBucket, idx, { ignoreIfNotExists: true })
          } catch (_e) {
            // ignore
          }
        }
      })

      it('should successfully perform query index mgmt operations', async function () {
        validator.reset().op(QueryIndexMgmtOp.QueryIndexCreate)
        // depending on how tests are ordered, we may already have an index here, so we ignore failure and
        // just validate the span
        try {
          await qmgr.createPrimaryIndex(testBucket, {
            name: pIdxName,
          })
        } catch (_e) {
          validator.error(true)
        }
        validator.validate()

        validator.reset().op(QueryIndexMgmtOp.QueryIndexCreate)
        await qmgr.createIndex(testBucket, idxName, ['name'])
        validator.validate()

        validator.reset().op(QueryIndexMgmtOp.QueryIndexCreate).error(true)
        try {
          await qmgr.createPrimaryIndex(testBucket, {
            name: pIdxName,
          })
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset().op(QueryIndexMgmtOp.QueryIndexCreate).error(true)
        try {
          await qmgr.createIndex(testBucket, idxName, ['name'])
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset().op(QueryIndexMgmtOp.QueryIndexGetAll)
        let idxs = await qmgr.getAllIndexes(testBucket)
        assert.isAtLeast(idxs.length, 1)
        validator.validate()

        const deferredIndexes = []
        for (let i = 0; i < 3; i++) {
          idxName = H.genTestKey()
          deferredIndexes.push(idxName)
          await qmgr.createIndex(testBucket, idxName, ['name'], {
            deferred: true,
          })
          indexes.push(idxName)
        }
        idxs = await qmgr.getAllIndexes(testBucket)
        const filteredIdexes = idxs.filter((idx) => idx.state === 'deferred')

        // this is a deeply nested call that is complicated to validate
        await qmgr.buildDeferredIndexes(testBucket)

        validator
          .reset()
          .op(QueryIndexMgmtOp.QueryIndexWatchIndexes)
          .nestedOps([QueryIndexMgmtOp.QueryIndexGetAll])
        await qmgr.watchIndexes(
          testBucket,
          filteredIdexes.map((fIdx) => fIdx.name),
          6000
        )
        validator.validate()
      })
    })

    describe('#Search Index Management Operations', function () {
      this.timeout(30000)
      let smgr, idxName, sIdx

      before(function () {
        H.skipIfMissingFeature(this, H.Features.Search)
        smgr = cluster.searchIndexes()
      })

      beforeEach(function () {
        // ensure no indexes are present before each test
        idxName = `sIdx-${H.genTestKey()}`
        sIdx = {
          name: idxName,
          sourceName: H.b.name,
          sourceType: 'couchbase',
          type: 'fulltext-index',
          params: {},
          sourceUuid: '',
          sourceParams: {},
          planParams: {},
        }
      })

      afterEach(async function () {
        try {
          await smgr.dropIndex(idxName)
        } catch (_e) {
          // ignore
        }
      })

      it('should successfully perform search index mgmt operations', async function () {
        validator.reset().op(SearchIndexMgmtOp.SearchIndexUpsert)
        await smgr.upsertIndex(sIdx)
        validator.validate()

        validator.reset().op(SearchIndexMgmtOp.SearchIndexGet)
        const idx = await smgr.getIndex(idxName)
        assert.isObject(idx)
        validator.validate()

        validator.reset().op(SearchIndexMgmtOp.SearchIndexGetAll)
        const idxs = await smgr.getAllIndexes()
        assert.isArray(idxs)
        validator.validate()

        validator.reset().op(SearchIndexMgmtOp.SearchIndexDrop)
        await smgr.dropIndex(idxName)
        validator.validate()

        validator.reset().op(SearchIndexMgmtOp.SearchIndexGet).error(true)
        try {
          await smgr.getIndex(idxName)
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset().op(SearchIndexMgmtOp.SearchIndexDrop).error(true)
        try {
          await smgr.dropIndex(idxName)
        } catch (_e) {
          // ignore
        }
        validator.validate()
      })
    })

    describe('#User Management Operations', function () {
      this.timeout(30000)
      let umgr, username

      before(function () {
        H.skipIfMissingFeature(this, H.Features.UserManagement)
        umgr = cluster.users()
        username = `${H.genTestKey()}-user`
      })

      afterEach(async function () {
        try {
          await umgr.dropUser(username)
        } catch (_e) {
          // ignore
        }
      })

      it('should successfully perform user mgmt operations', async function () {
        const user = {
          username: username,
          password: 's3cret!',
          roles: [{ name: 'ro_admin' }],
        }

        validator.reset().op(UserMgmtOp.UserUpsert)
        await umgr.upsertUser(user)
        validator.validate()

        await H.consistencyUtils.waitUntilUserPresent(username)

        validator.reset().op(UserMgmtOp.UserGet)
        const fetchedUser = await umgr.getUser(username)
        assert.equal(fetchedUser.username, username)
        validator.validate()

        validator.reset().op(UserMgmtOp.UserGetAll)
        const allUsers = await umgr.getAllUsers()
        assert.isAtLeast(allUsers.length, 1)
        validator.validate()

        validator.reset().op(UserMgmtOp.RoleGetAll)
        const roles = await umgr.getRoles()
        assert.isAtLeast(roles.length, 1)
        validator.validate()

        validator.reset().op(UserMgmtOp.UserDrop)
        await umgr.dropUser(username)
        validator.validate()

        await H.consistencyUtils.waitUntilUserDropped(username)

        validator.reset().op(UserMgmtOp.UserGet).error(true)
        try {
          await umgr.getUser(username)
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset().op(UserMgmtOp.UserDrop).error(true)
        try {
          await umgr.dropUser(username)
        } catch (_e) {
          // ignore
        }
        validator.validate()
      })
    })

    describe('#View Index Management Operations', function () {
      this.timeout(30000)
      let vmgr, ddocName, ddocKey, ddoc

      before(function () {
        H.skipIfMissingFeature(this, H.Features.Views)
        vmgr = bucket.viewIndexes()
      })

      beforeEach(function () {
        ddocName = H.genTestKey()
        ddocKey = `dev_${ddocName}`
        ddoc = new DesignDocument({
          name: ddocKey,
          views: {
            testView: new DesignDocumentView({
              map: `function(doc, meta) { if (doc.testUid) { emit(meta.id, null); } }`,
            }),
          },
        })
      })

      afterEach(async function () {
        try {
          await vmgr.dropDesignDocument(
            ddocKey,
            DesignDocumentNamespace.Development
          )
        } catch (_e) {
          // ignore
        }
      })

      it('should successfully perform view index mgmt operations', async function () {
        validator.reset().op(ViewIndexMgmtOp.ViewIndexUpsert)
        await vmgr.upsertDesignDocument(ddoc)
        validator.validate()

        await H.consistencyUtils.waitUntilDesignDocumentPresent(
          H.bucketName,
          ddocKey
        )

        validator.reset().op(ViewIndexMgmtOp.ViewIndexGet)
        const fetchedDdoc = await vmgr.getDesignDocument(
          ddocKey,
          DesignDocumentNamespace.Development
        )
        assert.equal(fetchedDdoc.name, ddocName)
        validator.validate()

        validator.reset().op(ViewIndexMgmtOp.ViewIndexGetAll)
        const allDdocs = await vmgr.getAllDesignDocuments(
          DesignDocumentNamespace.Development
        )
        assert.isAtLeast(allDdocs.length, 1)
        validator.validate()

        validator.reset().op(ViewIndexMgmtOp.ViewIndexDrop)
        await vmgr.dropDesignDocument(
          ddocKey,
          DesignDocumentNamespace.Development
        )
        validator.validate()

        await H.consistencyUtils.waitUntilDesignDocumentDropped(
          H.bucketName,
          ddocKey
        )

        validator.reset().op(ViewIndexMgmtOp.ViewIndexGet).error(true)
        try {
          await vmgr.getDesignDocument(
            ddocKey,
            DesignDocumentNamespace.Development
          )
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset().op(ViewIndexMgmtOp.ViewIndexDrop).error(true)
        try {
          await vmgr.dropDesignDocument(
            ddocKey,
            DesignDocumentNamespace.Development
          )
        } catch (_e) {
          // ignore
        }
        validator.validate()
      }).timeout(30000)
    })
  })
}

describe('#basic metrics', function () {
  let meter
  let cluster
  let bucket

  before(async function () {
    let opts = H.connOpts
    opts.metricsConfig = { enableMetrics: true }
    meter = new TestMeter()
    opts.meter = meter
    cluster = await H.lib.Cluster.connect(H.connStr, opts)
    bucket = cluster.bucket(H.bucketName)
  })

  after(async function () {
    await cluster.close()
  })

  metricsTests(
    () => cluster,
    () => bucket,
    () => meter
  )
})

describe('#no-op metrics', function () {
  let meter
  let cluster
  let bucket

  before(async function () {
    let opts = H.connOpts
    opts.metricsConfig = { enableMetrics: true }
    meter = new NoOpTestMeter()
    opts.meter = meter
    cluster = await H.lib.Cluster.connect(H.connStr, opts)
    bucket = cluster.bucket(H.bucketName)
  })

  after(async function () {
    await cluster.close()
  })

  metricsTests(
    () => cluster,
    () => bucket,
    () => meter
  )
})
