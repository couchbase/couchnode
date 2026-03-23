'use strict'

const assert = require('chai').assert
const H = require('./harness')
const {
  NoOpTestTracer,
  TestTracer,
  ThresholdLoggingTestTracer,
} = require('./tracing/tracingtypes')
const { createHttpValidator } = require('./tracing/validators')
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

function tracingTests(clusterFn, bucketFn, tracerFn) {
  describe('#Management Operations', function () {
    let tracer
    let cluster
    let bucket
    let validator

    before(async function () {
      cluster = clusterFn()
      bucket = bucketFn()
      tracer = tracerFn()
      validator = createHttpValidator(tracer, null, H.supportsClusterLabels)
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

      it('should successfully perform analytics index mgmt operations w/ parent span', async function () {
        const dvName = H.genTestKey()
        const dsName = H.genTestKey()
        const idxName = H.genTestKey()

        validator.reset()
        let parentSpan = tracer.requestSpan(
          `${AnalyticsMgmtOp.AnalyticsDataverseCreate}-parent-span`
        )
        validator
          .op(AnalyticsMgmtOp.AnalyticsDataverseCreate)
          .parent(parentSpan)
        await amgr.createDataverse(dvName, { parentSpan: parentSpan })
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${AnalyticsMgmtOp.AnalyticsDatasetCreate}-parent-span`
        )
        validator.op(AnalyticsMgmtOp.AnalyticsDatasetCreate).parent(parentSpan)
        await amgr.createDataset(H.b.name, dsName, {
          dataverseName: dvName,
          parentSpan: parentSpan,
        })
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${AnalyticsMgmtOp.AnalyticsDatasetGetAll}-parent-span`
        )
        validator.op(AnalyticsMgmtOp.AnalyticsDatasetGetAll).parent(parentSpan)
        const datasets = await amgr.getAllDatasets({ parentSpan: parentSpan })
        assert.isAtLeast(datasets.length, 1)
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${AnalyticsMgmtOp.AnalyticsIndexCreate}-parent-span`
        )
        validator.op(AnalyticsMgmtOp.AnalyticsIndexCreate).parent(parentSpan)
        await amgr.createIndex(
          dsName,
          idxName,
          { name: 'string' },
          { dataverseName: dvName, parentSpan: parentSpan }
        )
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${AnalyticsMgmtOp.AnalyticsIndexGetAll}-parent-span`
        )
        validator.op(AnalyticsMgmtOp.AnalyticsIndexGetAll).parent(parentSpan)
        const indexes = await amgr.getAllIndexes({ parentSpan: parentSpan })
        assert.isAtLeast(indexes.length, 1)
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${AnalyticsMgmtOp.AnalyticsIndexDrop}-parent-span`
        )
        validator.op(AnalyticsMgmtOp.AnalyticsIndexDrop).parent(parentSpan)
        await amgr.dropIndex(dsName, idxName, {
          dataverseName: dvName,
          parentSpan: parentSpan,
        })
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${AnalyticsMgmtOp.AnalyticsDatasetDrop}-parent-span`
        )
        validator.op(AnalyticsMgmtOp.AnalyticsDatasetDrop).parent(parentSpan)
        await amgr.dropDataset(dsName, {
          dataverseName: dvName,
          parentSpan: parentSpan,
        })
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${AnalyticsMgmtOp.AnalyticsDataverseDrop}-parent-span`
        )
        validator.op(AnalyticsMgmtOp.AnalyticsDataverseDrop).parent(parentSpan)
        await amgr.dropDataverse(dvName, { parentSpan: parentSpan })
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

      it('should successfully perform analytics link mgmt operations (S3) w/ parent span', async function () {
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

        validator.reset()
        let parentSpan = tracer.requestSpan(
          `${AnalyticsMgmtOp.AnalyticsLinkCreate}-parent-span`
        )
        validator.op(AnalyticsMgmtOp.AnalyticsLinkCreate).parent(parentSpan)
        await amgr.createLink(s3Link, { parentSpan: parentSpan })
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${AnalyticsMgmtOp.AnalyticsLinkGetAll}-parent-span`
        )
        validator.op(AnalyticsMgmtOp.AnalyticsLinkGetAll).parent(parentSpan)
        const links = await amgr.getAllLinks({
          dataverse: dvName,
          linkType: AnalyticsLinkType.S3External,
          parentSpan: parentSpan,
        })
        assert.isAtLeast(links.length, 1)
        validator.validate()

        s3Link.region = 'us-west-2'
        validator.reset()
        parentSpan = tracer.requestSpan(
          `${AnalyticsMgmtOp.AnalyticsLinkReplace}-parent-span`
        )
        validator.op(AnalyticsMgmtOp.AnalyticsLinkReplace).parent(parentSpan)
        await amgr.replaceLink(s3Link, { parentSpan: parentSpan })
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${AnalyticsMgmtOp.AnalyticsLinkDrop}-parent-span`
        )
        validator.op(AnalyticsMgmtOp.AnalyticsLinkDrop).parent(parentSpan)
        await amgr.dropLink(linkName, dvName, { parentSpan: parentSpan })
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

      it('should successfully perform bucket mgmt operations w/ parent span', async function () {
        validator.reset()
        let parentSpan = tracer.requestSpan(
          `${BucketMgmtOp.BucketCreate}-parent-span`
        )
        validator.op(BucketMgmtOp.BucketCreate).parent(parentSpan)
        await bmgr.createBucket(
          {
            name: testBucket,
            flushEnabled: true,
            ramQuotaMB: 256,
          },
          { parentSpan: parentSpan }
        )
        validator.validate()

        await H.consistencyUtils.waitUntilBucketPresent(testBucket)

        validator.reset()
        parentSpan = tracer.requestSpan(`${BucketMgmtOp.BucketGet}-parent-span`)
        validator.op(BucketMgmtOp.BucketGet).parent(parentSpan)
        let res = await bmgr.getBucket(testBucket, { parentSpan: parentSpan })
        assert.isObject(res)
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${BucketMgmtOp.BucketGetAll}-parent-span`
        )
        validator.op(BucketMgmtOp.BucketGetAll).parent(parentSpan)
        res = await bmgr.getAllBuckets({ parentSpan: parentSpan })
        assert.isArray(res)
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${BucketMgmtOp.BucketCreate}-parent-span`
        )
        validator.op(BucketMgmtOp.BucketCreate).parent(parentSpan).error(true)
        try {
          await bmgr.createBucket(
            {
              name: testBucket,
              flushEnabled: true,
              ramQuotaMB: 256,
            },
            { parentSpan: parentSpan }
          )
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${BucketMgmtOp.BucketFlush}-parent-span`
        )
        validator.op(BucketMgmtOp.BucketFlush).parent(parentSpan).error(true)
        try {
          await bmgr.flushBucket('invalid-bucket', { parentSpan: parentSpan })
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${BucketMgmtOp.BucketDrop}-parent-span`
        )
        validator.op(BucketMgmtOp.BucketDrop).parent(parentSpan)
        await bmgr.dropBucket(testBucket, { parentSpan: parentSpan })
        validator.validate()
        await H.consistencyUtils.waitUntilBucketDropped(testBucket)

        validator.reset()
        parentSpan = tracer.requestSpan(`${BucketMgmtOp.BucketGet}-parent-span`)
        validator.op(BucketMgmtOp.BucketGet).parent(parentSpan).error(true)
        try {
          await bmgr.getBucket(testBucket, { parentSpan: parentSpan })
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${BucketMgmtOp.BucketDrop}-parent-span`
        )
        validator.op(BucketMgmtOp.BucketDrop).parent(parentSpan)
        try {
          await bmgr.dropBucket(testBucket, { parentSpan: parentSpan })
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

      it('should successfully perform collection mgmt operations w/ parent', async function () {
        validator.reset()
        let parentSpan = tracer.requestSpan(
          `${CollectionMgmtOp.ScopeCreate}-parent-span`
        )
        validator.op(CollectionMgmtOp.ScopeCreate).parent(parentSpan)
        await cmgr.createScope(testScope, { parentSpan: parentSpan })
        validator.validate()
        await H.consistencyUtils.waitUntilScopePresent(H.bucketName, testScope)

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${CollectionMgmtOp.CollectionCreate}-parent-span`
        )
        validator.op(CollectionMgmtOp.CollectionCreate).parent(parentSpan)
        await cmgr.createCollection(testCollection, testScope, {
          parentSpan: parentSpan,
        })
        validator.validate()
        await H.consistencyUtils.waitUntilCollectionPresent(
          H.bucketName,
          testScope,
          testCollection
        )

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${CollectionMgmtOp.ScopeGetAll}-parent-span`
        )
        validator.op(CollectionMgmtOp.ScopeGetAll).parent(parentSpan)
        const scopes = await cmgr.getAllScopes({ parentSpan: parentSpan })
        const foundScope = scopes.find((v) => v.name === testScope)
        assert.isOk(foundScope)
        const foundColl = foundScope.collections.find(
          (v) => v.name === testCollection
        )
        assert.isOk(foundColl)
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${CollectionMgmtOp.ScopeCreate}-parent-span`
        )
        validator
          .op(CollectionMgmtOp.ScopeCreate)
          .parent(parentSpan)
          .error(true)
        try {
          await cmgr.createScope(testScope, { parentSpan: parentSpan })
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${CollectionMgmtOp.CollectionCreate}-parent-span`
        )
        validator
          .op(CollectionMgmtOp.CollectionCreate)
          .parent(parentSpan)
          .error(true)
        try {
          await cmgr.createCollection(testCollection, testScope, {
            parentSpan: parentSpan,
          })
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${CollectionMgmtOp.CollectionDrop}-parent-span`
        )
        validator.op(CollectionMgmtOp.CollectionDrop).parent(parentSpan)
        await cmgr.dropCollection(testCollection, testScope, {
          parentSpan: parentSpan,
        })
        validator.validate()
        await H.consistencyUtils.waitUntilCollectionDropped(
          H.bucketName,
          testScope,
          testCollection
        )

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${CollectionMgmtOp.ScopeDrop}-parent-span`
        )
        validator.op(CollectionMgmtOp.ScopeDrop).parent(parentSpan)
        await cmgr.dropScope(testScope, { parentSpan: parentSpan })
        validator.validate()
        await H.consistencyUtils.waitUntilScopeDropped(H.bucketName, testScope)

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${CollectionMgmtOp.CollectionDrop}-parent-span`
        )
        validator
          .op(CollectionMgmtOp.CollectionDrop)
          .parent(parentSpan)
          .error(true)
        try {
          await cmgr.dropCollection(testCollection, testScope, {
            parentSpan: parentSpan,
          })
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${CollectionMgmtOp.ScopeDrop}-parent-span`
        )
        validator.op(CollectionMgmtOp.ScopeDrop).parent(parentSpan).error(true)
        try {
          await cmgr.dropScope(testScope, { parentSpan: parentSpan })
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

      // Only doing minimal testing for eventing function mgmt.  See JSCBC-1390 for details
      it('should successfully perform eventing function mgmt operations', async function () {
        validator.reset().op(EventingFunctionMgmtOp.EventingGetAllFunctions)
        const fns = await emgr.getAllFunctions()
        assert.isArray(fns)
        validator.validate()
      })

      it('should successfully perform eventing function mgmt operations w/ parent span', async function () {
        validator.reset()
        let parentSpan = tracer.requestSpan(
          `${EventingFunctionMgmtOp.EventingGetAllFunctions}-parent-span`
        )
        validator
          .op(EventingFunctionMgmtOp.EventingGetAllFunctions)
          .parent(parentSpan)
        const fns = await emgr.getAllFunctions({ parentSpan: parentSpan })
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

      it('should successfully perform query index mgmt operations w/ parent', async function () {
        validator.reset()
        let parentSpan = tracer.requestSpan(
          `${QueryIndexMgmtOp.QueryIndexCreate}-parent-span`
        )
        validator.op(QueryIndexMgmtOp.QueryIndexCreate).parent(parentSpan)

        // depending on how tests are ordered, we may already have an index here, so we ignore failure and
        // just validate the span
        try {
          await qmgr.createPrimaryIndex(testBucket, {
            name: pIdxName,
            parentSpan: parentSpan,
          })
        } catch (_e) {
          validator.error(true)
        }
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${QueryIndexMgmtOp.QueryIndexCreate}-parent-span`
        )
        validator.op(QueryIndexMgmtOp.QueryIndexCreate).parent(parentSpan)
        await qmgr.createIndex(testBucket, idxName, ['name'], {
          parentSpan: parentSpan,
        })
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${QueryIndexMgmtOp.QueryIndexCreate}-parent-span`
        )
        validator
          .op(QueryIndexMgmtOp.QueryIndexCreate)
          .parent(parentSpan)
          .error(true)
        try {
          await qmgr.createPrimaryIndex(testBucket, {
            name: pIdxName,
            parentSpan: parentSpan,
          })
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${QueryIndexMgmtOp.QueryIndexCreate}-parent-span`
        )
        validator
          .op(QueryIndexMgmtOp.QueryIndexCreate)
          .parent(parentSpan)
          .error(true)
        try {
          await qmgr.createIndex(testBucket, idxName, ['name'], {
            parentSpan: parentSpan,
          })
        } catch (_e) {
          // ignore
        }
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${QueryIndexMgmtOp.QueryIndexGetAll}-parent-span`
        )
        validator.op(QueryIndexMgmtOp.QueryIndexGetAll).parent(parentSpan)
        let idxs = await qmgr.getAllIndexes(testBucket, {
          parentSpan: parentSpan,
        })
        assert.isAtLeast(idxs.length, 1)
        validator.validate()

        const deferredIndexes = []
        for (let i = 0; i < 3; i++) {
          idxName = H.genTestKey()
          deferredIndexes.push(idxName)
          await qmgr.createIndex(testBucket, idxName, ['name'], {
            deferred: true,
          })
        }
        idxs = await qmgr.getAllIndexes(testBucket)
        const filteredIdexes = idxs.filter((idx) => idx.state === 'deferred')

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${QueryIndexMgmtOp.QueryIndexGetAll}-parent-span`
        )
        validator.op(QueryIndexMgmtOp.QueryIndexGetAll).parent(parentSpan)
        // this is a deeply nested call that is complicated to validate, but do pass in a parent span
        await qmgr.buildDeferredIndexes(testBucket, { parentSpan: parentSpan })

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${QueryIndexMgmtOp.QueryIndexWatchIndexes}-parent-span`
        )
        validator
          .op(QueryIndexMgmtOp.QueryIndexWatchIndexes)
          .parent(parentSpan)
          .nestedOps([QueryIndexMgmtOp.QueryIndexGetAll])
        await qmgr.watchIndexes(
          testBucket,
          filteredIdexes.map((fIdx) => fIdx.name),
          6000,
          {
            parentSpan: parentSpan,
          }
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

      it('should successfully perform search index mgmt operations w/ parent span', async function () {
        validator.reset()
        let parentSpan = tracer.requestSpan(
          `${SearchIndexMgmtOp.SearchIndexUpsert}-parent-span`
        )
        validator.op(SearchIndexMgmtOp.SearchIndexUpsert).parent(parentSpan)
        await smgr.upsertIndex(sIdx, { parentSpan: parentSpan })
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${SearchIndexMgmtOp.SearchIndexGet}-parent-span`
        )
        validator.op(SearchIndexMgmtOp.SearchIndexGet).parent(parentSpan)
        const idx = await smgr.getIndex(idxName, { parentSpan: parentSpan })
        assert.isObject(idx)
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${SearchIndexMgmtOp.SearchIndexGetAll}-parent-span`
        )
        validator.op(SearchIndexMgmtOp.SearchIndexGetAll).parent(parentSpan)
        const idxs = await smgr.getAllIndexes({ parentSpan: parentSpan })
        assert.isArray(idxs)
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${SearchIndexMgmtOp.SearchIndexDrop}-parent-span`
        )
        validator.op(SearchIndexMgmtOp.SearchIndexDrop).parent(parentSpan)
        await smgr.dropIndex(idxName, { parentSpan: parentSpan })
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${SearchIndexMgmtOp.SearchIndexGet}-parent-span`
        )
        validator
          .op(SearchIndexMgmtOp.SearchIndexGet)
          .parent(parentSpan)
          .error(true)
        try {
          await smgr.getIndex(idxName, { parentSpan: parentSpan })
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

      it('should successfully perform user mgmt operations w/ parent span', async function () {
        const user = {
          username: username,
          password: 's3cret!',
          roles: [{ name: 'ro_admin' }],
        }

        validator.reset()
        let parentSpan = tracer.requestSpan(
          `${UserMgmtOp.UserUpsert}-parent-span`
        )
        validator.op(UserMgmtOp.UserUpsert).parent(parentSpan)
        await umgr.upsertUser(user, { parentSpan: parentSpan })
        validator.validate()

        await H.consistencyUtils.waitUntilUserPresent(username)

        validator.reset()
        parentSpan = tracer.requestSpan(`${UserMgmtOp.UserGet}-parent-span`)
        validator.op(UserMgmtOp.UserGet).parent(parentSpan)
        const fetchedUser = await umgr.getUser(username, {
          parentSpan: parentSpan,
        })
        assert.equal(fetchedUser.username, username)
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(`${UserMgmtOp.UserGetAll}-parent-span`)
        validator.op(UserMgmtOp.UserGetAll).parent(parentSpan)
        const allUsers = await umgr.getAllUsers({ parentSpan: parentSpan })
        assert.isAtLeast(allUsers.length, 1)
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(`${UserMgmtOp.RoleGetAll}-parent-span`)
        validator.op(UserMgmtOp.RoleGetAll).parent(parentSpan)
        const roles = await umgr.getRoles({ parentSpan: parentSpan })
        assert.isAtLeast(roles.length, 1)
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(`${UserMgmtOp.UserDrop}-parent-span`)
        validator.op(UserMgmtOp.UserDrop).parent(parentSpan)
        await umgr.dropUser(username, { parentSpan: parentSpan })
        validator.validate()

        await H.consistencyUtils.waitUntilUserDropped(username)

        validator.reset()
        parentSpan = tracer.requestSpan(`${UserMgmtOp.UserGet}-parent-span`)
        validator.op(UserMgmtOp.UserGet).parent(parentSpan).error(true)
        try {
          await umgr.getUser(username, { parentSpan: parentSpan })
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

      it('should successfully perform view index mgmt operations w/ parent span', async function () {
        validator.reset()
        let parentSpan = tracer.requestSpan(
          `${ViewIndexMgmtOp.ViewIndexUpsert}-parent-span`
        )
        validator.op(ViewIndexMgmtOp.ViewIndexUpsert).parent(parentSpan)
        await vmgr.upsertDesignDocument(ddoc, { parentSpan: parentSpan })
        validator.validate()

        await H.consistencyUtils.waitUntilDesignDocumentPresent(
          H.bucketName,
          ddocKey
        )

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${ViewIndexMgmtOp.ViewIndexGet}-parent-span`
        )
        validator.op(ViewIndexMgmtOp.ViewIndexGet).parent(parentSpan)
        const fetchedDdoc = await vmgr.getDesignDocument(
          ddocKey,
          DesignDocumentNamespace.Development,
          { parentSpan: parentSpan }
        )
        assert.equal(fetchedDdoc.name, ddocName)
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${ViewIndexMgmtOp.ViewIndexGetAll}-parent-span`
        )
        validator.op(ViewIndexMgmtOp.ViewIndexGetAll).parent(parentSpan)
        const allDdocs = await vmgr.getAllDesignDocuments(
          DesignDocumentNamespace.Development,
          { parentSpan: parentSpan }
        )
        assert.isAtLeast(allDdocs.length, 1)
        validator.validate()

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${ViewIndexMgmtOp.ViewIndexDrop}-parent-span`
        )
        validator.op(ViewIndexMgmtOp.ViewIndexDrop).parent(parentSpan)
        await vmgr.dropDesignDocument(
          ddocKey,
          DesignDocumentNamespace.Development,
          { parentSpan: parentSpan }
        )
        validator.validate()

        await H.consistencyUtils.waitUntilDesignDocumentDropped(
          H.bucketName,
          ddocKey
        )

        validator.reset()
        parentSpan = tracer.requestSpan(
          `${ViewIndexMgmtOp.ViewIndexGet}-parent-span`
        )
        validator
          .op(ViewIndexMgmtOp.ViewIndexGet)
          .parent(parentSpan)
          .error(true)
        try {
          await vmgr.getDesignDocument(
            ddocKey,
            DesignDocumentNamespace.Development,
            { parentSpan: parentSpan }
          )
        } catch (_e) {
          // ignore
        }
        validator.validate()
      }).timeout(30000)
    })
  })
}

describe('#basic tracing', function () {
  let tracer
  let cluster
  let bucket

  before(async function () {
    let opts = H.connOpts
    opts.tracingConfig = { enableTracing: true }
    tracer = new TestTracer()
    opts.tracer = tracer
    cluster = await H.lib.Cluster.connect(H.connStr, opts)
    bucket = cluster.bucket(H.bucketName)
  })

  after(async function () {
    await cluster.close()
  })

  tracingTests(
    () => cluster,
    () => bucket,
    () => tracer
  )
})

describe('#no-op tracing', function () {
  let tracer
  let cluster
  let bucket

  before(async function () {
    let opts = H.connOpts
    opts.tracingConfig = { enableTracing: true }
    tracer = new NoOpTestTracer()
    opts.tracer = tracer
    cluster = await H.lib.Cluster.connect(H.connStr, opts)
    bucket = cluster.bucket(H.bucketName)
  })

  after(async function () {
    await cluster.close()
  })

  tracingTests(
    () => cluster,
    () => bucket,
    () => tracer
  )
})

describe('#threshold tracing', function () {
  let tracer
  let cluster
  let bucket

  before(async function () {
    let opts = H.connOpts
    opts.tracingConfig = { enableTracing: true }
    tracer = new ThresholdLoggingTestTracer()
    opts.tracer = tracer
    cluster = await H.lib.Cluster.connect(H.connStr, opts)
    bucket = cluster.bucket(H.bucketName)
  })

  after(async function () {
    await cluster.close()
  })

  tracingTests(
    () => cluster,
    () => bucket,
    () => tracer
  )
})
