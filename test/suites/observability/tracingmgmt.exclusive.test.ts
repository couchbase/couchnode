import { describe, expect } from 'vitest'

import { AnalyticsLinkType } from '../../../lib/analyticsindexmanager'
import {
  BucketNotFoundError,
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
import { ServerFeature } from '../../infra/capabilities'
import { CollectionStrategy } from '../../infra/requirements'
import { defineSuite } from '../../infra/suite'
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
import {
  MODES,
  failingStep,
  step,
  targetFor,
} from '../../observability/tracing/mgmtwalk'
import {
  TRACER_KINDS,
  tracedCollection,
} from '../../observability/tracing/target'
import type { TracingValidator } from '../../observability/tracing/validators'

// Every service is walked twice, plainly and under a parent span the test
// opened, by one function parameterized on a `Mode`, so a step added to one
// walk is in both.
//
// `*.exclusive.test.ts` because the bucket walk flushes `invalid-bucket` to
// record a failing flush, and the static check reads the call, not the
// argument.
//
// Every resource is registered for teardown the moment it is created. The query
// walk uses a leased collection for the reason `metricsmgmt` gives.
//
// The eventing lifecycle walk is in `tracingeventing.periodic.test.ts`: its
// waits would dominate this file, which runs strictly sequentially.

for (const kind of TRACER_KINDS) {
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
            for (const mode of MODES) {
              test(`should successfully perform analytics index mgmt operations${mode.suffix}`, async ({
                env,
              }) => {
                const target = await targetFor(env, kind)
                const amgr = target.cluster.analyticsIndexes()
                const dataverse = env.key()
                const dataset = env.key()
                const index = env.key()
                const inDataverse = { dataverseName: dataverse }

                dropOnTeardown(
                  env,
                  () => amgr.dropDataverse(dataverse),
                  DataverseNotFoundError
                )

                await step(
                  target,
                  mode,
                  AnalyticsMgmtOp.AnalyticsDataverseCreate,
                  (o) => amgr.createDataverse(dataverse, o)
                )

                await failingStep(
                  target,
                  mode,
                  AnalyticsMgmtOp.AnalyticsDataverseCreate,
                  (o) => amgr.createDataverse(dataverse, o),
                  env.ctx({
                    op: 'createDataverse',
                    extra: 'already exists',
                  })
                )

                await step(
                  target,
                  mode,
                  AnalyticsMgmtOp.AnalyticsDatasetCreate,
                  (o) =>
                    amgr.createDataset(env.config.bucket, dataset, {
                      ...inDataverse,
                      ...o,
                    })
                )

                await failingStep(
                  target,
                  mode,
                  AnalyticsMgmtOp.AnalyticsDatasetCreate,
                  (o) =>
                    amgr.createDataset(env.config.bucket, dataset, {
                      ...inDataverse,
                      ...o,
                    }),
                  env.ctx({ op: 'createDataset', extra: 'already exists' })
                )

                const datasets = await step(
                  target,
                  mode,
                  AnalyticsMgmtOp.AnalyticsDatasetGetAll,
                  (o) => amgr.getAllDatasets(o)
                )
                expect(datasets.length, 'dataset count').toBeGreaterThanOrEqual(
                  1
                )

                await step(
                  target,
                  mode,
                  AnalyticsMgmtOp.AnalyticsIndexCreate,
                  (o) =>
                    amgr.createIndex(
                      dataset,
                      index,
                      { name: 'string' },
                      { ...inDataverse, ...o }
                    )
                )

                await failingStep(
                  target,
                  mode,
                  AnalyticsMgmtOp.AnalyticsIndexCreate,
                  (o) =>
                    amgr.createIndex(
                      dataset,
                      index,
                      { name: 'string' },
                      { ...inDataverse, ...o }
                    ),
                  env.ctx({ op: 'createIndex', extra: 'already exists' })
                )

                const indexes = await step(
                  target,
                  mode,
                  AnalyticsMgmtOp.AnalyticsIndexGetAll,
                  (o) => amgr.getAllIndexes(o)
                )
                expect(
                  indexes.length,
                  'analytics index count'
                ).toBeGreaterThanOrEqual(1)

                await step(
                  target,
                  mode,
                  AnalyticsMgmtOp.AnalyticsIndexDrop,
                  (o) =>
                    amgr.dropIndex(dataset, index, { ...inDataverse, ...o })
                )

                await failingStep(
                  target,
                  mode,
                  AnalyticsMgmtOp.AnalyticsIndexDrop,
                  (o) =>
                    amgr.dropIndex(dataset, index, { ...inDataverse, ...o }),
                  env.ctx({ op: 'dropIndex', extra: 'already dropped' })
                )

                await step(
                  target,
                  mode,
                  AnalyticsMgmtOp.AnalyticsDatasetDrop,
                  (o) => amgr.dropDataset(dataset, { ...inDataverse, ...o })
                )

                await failingStep(
                  target,
                  mode,
                  AnalyticsMgmtOp.AnalyticsDatasetDrop,
                  (o) => amgr.dropDataset(dataset, { ...inDataverse, ...o }),
                  env.ctx({ op: 'dropDataset', extra: 'already dropped' })
                )

                await step(
                  target,
                  mode,
                  AnalyticsMgmtOp.AnalyticsDataverseDrop,
                  (o) => amgr.dropDataverse(dataverse, o)
                )

                await failingStep(
                  target,
                  mode,
                  AnalyticsMgmtOp.AnalyticsDataverseDrop,
                  (o) => amgr.dropDataverse(dataverse, o),
                  env.ctx({ op: 'dropDataverse', extra: 'already dropped' })
                )
              })

              test(`should successfully perform analytics link mgmt operations (S3)${mode.suffix}`, async ({
                env,
              }) => {
                const target = await targetFor(env, kind)
                const amgr = target.cluster.analyticsIndexes()
                const dataverse = env.key()
                const linkName = env.key()

                dropOnTeardown(
                  env,
                  () => amgr.dropDataverse(dataverse),
                  DataverseNotFoundError
                )
                // Not asserted on: its span is the subject of the walk above.
                await amgr.createDataverse(dataverse)

                await step(
                  target,
                  mode,
                  AnalyticsMgmtOp.AnalyticsLinkCreate,
                  (o) =>
                    amgr.createLink(s3Link(linkName, dataverse, 'us-east-1'), o)
                )

                await failingStep(
                  target,
                  mode,
                  AnalyticsMgmtOp.AnalyticsLinkCreate,
                  (o) =>
                    amgr.createLink(
                      s3Link(linkName, dataverse, 'us-east-1'),
                      o
                    ),
                  env.ctx({ op: 'createLink', extra: 'already exists' })
                )

                const links = await step(
                  target,
                  mode,
                  AnalyticsMgmtOp.AnalyticsLinkGetAll,
                  (o) =>
                    amgr.getAllLinks({
                      dataverse,
                      linkType: AnalyticsLinkType.S3External,
                      ...o,
                    })
                )
                expect(links.length, 'link count').toBeGreaterThanOrEqual(1)

                // A different region, so the replace has something to change.
                await step(
                  target,
                  mode,
                  AnalyticsMgmtOp.AnalyticsLinkReplace,
                  (o) =>
                    amgr.replaceLink(
                      s3Link(linkName, dataverse, 'us-west-2'),
                      o
                    )
                )

                await step(
                  target,
                  mode,
                  AnalyticsMgmtOp.AnalyticsLinkDrop,
                  (o) => amgr.dropLink(linkName, dataverse, o)
                )

                await failingStep(
                  target,
                  mode,
                  AnalyticsMgmtOp.AnalyticsLinkDrop,
                  (o) => amgr.dropLink(linkName, dataverse, o),
                  env.ctx({ op: 'dropLink', extra: 'already dropped' })
                )

                await amgr.dropDataverse(dataverse)
              })
            }
          }
        )

        group(
          '#Bucket Management Operations',
          [ServerFeature.BucketManagement],
          () => {
            for (const mode of MODES) {
              test.skipIf(alwaysSucceeds())(
                `should successfully perform bucket mgmt operations${mode.suffix}`,
                async ({ env, signal }) => {
                  const target = await targetFor(env, kind)
                  const bmgr = target.cluster.buckets()
                  const bucketName = env.key()
                  const settings = {
                    name: bucketName,
                    flushEnabled: true,
                    ramQuotaMB: RAM_QUOTA_MB,
                  }
                  const named = (v: TracingValidator) =>
                    v.bucketName(bucketName)

                  dropOnTeardown(
                    env,
                    () => bmgr.dropBucket(bucketName),
                    BucketNotFoundError
                  )

                  await step(
                    target,
                    mode,
                    BucketMgmtOp.BucketCreate,
                    (o) => bmgr.createBucket(settings, o),
                    named
                  )

                  await env.consistency.waitUntilBucketPresent(bucketName, {
                    signal,
                  })

                  const bucket = await step(
                    target,
                    mode,
                    BucketMgmtOp.BucketGet,
                    (o) => bmgr.getBucket(bucketName, o),
                    named
                  )
                  expect(bucket, 'bucket').toBeTypeOf('object')

                  const buckets = await step(
                    target,
                    mode,
                    BucketMgmtOp.BucketGetAll,
                    (o) => bmgr.getAllBuckets(o)
                  )
                  expect(buckets, 'buckets').toBeInstanceOf(Array)

                  await failingStep(
                    target,
                    mode,
                    BucketMgmtOp.BucketCreate,
                    (o) => bmgr.createBucket(settings, o),
                    env.ctx({ op: 'createBucket', extra: 'already exists' }),
                    named
                  )

                  // `invalid-bucket` does not exist, so nothing is destroyed
                  // and the span is a failing flush.
                  await failingStep(
                    target,
                    mode,
                    BucketMgmtOp.BucketFlush,
                    (o) => bmgr.flushBucket(MISSING_BUCKET, o),
                    env.ctx({ op: 'flushBucket', bucket: MISSING_BUCKET }),
                    (v) => v.bucketName(MISSING_BUCKET)
                  )

                  await step(
                    target,
                    mode,
                    BucketMgmtOp.BucketDrop,
                    (o) => bmgr.dropBucket(bucketName, o),
                    named
                  )

                  await env.consistency.waitUntilBucketDropped(bucketName, {
                    signal,
                  })

                  await failingStep(
                    target,
                    mode,
                    BucketMgmtOp.BucketGet,
                    (o) => bmgr.getBucket(bucketName, o),
                    env.ctx({ op: 'getBucket', bucket: bucketName }),
                    named
                  )

                  await failingStep(
                    target,
                    mode,
                    BucketMgmtOp.BucketDrop,
                    (o) => bmgr.dropBucket(bucketName, o),
                    env.ctx({ op: 'dropBucket', bucket: bucketName }),
                    named
                  )
                }
              )
            }
          }
        )

        group(
          '#Collection Management Operations',
          [ServerFeature.Collections],
          () => {
            for (const mode of MODES) {
              test(`should successfully perform collection mgmt operations${mode.suffix}`, async ({
                env,
                signal,
              }) => {
                const target = await targetFor(env, kind)
                const cmgr = target.bucket.collections()
                const bucketName = env.config.bucket
                const scope = env.key()
                const collection = env.key()
                const inBucket = (v: TracingValidator) =>
                  v.bucketName(bucketName)
                const inScope = (v: TracingValidator) =>
                  v.bucketName(bucketName).scopeName(scope)
                const inCollection = (v: TracingValidator) =>
                  v
                    .bucketName(bucketName)
                    .scopeName(scope)
                    .collectionName(collection)

                dropOnTeardown(
                  env,
                  () => cmgr.dropScope(scope),
                  ScopeNotFoundError
                )

                await step(
                  target,
                  mode,
                  CollectionMgmtOp.ScopeCreate,
                  (o) => cmgr.createScope(scope, o),
                  inScope
                )
                await env.consistency.waitUntilScopePresent(bucketName, scope, {
                  signal,
                })

                await step(
                  target,
                  mode,
                  CollectionMgmtOp.CollectionCreate,
                  (o) => cmgr.createCollection(collection, scope, o),
                  inCollection
                )
                await env.consistency.waitUntilCollectionPresent(
                  bucketName,
                  scope,
                  collection,
                  { signal }
                )

                const scopes = await step(
                  target,
                  mode,
                  CollectionMgmtOp.ScopeGetAll,
                  (o) => cmgr.getAllScopes(o),
                  inBucket
                )
                const found = scopes.find((s) => s.name === scope)
                expect(found, `scope '${scope}' in getAllScopes`).toBeDefined()
                expect(
                  found?.collections.find((c) => c.name === collection),
                  `collection '${collection}' in scope '${scope}'`
                ).toBeDefined()

                await failingStep(
                  target,
                  mode,
                  CollectionMgmtOp.ScopeCreate,
                  (o) => cmgr.createScope(scope, o),
                  env.ctx({
                    op: 'createScope',
                    scope,
                    extra: 'already exists',
                  }),
                  inScope
                )

                await failingStep(
                  target,
                  mode,
                  CollectionMgmtOp.CollectionCreate,
                  (o) => cmgr.createCollection(collection, scope, o),
                  env.ctx({
                    op: 'createCollection',
                    scope,
                    collection,
                    extra: 'already exists',
                  }),
                  inCollection
                )

                await step(
                  target,
                  mode,
                  CollectionMgmtOp.CollectionDrop,
                  (o) => cmgr.dropCollection(collection, scope, o),
                  inCollection
                )
                await env.consistency.waitUntilCollectionDropped(
                  bucketName,
                  scope,
                  collection,
                  { signal }
                )

                await step(
                  target,
                  mode,
                  CollectionMgmtOp.ScopeDrop,
                  (o) => cmgr.dropScope(scope, o),
                  inScope
                )
                await env.consistency.waitUntilScopeDropped(bucketName, scope, {
                  signal,
                })

                await failingStep(
                  target,
                  mode,
                  CollectionMgmtOp.CollectionDrop,
                  (o) => cmgr.dropCollection(collection, scope, o),
                  env.ctx({ op: 'dropCollection', scope, collection }),
                  inCollection
                )

                await failingStep(
                  target,
                  mode,
                  CollectionMgmtOp.ScopeDrop,
                  (o) => cmgr.dropScope(scope, o),
                  env.ctx({ op: 'dropScope', scope }),
                  inScope
                )
              })
            }
          }
        )

        group(
          '#Eventing Function Management Operations',
          [ServerFeature.Eventing],
          () => {
            for (const mode of MODES) {
              // A listing call needs no keyspace, so nothing is provisioned.
              test(`should successfully perform eventing function mgmt operations${mode.suffix}`, async ({
                env,
              }) => {
                const target = await targetFor(env, kind)
                const emgr = target.cluster.eventingFunctions()

                const functions = await step(
                  target,
                  mode,
                  EventingFunctionMgmtOp.EventingGetAllFunctions,
                  (o) => emgr.getAllFunctions(o)
                )
                expect(functions, 'eventing functions').toBeInstanceOf(Array)
              })
            }
          }
        )

        group(
          '#Query Index Management Operations',
          [ServerFeature.Query],
          () => {
            for (const mode of MODES) {
              test(
                `should successfully perform query index mgmt operations${mode.suffix}`,
                { timeout: QUERY_INDEX_TIMEOUT_MS },
                async ({ collectionLease, env, signal }) => {
                  const target = await targetFor(env, kind)
                  // No index drops: the indexes go with the leased collection.
                  const qmgr = tracedCollection(
                    target.traced,
                    collectionLease
                  ).queryIndexes()
                  await waitUntilQueryable(
                    qmgr,
                    keyspaceOf(collectionLease),
                    signal
                  )
                  const secondary = env.key()
                  const primary = `${secondary}-primary`

                  await step(
                    target,
                    mode,
                    QueryIndexMgmtOp.QueryIndexCreate,
                    (o) => qmgr.createPrimaryIndex({ name: primary, ...o })
                  )

                  await step(
                    target,
                    mode,
                    QueryIndexMgmtOp.QueryIndexCreate,
                    (o) => qmgr.createIndex(secondary, ['name'], o)
                  )

                  await failingStep(
                    target,
                    mode,
                    QueryIndexMgmtOp.QueryIndexCreate,
                    (o) => qmgr.createPrimaryIndex({ name: primary, ...o }),
                    env.ctx({
                      op: 'createPrimaryIndex',
                      extra: 'already exists',
                    })
                  )

                  await failingStep(
                    target,
                    mode,
                    QueryIndexMgmtOp.QueryIndexCreate,
                    (o) => qmgr.createIndex(secondary, ['name'], o),
                    env.ctx({ op: 'createIndex', extra: 'already exists' })
                  )

                  const indexes = await step(
                    target,
                    mode,
                    QueryIndexMgmtOp.QueryIndexGetAll,
                    (o) => qmgr.getAllIndexes(o)
                  )
                  expect(
                    indexes.length,
                    'query index count'
                  ).toBeGreaterThanOrEqual(1)

                  // Deferred, so the build and the watch have something to wait
                  // for. Their creates are not asserted on.
                  const deferred: string[] = []
                  for (let i = 0; i < DEFERRED_INDEX_COUNT; ++i) {
                    const deferredName = env.key()
                    deferred.push(deferredName)
                    await qmgr.createIndex(deferredName, ['name'], {
                      deferred: true,
                    })
                  }

                  // Not asserted on: a deeply nested call that is complicated
                  // to validate.
                  await qmgr.buildDeferredIndexes()

                  await step(
                    target,
                    mode,
                    QueryIndexMgmtOp.QueryIndexWatchIndexes,
                    (o) => qmgr.watchIndexes(deferred, WATCH_TIMEOUT_MS, o),
                    (v) => v.nestedOps([QueryIndexMgmtOp.QueryIndexGetAll])
                  )
                }
              )
            }
          }
        )

        group(
          '#Search Index Management Operations',
          [ServerFeature.Search],
          () => {
            for (const mode of MODES) {
              test(
                `should successfully perform search index mgmt operations${mode.suffix}`,
                { timeout: SEARCH_LIFECYCLE_TIMEOUT_MS },
                async ({ env, signal }) => {
                  const target = await targetFor(env, kind)
                  const smgr = target.cluster.searchIndexes()
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

                  await step(
                    target,
                    mode,
                    SearchIndexMgmtOp.SearchIndexUpsert,
                    (o) => smgr.upsertIndex(definition, o)
                  )
                  await waitForSearchIndex(smgr, indexName, true, signal)

                  const index = await step(
                    target,
                    mode,
                    SearchIndexMgmtOp.SearchIndexGet,
                    (o) => smgr.getIndex(indexName, o)
                  )
                  expect(index, 'search index').toBeTypeOf('object')

                  const indexes = await step(
                    target,
                    mode,
                    SearchIndexMgmtOp.SearchIndexGetAll,
                    (o) => smgr.getAllIndexes(o)
                  )
                  expect(indexes, 'search indexes').toBeInstanceOf(Array)

                  await step(
                    target,
                    mode,
                    SearchIndexMgmtOp.SearchIndexDrop,
                    (o) => smgr.dropIndex(indexName, o)
                  )
                  await waitForSearchIndex(smgr, indexName, false, signal)

                  await failingStep(
                    target,
                    mode,
                    SearchIndexMgmtOp.SearchIndexGet,
                    (o) => smgr.getIndex(indexName, o),
                    env.ctx({ op: 'getIndex', extra: 'already dropped' })
                  )

                  await failingStep(
                    target,
                    mode,
                    SearchIndexMgmtOp.SearchIndexDrop,
                    (o) => smgr.dropIndex(indexName, o),
                    env.ctx({ op: 'dropIndex', extra: 'already dropped' })
                  )
                }
              )
            }
          }
        )

        group(
          '#User Management Operations',
          [ServerFeature.UserManagement],
          () => {
            for (const mode of MODES) {
              test(`should successfully perform user mgmt operations${mode.suffix}`, async ({
                env,
                signal,
              }) => {
                const target = await targetFor(env, kind)
                const umgr = target.cluster.users()
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

                await step(target, mode, UserMgmtOp.UserUpsert, (o) =>
                  umgr.upsertUser(user, o)
                )

                await env.consistency.waitUntilUserPresent(username, 'local', {
                  signal,
                })

                const fetched = await step(
                  target,
                  mode,
                  UserMgmtOp.UserGet,
                  (o) => umgr.getUser(username, o)
                )
                expect(fetched.username, 'fetched username').toBe(username)

                const users = await step(
                  target,
                  mode,
                  UserMgmtOp.UserGetAll,
                  (o) => umgr.getAllUsers(o)
                )
                expect(users.length, 'user count').toBeGreaterThanOrEqual(1)

                const roles = await step(
                  target,
                  mode,
                  UserMgmtOp.RoleGetAll,
                  (o) => umgr.getRoles(o)
                )
                expect(roles.length, 'role count').toBeGreaterThanOrEqual(1)

                await step(target, mode, UserMgmtOp.UserDrop, (o) =>
                  umgr.dropUser(username, o)
                )

                await env.consistency.waitUntilUserDropped(username, 'local', {
                  signal,
                })

                await failingStep(
                  target,
                  mode,
                  UserMgmtOp.UserGet,
                  (o) => umgr.getUser(username, o),
                  env.ctx({ op: 'getUser', extra: 'already dropped' })
                )

                await failingStep(
                  target,
                  mode,
                  UserMgmtOp.UserDrop,
                  (o) => umgr.dropUser(username, o),
                  env.ctx({ op: 'dropUser', extra: 'already dropped' })
                )
              })
            }
          }
        )

        group(
          '#View Index Management Operations',
          [ServerFeature.Views],
          () => {
            for (const mode of MODES) {
              test(`should successfully perform view index mgmt operations${mode.suffix}`, async ({
                env,
                signal,
              }) => {
                const target = await targetFor(env, kind)
                const vmgr = target.bucket.viewIndexes()
                const ddocName = env.key()
                const ddocKey = `dev_${ddocName}`
                const development = DesignDocumentNamespace.Development
                const ddoc = new DesignDocument({
                  name: ddocKey,
                  views: {
                    testView: new DesignDocumentView({ map: VIEW_MAP }),
                  },
                })

                dropOnTeardown(
                  env,
                  () => vmgr.dropDesignDocument(ddocKey, development),
                  DesignDocumentNotFoundError
                )

                await step(target, mode, ViewIndexMgmtOp.ViewIndexUpsert, (o) =>
                  vmgr.upsertDesignDocument(ddoc, o)
                )

                await env.consistency.waitUntilDesignDocumentPresent(
                  env.config.bucket,
                  ddocKey,
                  { signal }
                )

                // The name comes back without the key's namespace prefix.
                const fetched = await step(
                  target,
                  mode,
                  ViewIndexMgmtOp.ViewIndexGet,
                  (o) => vmgr.getDesignDocument(ddocKey, development, o)
                )
                expect(fetched.name, 'design document name').toBe(ddocName)

                const ddocs = await step(
                  target,
                  mode,
                  ViewIndexMgmtOp.ViewIndexGetAll,
                  (o) => vmgr.getAllDesignDocuments(development, o)
                )
                expect(
                  ddocs.length,
                  'design document count'
                ).toBeGreaterThanOrEqual(1)

                await step(target, mode, ViewIndexMgmtOp.ViewIndexDrop, (o) =>
                  vmgr.dropDesignDocument(ddocKey, development, o)
                )

                await env.consistency.waitUntilDesignDocumentDropped(
                  env.config.bucket,
                  ddocKey,
                  { signal }
                )

                await failingStep(
                  target,
                  mode,
                  ViewIndexMgmtOp.ViewIndexGet,
                  (o) => vmgr.getDesignDocument(ddocKey, development, o),
                  env.ctx({
                    op: 'getDesignDocument',
                    extra: 'already dropped',
                  })
                )

                await failingStep(
                  target,
                  mode,
                  ViewIndexMgmtOp.ViewIndexDrop,
                  (o) => vmgr.dropDesignDocument(ddocKey, development, o),
                  env.ctx({
                    op: 'dropDesignDocument',
                    extra: 'already dropped',
                  })
                )
              })
            }
          }
        )
      })
    }
  )
}
