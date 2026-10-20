import { describe, expect } from 'vitest'

import type { Bucket } from '../../../lib/bucket'
import type { Cluster } from '../../../lib/cluster'
import { AnalyticsLinkType } from '../../../lib/analyticsindexmanager'
import {
  BucketNotFoundError,
  CouchbaseError,
  DataverseNotFoundError,
  DesignDocumentNotFoundError,
  IndexNotFoundError,
  ScopeNotFoundError,
  UserNotFoundError,
} from '../../../lib/errors'
import {
  AnalyticsMgmtOp,
  BucketMgmtOp,
  CollectionMgmtOp,
  EventingFunctionMgmtOp,
  QueryIndexMgmtOp,
  SearchIndexMgmtOp,
  UserMgmtOp,
  ViewIndexMgmtOp,
} from '../../../lib/observabilitytypes'
import {
  DesignDocument,
  DesignDocumentView,
} from '../../../lib/viewindexmanager'
import { DesignDocumentNamespace } from '../../../lib/viewtypes'
import { expectThrows } from '../../asserts/errors'
import { ServerFeature } from '../../infra/capabilities'
import { TestEnv } from '../../infra/env'
import { CollectionStrategy } from '../../infra/requirements'
import { defineSuite } from '../../infra/suite'
import {
  METER_KINDS,
  MeterKind,
  MeteredTarget,
  meteredCollection,
  meteredTarget,
} from '../../observability/metrics/target'
import {
  MetricsValidator,
  createHttpValidator,
} from '../../observability/metrics/validators'
import {
  DEFERRED_INDEX_COUNT,
  MISSING_BUCKET,
  QUERY_INDEX_TIMEOUT_MS,
  RAM_QUOTA_MB,
  SEARCH_LIFECYCLE_TIMEOUT_MS,
  USER_PASSWORD,
  VIEW_MAP,
  WATCH_TIMEOUT_MS,
  dropOnTeardown,
  keyspaceOf,
  s3Link,
  searchIndexDefinition,
  waitForSearchIndex,
  waitUntilQueryable,
} from '../../observability/mgmtfixtures'

// `*.exclusive.test.ts` because the bucket-management test creates and drops a
// bucket, and flushes `invalid-bucket` to record a failing flush. That flush
// destroys nothing, but the static check reads the call, not the argument.
//
// Every resource is registered for teardown the moment it is created.
//
// Eventing function management is too slow and flaky to drive here, so the
// eventing test is a listing call, which needs no keyspace.
//
// The query index test works in a leased collection: on the shared bucket,
// `cluster.queryIndexes().buildDeferredIndexes` builds everything deferred and
// collides with other suites' index creation (`Build Already In Progress`). A
// leased bucket would isolate it too, but bucket creation and deletion are
// serialized cluster-wide.

interface MetricsTarget {
  readonly cluster: Cluster
  readonly bucket: Bucket
  readonly validator: MetricsValidator
  /** For the one test that re-addresses a leased collection over it. */
  readonly metered: MeteredTarget
}

async function targetFor(
  env: TestEnv,
  kind: MeterKind
): Promise<MetricsTarget> {
  const target = await meteredTarget(env, kind)
  return {
    cluster: target.cluster,
    bucket: target.cluster.bucket(env.config.bucket),
    validator: createHttpValidator(target.meter, target.clusterName),
    metered: target,
  }
}

for (const kind of METER_KINDS) {
  defineSuite(
    kind.suiteName,
    { tier: 'slow', collection: CollectionStrategy.Named },
    (ctx) => {
      const { group, test, limited } = ctx
      // GoCAVES does not fail the walk's failing `createBucket`. A function,
      // because calling `limited` is what records the skip.
      const alwaysSucceeds = () =>
        limited('gocaves-bucket-create-drop-always-succeed')

      describe('#Management Operations', () => {
        group(
          '#Analytics Management Operations',
          [ServerFeature.Analytics],
          () => {
            test('should successfully perform analytics index mgmt operations', async ({
              env,
            }) => {
              const { cluster, validator } = await targetFor(env, kind)
              const amgr = cluster.analyticsIndexes()
              const dataverse = env.key()
              const dataset = env.key()
              const index = env.key()
              const inDataverse = { dataverseName: dataverse }

              dropOnTeardown(
                env,
                () => amgr.dropDataverse(dataverse),
                DataverseNotFoundError
              )

              validator.reset().op(AnalyticsMgmtOp.AnalyticsDataverseCreate)
              await amgr.createDataverse(dataverse)
              validator.validate()

              validator
                .reset()
                .op(AnalyticsMgmtOp.AnalyticsDataverseCreate)
                .error(true)
              await expectThrows(
                () => amgr.createDataverse(dataverse),
                CouchbaseError,
                undefined,
                env.ctx({ op: 'createDataverse', extra: 'already exists' })
              )
              validator.validate()

              validator.reset().op(AnalyticsMgmtOp.AnalyticsDatasetCreate)
              await amgr.createDataset(env.config.bucket, dataset, inDataverse)
              validator.validate()

              validator
                .reset()
                .op(AnalyticsMgmtOp.AnalyticsDatasetCreate)
                .error(true)
              await expectThrows(
                () =>
                  amgr.createDataset(env.config.bucket, dataset, inDataverse),
                CouchbaseError,
                undefined,
                env.ctx({ op: 'createDataset', extra: 'already exists' })
              )
              validator.validate()

              validator.reset().op(AnalyticsMgmtOp.AnalyticsDatasetGetAll)
              expect(
                (await amgr.getAllDatasets()).length,
                'dataset count'
              ).toBeGreaterThanOrEqual(1)
              validator.validate()

              validator.reset().op(AnalyticsMgmtOp.AnalyticsIndexCreate)
              await amgr.createIndex(
                dataset,
                index,
                { name: 'string' },
                inDataverse
              )
              validator.validate()

              validator
                .reset()
                .op(AnalyticsMgmtOp.AnalyticsIndexCreate)
                .error(true)
              await expectThrows(
                () =>
                  amgr.createIndex(
                    dataset,
                    index,
                    { name: 'string' },
                    inDataverse
                  ),
                CouchbaseError,
                undefined,
                env.ctx({ op: 'createIndex', extra: 'already exists' })
              )
              validator.validate()

              validator.reset().op(AnalyticsMgmtOp.AnalyticsIndexGetAll)
              expect(
                (await amgr.getAllIndexes()).length,
                'analytics index count'
              ).toBeGreaterThanOrEqual(1)
              validator.validate()

              validator.reset().op(AnalyticsMgmtOp.AnalyticsIndexDrop)
              await amgr.dropIndex(dataset, index, inDataverse)
              validator.validate()

              validator
                .reset()
                .op(AnalyticsMgmtOp.AnalyticsIndexDrop)
                .error(true)
              await expectThrows(
                () => amgr.dropIndex(dataset, index, inDataverse),
                CouchbaseError,
                undefined,
                env.ctx({ op: 'dropIndex', extra: 'already dropped' })
              )
              validator.validate()

              validator.reset().op(AnalyticsMgmtOp.AnalyticsDatasetDrop)
              await amgr.dropDataset(dataset, inDataverse)
              validator.validate()

              validator
                .reset()
                .op(AnalyticsMgmtOp.AnalyticsDatasetDrop)
                .error(true)
              await expectThrows(
                () => amgr.dropDataset(dataset, inDataverse),
                CouchbaseError,
                undefined,
                env.ctx({ op: 'dropDataset', extra: 'already dropped' })
              )
              validator.validate()

              validator.reset().op(AnalyticsMgmtOp.AnalyticsDataverseDrop)
              await amgr.dropDataverse(dataverse)
              validator.validate()

              validator
                .reset()
                .op(AnalyticsMgmtOp.AnalyticsDataverseDrop)
                .error(true)
              await expectThrows(
                () => amgr.dropDataverse(dataverse),
                CouchbaseError,
                undefined,
                env.ctx({ op: 'dropDataverse', extra: 'already dropped' })
              )
              validator.validate()
            })

            test('should successfully perform analytics link mgmt operations (S3)', async ({
              env,
            }) => {
              const { cluster, validator } = await targetFor(env, kind)
              const amgr = cluster.analyticsIndexes()
              const dataverse = env.key()
              const linkName = env.key()

              dropOnTeardown(
                env,
                () => amgr.dropDataverse(dataverse),
                DataverseNotFoundError
              )
              // Not asserted on: its metric is the subject of the test above.
              await amgr.createDataverse(dataverse)

              validator.reset().op(AnalyticsMgmtOp.AnalyticsLinkCreate)
              await amgr.createLink(s3Link(linkName, dataverse, 'us-east-1'))
              validator.validate()

              validator
                .reset()
                .op(AnalyticsMgmtOp.AnalyticsLinkCreate)
                .error(true)
              await expectThrows(
                () => amgr.createLink(s3Link(linkName, dataverse, 'us-east-1')),
                CouchbaseError,
                undefined,
                env.ctx({ op: 'createLink', extra: 'already exists' })
              )
              validator.validate()

              validator.reset().op(AnalyticsMgmtOp.AnalyticsLinkGetAll)
              const links = await amgr.getAllLinks({
                dataverse,
                linkType: AnalyticsLinkType.S3External,
              })
              expect(links.length, 'link count').toBeGreaterThanOrEqual(1)
              validator.validate()

              // A different region, so the replace has something to change.
              validator.reset().op(AnalyticsMgmtOp.AnalyticsLinkReplace)
              await amgr.replaceLink(s3Link(linkName, dataverse, 'us-west-2'))
              validator.validate()

              validator.reset().op(AnalyticsMgmtOp.AnalyticsLinkDrop)
              await amgr.dropLink(linkName, dataverse)
              validator.validate()

              validator
                .reset()
                .op(AnalyticsMgmtOp.AnalyticsLinkDrop)
                .error(true)
              await expectThrows(
                () => amgr.dropLink(linkName, dataverse),
                CouchbaseError,
                undefined,
                env.ctx({ op: 'dropLink', extra: 'already dropped' })
              )
              validator.validate()

              await amgr.dropDataverse(dataverse)
            })
          }
        )

        group(
          '#Bucket Management Operations',
          [ServerFeature.BucketManagement],
          () => {
            test.skipIf(alwaysSucceeds())(
              'should successfully perform bucket mgmt operations',
              async ({ env, signal }) => {
                const { cluster, validator } = await targetFor(env, kind)
                const bmgr = cluster.buckets()
                const bucketName = env.key()
                const settings = {
                  name: bucketName,
                  flushEnabled: true,
                  ramQuotaMB: RAM_QUOTA_MB,
                }

                dropOnTeardown(
                  env,
                  () => bmgr.dropBucket(bucketName),
                  BucketNotFoundError
                )

                validator
                  .reset()
                  .op(BucketMgmtOp.BucketCreate)
                  .bucketName(bucketName)
                await bmgr.createBucket(settings)
                validator.validate()

                await env.consistency.waitUntilBucketPresent(bucketName, {
                  signal,
                })

                validator
                  .reset()
                  .op(BucketMgmtOp.BucketGet)
                  .bucketName(bucketName)
                expect(await bmgr.getBucket(bucketName), 'bucket').toBeTypeOf(
                  'object'
                )
                validator.validate()

                validator.reset().op(BucketMgmtOp.BucketGetAll)
                expect(await bmgr.getAllBuckets(), 'buckets').toBeInstanceOf(
                  Array
                )
                validator.validate()

                validator
                  .reset()
                  .op(BucketMgmtOp.BucketCreate)
                  .bucketName(bucketName)
                  .error(true)
                await expectThrows(
                  () => bmgr.createBucket(settings),
                  CouchbaseError,
                  undefined,
                  env.ctx({ op: 'createBucket', extra: 'already exists' })
                )
                validator.validate()

                // `invalid-bucket` does not exist, so nothing is destroyed and
                // the metric is a failing flush.
                validator
                  .reset()
                  .op(BucketMgmtOp.BucketFlush)
                  .bucketName(MISSING_BUCKET)
                  .error(true)
                await expectThrows(
                  () => bmgr.flushBucket(MISSING_BUCKET),
                  CouchbaseError,
                  undefined,
                  env.ctx({ op: 'flushBucket', bucket: MISSING_BUCKET })
                )
                validator.validate()

                validator
                  .reset()
                  .op(BucketMgmtOp.BucketDrop)
                  .bucketName(bucketName)
                await bmgr.dropBucket(bucketName)
                validator.validate()

                await env.consistency.waitUntilBucketDropped(bucketName, {
                  signal,
                })

                validator
                  .reset()
                  .op(BucketMgmtOp.BucketGet)
                  .bucketName(bucketName)
                  .error(true)
                await expectThrows(
                  () => bmgr.getBucket(bucketName),
                  CouchbaseError,
                  undefined,
                  env.ctx({ op: 'getBucket', bucket: bucketName })
                )
                validator.validate()

                validator
                  .reset()
                  .op(BucketMgmtOp.BucketDrop)
                  .bucketName(bucketName)
                  .error(true)
                await expectThrows(
                  () => bmgr.dropBucket(bucketName),
                  CouchbaseError,
                  undefined,
                  env.ctx({ op: 'dropBucket', bucket: bucketName })
                )
                validator.validate()
              }
            )
          }
        )

        group(
          '#Collection Management Operations',
          [ServerFeature.Collections],
          () => {
            test('should successfully perform collection mgmt operations', async ({
              env,
              signal,
            }) => {
              const { bucket, validator } = await targetFor(env, kind)
              const cmgr = bucket.collections()
              const bucketName = env.config.bucket
              const scope = env.key()
              const collection = env.key()

              dropOnTeardown(
                env,
                () => cmgr.dropScope(scope),
                ScopeNotFoundError
              )

              validator
                .reset()
                .op(CollectionMgmtOp.ScopeCreate)
                .bucketName(bucketName)
                .scopeName(scope)
              await cmgr.createScope(scope)
              validator.validate()
              await env.consistency.waitUntilScopePresent(bucketName, scope, {
                signal,
              })

              validator
                .reset()
                .op(CollectionMgmtOp.CollectionCreate)
                .bucketName(bucketName)
                .scopeName(scope)
                .collectionName(collection)
              await cmgr.createCollection(collection, scope)
              validator.validate()
              await env.consistency.waitUntilCollectionPresent(
                bucketName,
                scope,
                collection,
                { signal }
              )

              validator
                .reset()
                .op(CollectionMgmtOp.ScopeGetAll)
                .bucketName(bucketName)
              const scopes = await cmgr.getAllScopes()
              const found = scopes.find((s) => s.name === scope)
              expect(found, `scope '${scope}' in getAllScopes`).toBeDefined()
              expect(
                found?.collections.find((c) => c.name === collection),
                `collection '${collection}' in scope '${scope}'`
              ).toBeDefined()
              validator.validate()

              validator
                .reset()
                .op(CollectionMgmtOp.ScopeCreate)
                .bucketName(bucketName)
                .scopeName(scope)
                .error(true)
              await expectThrows(
                () => cmgr.createScope(scope),
                CouchbaseError,
                undefined,
                env.ctx({ op: 'createScope', scope, extra: 'already exists' })
              )
              validator.validate()

              validator
                .reset()
                .op(CollectionMgmtOp.CollectionCreate)
                .bucketName(bucketName)
                .scopeName(scope)
                .collectionName(collection)
                .error(true)
              await expectThrows(
                () => cmgr.createCollection(collection, scope),
                CouchbaseError,
                undefined,
                env.ctx({
                  op: 'createCollection',
                  scope,
                  collection,
                  extra: 'already exists',
                })
              )
              validator.validate()

              validator
                .reset()
                .op(CollectionMgmtOp.CollectionDrop)
                .bucketName(bucketName)
                .scopeName(scope)
                .collectionName(collection)
              await cmgr.dropCollection(collection, scope)
              validator.validate()
              await env.consistency.waitUntilCollectionDropped(
                bucketName,
                scope,
                collection,
                { signal }
              )

              validator
                .reset()
                .op(CollectionMgmtOp.ScopeDrop)
                .bucketName(bucketName)
                .scopeName(scope)
              await cmgr.dropScope(scope)
              validator.validate()
              await env.consistency.waitUntilScopeDropped(bucketName, scope, {
                signal,
              })

              validator
                .reset()
                .op(CollectionMgmtOp.CollectionDrop)
                .bucketName(bucketName)
                .scopeName(scope)
                .collectionName(collection)
                .error(true)
              await expectThrows(
                () => cmgr.dropCollection(collection, scope),
                CouchbaseError,
                undefined,
                env.ctx({ op: 'dropCollection', scope, collection })
              )
              validator.validate()

              validator
                .reset()
                .op(CollectionMgmtOp.ScopeDrop)
                .bucketName(bucketName)
                .scopeName(scope)
                .error(true)
              await expectThrows(
                () => cmgr.dropScope(scope),
                CouchbaseError,
                undefined,
                env.ctx({ op: 'dropScope', scope })
              )
              validator.validate()
            })
          }
        )

        group(
          '#Eventing Function Management Operations',
          [ServerFeature.Eventing],
          () => {
            test('should successfully perform eventing function mgmt operations', async ({
              env,
            }) => {
              const { cluster, validator } = await targetFor(env, kind)

              validator
                .reset()
                .op(EventingFunctionMgmtOp.EventingGetAllFunctions)
              expect(
                await cluster.eventingFunctions().getAllFunctions(),
                'eventing functions'
              ).toBeInstanceOf(Array)
              validator.validate()
            })
          }
        )

        group(
          '#Query Index Management Operations',
          [ServerFeature.Query],
          () => {
            test(
              'should successfully perform query index mgmt operations',
              { timeout: QUERY_INDEX_TIMEOUT_MS },
              async ({ env, collectionLease, signal }) => {
                const target = await targetFor(env, kind)
                const validator = target.validator
                // No index drops: the indexes go with the leased collection.
                const qmgr = meteredCollection(
                  target.metered,
                  collectionLease
                ).queryIndexes()
                await waitUntilQueryable(
                  qmgr,
                  keyspaceOf(collectionLease),
                  signal
                )
                const secondary = env.key()
                const primary = `${secondary}-primary`

                validator.reset().op(QueryIndexMgmtOp.QueryIndexCreate)
                await qmgr.createPrimaryIndex({ name: primary })
                validator.validate()

                validator.reset().op(QueryIndexMgmtOp.QueryIndexCreate)
                await qmgr.createIndex(secondary, ['name'])
                validator.validate()

                validator
                  .reset()
                  .op(QueryIndexMgmtOp.QueryIndexCreate)
                  .error(true)
                await expectThrows(
                  () => qmgr.createPrimaryIndex({ name: primary }),
                  CouchbaseError,
                  undefined,
                  env.ctx({ op: 'createPrimaryIndex', extra: 'already exists' })
                )
                validator.validate()

                validator
                  .reset()
                  .op(QueryIndexMgmtOp.QueryIndexCreate)
                  .error(true)
                await expectThrows(
                  () => qmgr.createIndex(secondary, ['name']),
                  CouchbaseError,
                  undefined,
                  env.ctx({ op: 'createIndex', extra: 'already exists' })
                )
                validator.validate()

                validator.reset().op(QueryIndexMgmtOp.QueryIndexGetAll)
                expect(
                  (await qmgr.getAllIndexes()).length,
                  'query index count'
                ).toBeGreaterThanOrEqual(1)
                validator.validate()

                // Deferred, so the build and the watch have something to wait
                // for. Their creates are not asserted on.
                const deferred: string[] = []
                for (let i = 0; i < DEFERRED_INDEX_COUNT; ++i) {
                  const name = env.key()
                  deferred.push(name)
                  await qmgr.createIndex(name, ['name'], { deferred: true })
                }

                // Not asserted on: a deeply nested call that is complicated to
                // validate.
                await qmgr.buildDeferredIndexes()

                // Each poll is a getAll, and the number of polls depends on the
                // build's progress, so the count is a floor.
                validator
                  .reset()
                  .op(QueryIndexMgmtOp.QueryIndexWatchIndexes)
                  .nestedOps([QueryIndexMgmtOp.QueryIndexGetAll], {
                    atLeast: true,
                  })
                await qmgr.watchIndexes(deferred, WATCH_TIMEOUT_MS)
                validator.validate()
              }
            )
          }
        )

        group(
          '#Search Index Management Operations',
          [ServerFeature.Search],
          () => {
            test(
              'should successfully perform search index mgmt operations',
              { timeout: SEARCH_LIFECYCLE_TIMEOUT_MS },
              async ({ env, signal }) => {
                const { cluster, validator } = await targetFor(env, kind)
                const smgr = cluster.searchIndexes()
                const indexName = `sIdx-${env.key()}`
                const definition = searchIndexDefinition(
                  indexName,
                  env.config.bucket
                )

                dropOnTeardown(
                  env,
                  () => smgr.dropIndex(indexName),
                  IndexNotFoundError
                )

                validator.reset().op(SearchIndexMgmtOp.SearchIndexUpsert)
                await smgr.upsertIndex(definition)
                validator.validate()

                await waitForSearchIndex(smgr, indexName, true, signal)
                validator.reset().op(SearchIndexMgmtOp.SearchIndexGet)
                expect(
                  await smgr.getIndex(indexName),
                  'search index'
                ).toBeTypeOf('object')
                validator.validate()

                validator.reset().op(SearchIndexMgmtOp.SearchIndexGetAll)
                expect(
                  await smgr.getAllIndexes(),
                  'search indexes'
                ).toBeInstanceOf(Array)
                validator.validate()

                validator.reset().op(SearchIndexMgmtOp.SearchIndexDrop)
                await smgr.dropIndex(indexName)
                validator.validate()

                await waitForSearchIndex(smgr, indexName, false, signal)
                validator
                  .reset()
                  .op(SearchIndexMgmtOp.SearchIndexGet)
                  .error(true)
                await expectThrows(
                  () => smgr.getIndex(indexName),
                  CouchbaseError,
                  undefined,
                  env.ctx({ op: 'getIndex', extra: 'already dropped' })
                )
                validator.validate()

                validator
                  .reset()
                  .op(SearchIndexMgmtOp.SearchIndexDrop)
                  .error(true)
                await expectThrows(
                  () => smgr.dropIndex(indexName),
                  CouchbaseError,
                  undefined,
                  env.ctx({ op: 'dropIndex', extra: 'already dropped' })
                )
                validator.validate()
              }
            )
          }
        )

        group(
          '#User Management Operations',
          [ServerFeature.UserManagement],
          () => {
            test('should successfully perform user mgmt operations', async ({
              env,
              signal,
            }) => {
              const { cluster, validator } = await targetFor(env, kind)
              const umgr = cluster.users()
              const username = `${env.key()}-user`
              const user = {
                username,
                password: USER_PASSWORD,
                roles: [{ name: 'ro_admin' }],
              }

              dropOnTeardown(
                env,
                () => umgr.dropUser(username),
                UserNotFoundError
              )

              validator.reset().op(UserMgmtOp.UserUpsert)
              await umgr.upsertUser(user)
              validator.validate()

              await env.consistency.waitUntilUserPresent(username, 'local', {
                signal,
              })

              validator.reset().op(UserMgmtOp.UserGet)
              expect(
                (await umgr.getUser(username)).username,
                'fetched username'
              ).toBe(username)
              validator.validate()

              validator.reset().op(UserMgmtOp.UserGetAll)
              expect(
                (await umgr.getAllUsers()).length,
                'user count'
              ).toBeGreaterThanOrEqual(1)
              validator.validate()

              validator.reset().op(UserMgmtOp.RoleGetAll)
              expect(
                (await umgr.getRoles()).length,
                'role count'
              ).toBeGreaterThanOrEqual(1)
              validator.validate()

              validator.reset().op(UserMgmtOp.UserDrop)
              await umgr.dropUser(username)
              validator.validate()

              await env.consistency.waitUntilUserDropped(username, 'local', {
                signal,
              })

              validator.reset().op(UserMgmtOp.UserGet).error(true)
              await expectThrows(
                () => umgr.getUser(username),
                CouchbaseError,
                undefined,
                env.ctx({ op: 'getUser', extra: 'already dropped' })
              )
              validator.validate()

              validator.reset().op(UserMgmtOp.UserDrop).error(true)
              await expectThrows(
                () => umgr.dropUser(username),
                CouchbaseError,
                undefined,
                env.ctx({ op: 'dropUser', extra: 'already dropped' })
              )
              validator.validate()
            })
          }
        )

        group(
          '#View Index Management Operations',
          [ServerFeature.Views],
          () => {
            test('should successfully perform view index mgmt operations', async ({
              env,
              signal,
            }) => {
              const { bucket, validator } = await targetFor(env, kind)
              const vmgr = bucket.viewIndexes()
              const ddocName = env.key()
              const ddocKey = `dev_${ddocName}`
              const development = DesignDocumentNamespace.Development
              const ddoc = new DesignDocument({
                name: ddocKey,
                views: { testView: new DesignDocumentView({ map: VIEW_MAP }) },
              })

              dropOnTeardown(
                env,
                () => vmgr.dropDesignDocument(ddocKey, development),
                DesignDocumentNotFoundError
              )

              validator.reset().op(ViewIndexMgmtOp.ViewIndexUpsert)
              await vmgr.upsertDesignDocument(ddoc)
              validator.validate()

              await env.consistency.waitUntilDesignDocumentPresent(
                env.config.bucket,
                ddocKey,
                { signal }
              )

              // The name comes back without the key's namespace prefix.
              validator.reset().op(ViewIndexMgmtOp.ViewIndexGet)
              expect(
                (await vmgr.getDesignDocument(ddocKey, development)).name,
                'design document name'
              ).toBe(ddocName)
              validator.validate()

              validator.reset().op(ViewIndexMgmtOp.ViewIndexGetAll)
              expect(
                (await vmgr.getAllDesignDocuments(development)).length,
                'design document count'
              ).toBeGreaterThanOrEqual(1)
              validator.validate()

              validator.reset().op(ViewIndexMgmtOp.ViewIndexDrop)
              await vmgr.dropDesignDocument(ddocKey, development)
              validator.validate()

              await env.consistency.waitUntilDesignDocumentDropped(
                env.config.bucket,
                ddocKey,
                { signal }
              )

              validator.reset().op(ViewIndexMgmtOp.ViewIndexGet).error(true)
              await expectThrows(
                () => vmgr.getDesignDocument(ddocKey, development),
                CouchbaseError,
                undefined,
                env.ctx({ op: 'getDesignDocument', extra: 'already dropped' })
              )
              validator.validate()

              validator.reset().op(ViewIndexMgmtOp.ViewIndexDrop).error(true)
              await expectThrows(
                () => vmgr.dropDesignDocument(ddocKey, development),
                CouchbaseError,
                undefined,
                env.ctx({ op: 'dropDesignDocument', extra: 'already dropped' })
              )
              validator.validate()
            })
          }
        )
      })
    }
  )
}
