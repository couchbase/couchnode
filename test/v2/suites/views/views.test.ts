import { describe, expect } from 'vitest'

import { DesignDocument, DesignDocumentView } from '../../../../lib/couchbase'
import type { Collection } from '../../../../lib/couchbase'
import {
  DesignDocumentNotFoundError,
  InvalidArgumentError,
  ViewNotFoundError,
} from '../../../../lib/errors'
import {
  DesignDocumentNamespace,
  ViewOrdering,
  ViewRow,
  ViewScanConsistency,
} from '../../../../lib/viewtypes'
import type { ViewResult } from '../../../../lib/viewtypes'
import { AssertCtx, withCtx } from '../../asserts/ctx'
import { expectThrows } from '../../asserts/errors'
import type { ErrorClass } from '../../asserts/errors'
import { assertRowCount } from '../../asserts/rows'
import { awaitCallback, settleCallback } from '../../infra/callbacks'
import { ServerFeature } from '../../infra/capabilities'
import { DocBatch } from '../../infra/data/loader'
import { TestEnv } from '../../infra/env'
import { CollectionStrategy } from '../../infra/requirements'
import { PollTimeoutError, pollUntil, tryNTimes } from '../../infra/retry'
import { defineSuite } from '../../infra/suite'

// Four blocks run the same management tests: deprecated and namespaced
// overloads, each through promises and callbacks. The fifth queries the view.
//
// Query polls exit on a row count, so the suite needs a bucket nothing else
// writes to (`CollectionStrategy.CleanDefault`).

const VIEW_QUERY_DEADLINE_MS = 20_000
const NEW_CONNECTION_DEADLINE_MS = 10_000
/** Above the poll deadlines, so the poll's error is seen. */
const VIEW_QUERY_TIMEOUT_MS = 30_000
/** The first data test may wait, rebuild the view, and wait twice more. */
const VIEW_REBUILD_TIMEOUT_MS = 90_000
const CREATE_DDOC_TIMEOUT_MS = 60_000
const PUBLISH_RETRIES = 5
const PUBLISH_RETRY_DELAY_MS = 1000

const MISSING_DDOC = 'missing-index-name'
const KEY_SIZE = 2

// The view emits a two-character slice of the uid as its key, chosen by which
// third of the batch the document is in. Ordering and range assertions are in
// terms of those keys, so the test repeats the derivation.

/** In the map function's slicing order. */
function* uidKeys(uid: string, keySize: number): Generator<string> {
  for (let i = 0; i < uid.length; i += keySize) {
    yield uid.slice(i, i + keySize)
  }
}

/**
 * Each key once, in slicing order. A random uid can repeat a slice, and a
 * repeated key holds the documents of every slice it came from, so counting
 * it twice expects rows the view never returns.
 */
function distinctUidKeys(uid: string, keySize: number): string[] {
  return [...new Set(uidKeys(uid, keySize))]
}

function keysAndDocIds(docIds: readonly string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {}
  for (const docId of docIds) {
    const tokens = docId.split('::')
    const index = parseInt(tokens[1])
    let key: string
    if (index < 2) {
      key = tokens[0].slice(0, 2)
    } else if (index >= 2 && index < 4) {
      key = tokens[0].slice(2, 4)
    } else if (index >= 4 && index < 6) {
      key = tokens[0].slice(4, 6)
    } else {
      key = tokens[0].slice(-2)
    }
    if (key in grouped) {
      grouped[key].push(docId)
    } else {
      grouped[key] = [docId]
    }
  }
  return grouped
}

function sortedDocIds(docIds: readonly string[], desc = false): string[] {
  const grouped = keysAndDocIds(docIds)
  return desc
    ? Object.keys(grouped)
        .sort()
        .reverse()
        .reduce<string[]>(
          (arr, key) => arr.concat([...grouped[key]].sort().reverse()),
          []
        )
    : Object.keys(grouped)
        .sort()
        .reduce<string[]>((arr, key) => arr.concat(grouped[key]), [])
}

// Per-suite state, created on first use and memoized for the file.

interface ViewsFixture {
  readonly docs: DocBatch
  readonly ddocKey: string
  readonly mapFunc: string
}

let fixture: Promise<ViewsFixture> | undefined

function viewsFor(env: TestEnv, collection: Collection): Promise<ViewsFixture> {
  if (!fixture) {
    fixture = loadViewsFixture(env, collection).catch((err) => {
      // Not cached on failure, or the next test inherits the rejection.
      fixture = undefined
      throw err
    })
  }
  return fixture
}

async function loadViewsFixture(
  env: TestEnv,
  collection: Collection
): Promise<ViewsFixture> {
  // The eight-character run id alone, so the view slices it into four keys.
  // `env.key()` appends a worker and a counter, which would slice into six.
  const uid = env.key().split('_')[0]
  const docs = await DocBatch.load(collection, { uid })
  env.registerCleanup(() => docs.purge())
  return { docs, ddocKey: env.key(), mapFunc: mapFunction(uid) }
}

function mapFunction(uid: string): string {
  return `
    function(doc, meta){
      if(meta.id.indexOf("${uid}")==0){
        const newDoc = {
          batch: "${uid}",
          id: meta.id,
          name: doc.name
        };
        const batches = newDoc.id.split('::')
        if (parseInt(batches[1]) < 2) {
          const key = batches[0].slice(0, 2)
          emit(key, newDoc)
        } else if (parseInt(batches[1]) >= 2 && parseInt(batches[1]) < 4) {
          const key = batches[0].slice(2, 4)
          emit(key, newDoc);
        } else if (parseInt(batches[1]) >= 4 && parseInt(batches[1]) < 6) {
          const key = batches[0].slice(4, 6)
          emit(key, newDoc);
        } else {
          const key = batches[0].slice(-2)
          emit(key, newDoc);
        }
      }
    }
  `
}

/**
 * The same view with a comment inside its body, so the view engine builds a new
 * index. A comment after the closing brace is refused as
 * `invalid_design_document`.
 */
function rebuiltMapFunction(mapFunc: string): string {
  const head = 'function(doc, meta){'
  if (!mapFunc.includes(head)) {
    throw new Error(`the map function has no \`${head}\` to mark`)
  }
  return mapFunc.replace(head, `${head}\n      // rebuilt`)
}

function designDocument(
  name: string,
  mapFunc: string,
  namespace?: DesignDocumentNamespace
): DesignDocument {
  return new DesignDocument({
    name,
    views: { simple: new DesignDocumentView({ map: mapFunc }) },
    ...(namespace === undefined ? {} : { namespace }),
  })
}

function viewCtx(bucketName: string, op: string, extra?: string): AssertCtx {
  return {
    op,
    bucket: bucketName,
    ...(extra === undefined ? {} : { extra }),
  }
}

function assertDesignDocument(
  res: DesignDocument,
  name: string,
  namespace: DesignDocumentNamespace,
  mapFunc: string,
  c: AssertCtx
): void {
  expect(res, withCtx('a DesignDocument', c)).toBeInstanceOf(DesignDocument)
  expect(res.name, withCtx('name', c)).toEqual(name)
  expect(res.namespace, withCtx('namespace', c)).toEqual(namespace)
  expect(res.views, withCtx('views', c)).toBeTypeOf('object')
  expect(Object.keys(res.views).length, withCtx('view count', c)).toEqual(1)
  expect(Object.keys(res.views)[0], withCtx('view name', c)).toEqual('simple')
  expect(res.views.simple, withCtx('the view', c)).toBeInstanceOf(
    DesignDocumentView
  )
  expect(res.views.simple.map, withCtx('the map function', c)).toStrictEqual(
    mapFunc
  )
}

function assertAllDesignDocuments(res: DesignDocument[], c: AssertCtx): void {
  expect(Array.isArray(res), withCtx('an array of design documents', c)).toBe(
    true
  )
  expect(res.length, withCtx('design document count', c)).toEqual(1)
  expect(
    res.every((dd) => dd instanceof DesignDocument),
    withCtx('every entry is a DesignDocument', c)
  ).toBe(true)
}

function assertCallbackError(
  err: Error | null,
  expected: ErrorClass<Error>,
  c: AssertCtx
): void {
  expect(err, withCtx('the callback should report an error', c)).toBeTruthy()
  expect(
    err,
    withCtx(`the error should be ${expected.name}`, c)
  ).toBeInstanceOf(expected)
}

function assertViewResult(
  res: ViewResult,
  expected: number,
  c: AssertCtx
): void {
  expect(
    Array.isArray(res.rows),
    withCtx('the view did not return an array of rows', c)
  ).toBe(true)
  assertRowCount(res.rows, expected, c)
  expect(res.meta, withCtx('the view returned no metadata', c)).toBeTypeOf(
    'object'
  )
}

function assertViewRowsDefined(
  res: ViewResult,
  expected: number,
  c: AssertCtx
): void {
  assertViewResult(res, expected, c)
  for (const row of res.rows) {
    expect(row.id, withCtx('row.id', c)).toBeDefined()
    expect(row.key, withCtx('row.key', c)).toBeDefined()
    expect(row.value, withCtx('row.value', c)).toBeDefined()
  }
}

function assertViewRowOrder(
  res: ViewResult,
  expected: number,
  expectedIds: readonly string[],
  c: AssertCtx
): void {
  assertViewResult(res, expected, c)
  expect(
    res.rows.map((r) => r.id),
    withCtx('document ids, in the order the view returned them', c)
  ).toStrictEqual([...expectedIds])
}

function assertLastRow(
  res: ViewResult,
  expected: number,
  key: string,
  docId: string,
  c: AssertCtx
): void {
  assertViewResult(res, expected, c)
  const last = res.rows[res.rows.length - 1]
  expect(last.key, withCtx("the last row's key", c)).toStrictEqual(key)
  expect(last.id, withCtx("the last row's document id", c)).toStrictEqual(docId)
}

function assertFirstRow(
  res: ViewResult,
  expected: number,
  key: string,
  docId: string,
  c: AssertCtx
): void {
  assertViewResult(res, expected, c)
  expect(res.rows[0].key, withCtx("the first row's key", c)).toStrictEqual(key)
  expect(
    res.rows[0].id,
    withCtx("the first row's document id", c)
  ).toStrictEqual(docId)
}

interface EmittedValue {
  readonly id: string
}

function assertRowsForKey(
  res: ViewResult<EmittedValue, string>,
  expected: number,
  key: string,
  expectedDocIds: readonly string[],
  c: AssertCtx
): void {
  assertViewResult(res, expected, c)
  for (const row of res.rows) {
    expect(row, withCtx('a ViewRow', c)).toBeInstanceOf(ViewRow)
    expect(row.id, withCtx('row.id', c)).toBeTypeOf('string')
    expect(row.key, withCtx('row.key', c)).toBeTypeOf('string')
    expect(row.value, withCtx('row.value', c)).toBeTypeOf('object')
    expect(row.key, withCtx('row.key', c)).toStrictEqual(key)
    expect(
      expectedDocIds.includes(row.value.id),
      withCtx(`${row.value.id} should be one of the expected documents`, c)
    ).toBe(true)
  }
}

function assertRowsForKeys(
  res: ViewResult<EmittedValue, string>,
  expected: number,
  keys: readonly string[],
  expectedDocIds: readonly string[],
  c: AssertCtx
): void {
  assertViewResult(res, expected, c)
  for (const row of res.rows) {
    expect(row, withCtx('a ViewRow', c)).toBeInstanceOf(ViewRow)
    expect(row.id, withCtx('row.id', c)).toBeTypeOf('string')
    expect(row.key, withCtx('row.key', c)).toBeTypeOf('string')
    expect(row.value, withCtx('row.value', c)).toBeTypeOf('object')
    expect(
      row.key !== undefined && keys.includes(row.key),
      withCtx(`${row.key} should be one of the requested keys`, c)
    ).toBe(true)
    expect(
      expectedDocIds.includes(row.value.id),
      withCtx(`${row.value.id} should be one of the expected documents`, c)
    ).toBe(true)
  }
}

/**
 * Runs a view query until it returns the expected rows, or the deadline passes.
 * A view is not queryable as soon as its design document is upserted;
 * `ViewNotFoundError` is the only error treated as "not yet".
 */
function viewUntilRows<V, K>(
  run: () => Promise<ViewResult<V, K>>,
  expected: number,
  deadlineMs: number,
  signal: AbortSignal
): Promise<ViewResult<V, K>> {
  return pollUntil<ViewResult<V, K>>(
    `the view to return ${expected} row(s)`,
    async (ctx) => {
      let res: ViewResult<V, K>
      try {
        res = await run()
      } catch (err) {
        if (!(err instanceof ViewNotFoundError)) {
          throw err
        }
        ctx.note(err.message)
        return undefined
      }
      if (res.rows.length !== expected) {
        ctx.note(`${res.rows.length} row(s)`)
        return undefined
      }
      return res
    },
    { deadlineMs, intervalMs: 100, signal }
  )
}

defineSuite(
  '#views',
  {
    features: [ServerFeature.Views, ServerFeature.BucketManagement],
    // `getAllDesignDocuments` asserts exactly one design document, true only
    // in a bucket nobody else uses.
    collection: CollectionStrategy.CleanDefault,
  },
  ({ test }) => {
    describe('#viewmgmt-deprecated', () => {
      test(
        'should successfully create an index',
        { timeout: CREATE_DDOC_TIMEOUT_MS },
        async ({ cluster, collection, collectionLease, env, signal }) => {
          const { ddocKey, mapFunc } = await viewsFor(env, collection)
          const bucketName = collectionLease.bucketName
          // Regression guard (JSCBC-1473): an upsert error fails the test
          // directly.
          await cluster
            .bucket(bucketName)
            .viewIndexes()
            .upsertDesignDocument(designDocument(`dev_${ddocKey}`, mapFunc))
          await env.protocol.waitUntilDesignDocumentPresent(
            bucketName,
            `dev_${ddocKey}`,
            { signal }
          )
        }
      )

      test('should successfully get a development index', async ({
        cluster,
        collection,
        collectionLease,
        env,
      }) => {
        const { ddocKey, mapFunc } = await viewsFor(env, collection)
        const res = await cluster
          .bucket(collectionLease.bucketName)
          .viewIndexes()
          .getDesignDocument(`dev_${ddocKey}`)
        assertDesignDocument(
          res,
          ddocKey,
          DesignDocumentNamespace.Development,
          mapFunc,
          env.ctx(viewCtx(collectionLease.bucketName, 'getDesignDocument'))
        )
      })

      test('should successfully drop a development index index', async ({
        cluster,
        collection,
        collectionLease,
        env,
        signal,
      }) => {
        const { ddocKey } = await viewsFor(env, collection)
        const bucketName = collectionLease.bucketName
        await cluster
          .bucket(bucketName)
          .viewIndexes()
          .dropDesignDocument(`dev_${ddocKey}`)
        // Regression guard (JSCBC-1474): waits on the `dev_` document just
        // dropped, not the production one, which does not exist yet.
        await env.protocol.waitUntilDesignDocumentDropped(
          bucketName,
          `dev_${ddocKey}`,
          { signal }
        )
      })

      test(
        'should successfully recreate an index',
        { timeout: CREATE_DDOC_TIMEOUT_MS },
        async ({ cluster, collection, collectionLease, env, signal }) => {
          const { ddocKey, mapFunc } = await viewsFor(env, collection)
          const bucketName = collectionLease.bucketName
          await cluster
            .bucket(bucketName)
            .viewIndexes()
            .upsertDesignDocument(designDocument(`dev_${ddocKey}`, mapFunc))
          await env.protocol.waitUntilDesignDocumentPresent(
            bucketName,
            `dev_${ddocKey}`,
            { signal }
          )
        }
      )

      test('should successfully publish an index', async ({
        cluster,
        collection,
        collectionLease,
        env,
        signal,
      }) => {
        const { ddocKey } = await viewsFor(env, collection)
        const bucketName = collectionLease.bucketName
        const vmgr = cluster.bucket(bucketName).viewIndexes()
        await vmgr.publishDesignDocument(ddocKey)
        await tryNTimes(PUBLISH_RETRIES, PUBLISH_RETRY_DELAY_MS, () =>
          vmgr.getDesignDocument(ddocKey)
        )
        // The retried read proves only one node serves the document, and the
        // next test reads it without retry from any node, which may still hold
        // the tombstone from this block's earlier drop.
        await env.protocol.waitUntilDesignDocumentPresent(bucketName, ddocKey, {
          signal,
        })
      })

      test('should fail to publish a non-existent index', async ({
        cluster,
        collection,
        collectionLease,
        env,
      }) => {
        await viewsFor(env, collection)
        const bucketName = collectionLease.bucketName
        await expectThrows(
          () =>
            cluster
              .bucket(bucketName)
              .viewIndexes()
              .publishDesignDocument(MISSING_DDOC),
          DesignDocumentNotFoundError,
          undefined,
          env.ctx(viewCtx(bucketName, 'publishDesignDocument', MISSING_DDOC))
        )
      })

      test('should successfully get a production index', async ({
        cluster,
        collection,
        collectionLease,
        env,
      }) => {
        const { ddocKey, mapFunc } = await viewsFor(env, collection)
        const res = await cluster
          .bucket(collectionLease.bucketName)
          .viewIndexes()
          .getDesignDocument(ddocKey)
        assertDesignDocument(
          res,
          ddocKey,
          DesignDocumentNamespace.Production,
          mapFunc,
          env.ctx(viewCtx(collectionLease.bucketName, 'getDesignDocument'))
        )
      })

      test('should successfully get all indexes', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        const res = await cluster
          .bucket(collectionLease.bucketName)
          .viewIndexes()
          .getAllDesignDocuments()
        assertAllDesignDocuments(
          res,
          env.ctx(viewCtx(collectionLease.bucketName, 'getAllDesignDocuments'))
        )
      })

      test('should successfully drop a production index', async ({
        cluster,
        collection,
        collectionLease,
        env,
        signal,
      }) => {
        const { ddocKey } = await viewsFor(env, collection)
        const bucketName = collectionLease.bucketName
        await cluster
          .bucket(bucketName)
          .viewIndexes()
          .dropDesignDocument(ddocKey)
        await env.protocol.waitUntilDesignDocumentDropped(bucketName, ddocKey, {
          signal,
        })
      })

      test('should fail to drop a non-existent index', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        const bucketName = collectionLease.bucketName
        await expectThrows(
          () =>
            cluster
              .bucket(bucketName)
              .viewIndexes()
              .dropDesignDocument(MISSING_DDOC),
          DesignDocumentNotFoundError,
          undefined,
          env.ctx(viewCtx(bucketName, 'dropDesignDocument', MISSING_DDOC))
        )
      })
    })

    describe('#viewmgmt-deprecated-callback', () => {
      test(
        'should successfully create an index',
        { timeout: CREATE_DDOC_TIMEOUT_MS },
        async ({ cluster, collection, collectionLease, env, signal }) => {
          const { ddocKey, mapFunc } = await viewsFor(env, collection)
          const bucketName = collectionLease.bucketName
          const vmgr = cluster.bucket(bucketName).viewIndexes()
          await awaitCallback<void>((cb) =>
            vmgr.upsertDesignDocument(
              designDocument(`dev_${ddocKey}`, mapFunc),
              cb
            )
          )
          await env.protocol.waitUntilDesignDocumentPresent(
            bucketName,
            `dev_${ddocKey}`,
            { signal }
          )
        }
      )

      test('should successfully get a development index', async ({
        cluster,
        collection,
        collectionLease,
        env,
      }) => {
        const { ddocKey, mapFunc } = await viewsFor(env, collection)
        const vmgr = cluster.bucket(collectionLease.bucketName).viewIndexes()
        const res = await awaitCallback<DesignDocument>((cb) =>
          vmgr.getDesignDocument(`dev_${ddocKey}`, cb)
        )
        assertDesignDocument(
          res,
          ddocKey,
          DesignDocumentNamespace.Development,
          mapFunc,
          env.ctx(viewCtx(collectionLease.bucketName, 'getDesignDocument'))
        )
      })

      test('should successfully drop a development index index', async ({
        cluster,
        collection,
        collectionLease,
        env,
        signal,
      }) => {
        const { ddocKey } = await viewsFor(env, collection)
        const bucketName = collectionLease.bucketName
        const vmgr = cluster.bucket(bucketName).viewIndexes()
        await awaitCallback<void>((cb) =>
          vmgr.dropDesignDocument(`dev_${ddocKey}`, cb)
        )
        // Regression guard (JSCBC-1474), as in the promise-form test above.
        await env.protocol.waitUntilDesignDocumentDropped(
          bucketName,
          `dev_${ddocKey}`,
          { signal }
        )
      })

      test(
        'should successfully recreate an index',
        { timeout: CREATE_DDOC_TIMEOUT_MS },
        async ({ cluster, collection, collectionLease, env, signal }) => {
          const { ddocKey, mapFunc } = await viewsFor(env, collection)
          const bucketName = collectionLease.bucketName
          const vmgr = cluster.bucket(bucketName).viewIndexes()
          await awaitCallback<void>((cb) =>
            vmgr.upsertDesignDocument(
              designDocument(`dev_${ddocKey}`, mapFunc),
              cb
            )
          )
          await env.protocol.waitUntilDesignDocumentPresent(
            bucketName,
            `dev_${ddocKey}`,
            { signal }
          )
        }
      )

      test('should successfully publish an index', async ({
        cluster,
        collection,
        collectionLease,
        env,
        signal,
      }) => {
        const { ddocKey } = await viewsFor(env, collection)
        const bucketName = collectionLease.bucketName
        const vmgr = cluster.bucket(bucketName).viewIndexes()
        await tryNTimes(PUBLISH_RETRIES, PUBLISH_RETRY_DELAY_MS, () =>
          awaitCallback<void>((cb) => vmgr.publishDesignDocument(ddocKey, cb))
        )
        await tryNTimes(PUBLISH_RETRIES, PUBLISH_RETRY_DELAY_MS, () =>
          awaitCallback<DesignDocument>((cb) =>
            vmgr.getDesignDocument(ddocKey, cb)
          )
        )
        // Every node: see `#viewmgmt-deprecated`'s publish test.
        await env.protocol.waitUntilDesignDocumentPresent(bucketName, ddocKey, {
          signal,
        })
      })

      test('should fail to publish a non-existent index', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        const bucketName = collectionLease.bucketName
        const vmgr = cluster.bucket(bucketName).viewIndexes()
        const { err } = await settleCallback<void>((cb) =>
          vmgr.publishDesignDocument(MISSING_DDOC, cb)
        )
        assertCallbackError(
          err,
          DesignDocumentNotFoundError,
          env.ctx(viewCtx(bucketName, 'publishDesignDocument', MISSING_DDOC))
        )
      })

      test('should successfully get a production index', async ({
        cluster,
        collection,
        collectionLease,
        env,
      }) => {
        const { ddocKey, mapFunc } = await viewsFor(env, collection)
        const vmgr = cluster.bucket(collectionLease.bucketName).viewIndexes()
        const res = await awaitCallback<DesignDocument>((cb) =>
          vmgr.getDesignDocument(ddocKey, cb)
        )
        assertDesignDocument(
          res,
          ddocKey,
          DesignDocumentNamespace.Production,
          mapFunc,
          env.ctx(viewCtx(collectionLease.bucketName, 'getDesignDocument'))
        )
      })

      test('should successfully get all indexes', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        const vmgr = cluster.bucket(collectionLease.bucketName).viewIndexes()
        const res = await awaitCallback<DesignDocument[]>((cb) =>
          vmgr.getAllDesignDocuments(cb)
        )
        assertAllDesignDocuments(
          res,
          env.ctx(viewCtx(collectionLease.bucketName, 'getAllDesignDocuments'))
        )
      })

      test('should successfully drop a production index', async ({
        cluster,
        collection,
        collectionLease,
        env,
        signal,
      }) => {
        const { ddocKey } = await viewsFor(env, collection)
        const bucketName = collectionLease.bucketName
        const vmgr = cluster.bucket(bucketName).viewIndexes()
        await awaitCallback<void>((cb) => vmgr.dropDesignDocument(ddocKey, cb))
        await env.protocol.waitUntilDesignDocumentDropped(bucketName, ddocKey, {
          signal,
        })
      })

      test('should fail to drop a non-existent index', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        const bucketName = collectionLease.bucketName
        const vmgr = cluster.bucket(bucketName).viewIndexes()
        const { err } = await settleCallback<void>((cb) =>
          vmgr.dropDesignDocument(MISSING_DDOC, cb)
        )
        assertCallbackError(
          err,
          DesignDocumentNotFoundError,
          env.ctx(viewCtx(bucketName, 'dropDesignDocument', MISSING_DDOC))
        )
      })
    })

    describe('#viewmgmt', () => {
      test(
        'should successfully create an index',
        { timeout: CREATE_DDOC_TIMEOUT_MS },
        async ({ cluster, collection, collectionLease, env, signal }) => {
          const { ddocKey, mapFunc } = await viewsFor(env, collection)
          const bucketName = collectionLease.bucketName
          await cluster
            .bucket(bucketName)
            .viewIndexes()
            .upsertDesignDocument(
              designDocument(ddocKey, mapFunc),
              DesignDocumentNamespace.Development
            )
          await env.protocol.waitUntilDesignDocumentPresent(
            bucketName,
            `dev_${ddocKey}`,
            { signal }
          )
        }
      )

      test('should successfully get a development index', async ({
        cluster,
        collection,
        collectionLease,
        env,
      }) => {
        const { ddocKey, mapFunc } = await viewsFor(env, collection)
        const res = await cluster
          .bucket(collectionLease.bucketName)
          .viewIndexes()
          .getDesignDocument(ddocKey, DesignDocumentNamespace.Development)
        assertDesignDocument(
          res,
          ddocKey,
          DesignDocumentNamespace.Development,
          mapFunc,
          env.ctx(viewCtx(collectionLease.bucketName, 'getDesignDocument'))
        )
      })

      test('should successfully drop a development index', async ({
        cluster,
        collection,
        collectionLease,
        env,
        signal,
      }) => {
        const { ddocKey } = await viewsFor(env, collection)
        const bucketName = collectionLease.bucketName
        await cluster
          .bucket(bucketName)
          .viewIndexes()
          .dropDesignDocument(ddocKey, DesignDocumentNamespace.Development)
        await env.protocol.waitUntilDesignDocumentDropped(
          bucketName,
          `dev_${ddocKey}`,
          { signal }
        )
      })

      test(
        'should successfully recreate an index',
        { timeout: CREATE_DDOC_TIMEOUT_MS },
        async ({ cluster, collection, collectionLease, env, signal }) => {
          const { ddocKey, mapFunc } = await viewsFor(env, collection)
          const bucketName = collectionLease.bucketName
          await cluster
            .bucket(bucketName)
            .viewIndexes()
            .upsertDesignDocument(
              designDocument(ddocKey, mapFunc),
              DesignDocumentNamespace.Development
            )
          await env.protocol.waitUntilDesignDocumentPresent(
            bucketName,
            `dev_${ddocKey}`,
            { signal }
          )
        }
      )

      test('should successfully publish an index', async ({
        cluster,
        collection,
        collectionLease,
        env,
        signal,
      }) => {
        const { ddocKey } = await viewsFor(env, collection)
        const bucketName = collectionLease.bucketName
        const vmgr = cluster.bucket(bucketName).viewIndexes()
        await vmgr.publishDesignDocument(ddocKey)
        await tryNTimes(PUBLISH_RETRIES, PUBLISH_RETRY_DELAY_MS, () =>
          vmgr.getDesignDocument(ddocKey, DesignDocumentNamespace.Production)
        )
        // Every node: see `#viewmgmt-deprecated`'s publish test.
        await env.protocol.waitUntilDesignDocumentPresent(bucketName, ddocKey, {
          signal,
        })
      })

      test('should fail to publish a non-existent index', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        const bucketName = collectionLease.bucketName
        await expectThrows(
          () =>
            cluster
              .bucket(bucketName)
              .viewIndexes()
              .publishDesignDocument(MISSING_DDOC),
          DesignDocumentNotFoundError,
          undefined,
          env.ctx(viewCtx(bucketName, 'publishDesignDocument', MISSING_DDOC))
        )
      })

      test('should successfully get a production index', async ({
        cluster,
        collection,
        collectionLease,
        env,
      }) => {
        const { ddocKey, mapFunc } = await viewsFor(env, collection)
        const res = await cluster
          .bucket(collectionLease.bucketName)
          .viewIndexes()
          .getDesignDocument(ddocKey, DesignDocumentNamespace.Production)
        assertDesignDocument(
          res,
          ddocKey,
          DesignDocumentNamespace.Production,
          mapFunc,
          env.ctx(viewCtx(collectionLease.bucketName, 'getDesignDocument'))
        )
      })

      test('should successfully get all indexes', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        const res = await cluster
          .bucket(collectionLease.bucketName)
          .viewIndexes()
          .getAllDesignDocuments(DesignDocumentNamespace.Production)
        assertAllDesignDocuments(
          res,
          env.ctx(viewCtx(collectionLease.bucketName, 'getAllDesignDocuments'))
        )
      })

      test('should successfully drop a production index', async ({
        cluster,
        collection,
        collectionLease,
        env,
        signal,
      }) => {
        const { ddocKey } = await viewsFor(env, collection)
        const bucketName = collectionLease.bucketName
        await cluster
          .bucket(bucketName)
          .viewIndexes()
          .dropDesignDocument(ddocKey, DesignDocumentNamespace.Production)
        await env.protocol.waitUntilDesignDocumentDropped(bucketName, ddocKey, {
          signal,
        })
      })

      test('should fail to drop a non-existent index', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        const bucketName = collectionLease.bucketName
        await expectThrows(
          () =>
            cluster
              .bucket(bucketName)
              .viewIndexes()
              .dropDesignDocument(
                MISSING_DDOC,
                DesignDocumentNamespace.Development
              ),
          DesignDocumentNotFoundError,
          undefined,
          env.ctx(viewCtx(bucketName, 'dropDesignDocument', MISSING_DDOC))
        )
      })
    })

    describe('#viewmgmt-callback', () => {
      test(
        'should successfully create an index',
        { timeout: CREATE_DDOC_TIMEOUT_MS },
        async ({ cluster, collection, collectionLease, env, signal }) => {
          const { ddocKey, mapFunc } = await viewsFor(env, collection)
          const bucketName = collectionLease.bucketName
          const vmgr = cluster.bucket(bucketName).viewIndexes()
          await awaitCallback<void>((cb) =>
            vmgr.upsertDesignDocument(
              designDocument(ddocKey, mapFunc),
              DesignDocumentNamespace.Development,
              cb
            )
          )
          await env.protocol.waitUntilDesignDocumentPresent(
            bucketName,
            `dev_${ddocKey}`,
            { signal }
          )
        }
      )

      test('should successfully get a development index', async ({
        cluster,
        collection,
        collectionLease,
        env,
      }) => {
        const { ddocKey, mapFunc } = await viewsFor(env, collection)
        const vmgr = cluster.bucket(collectionLease.bucketName).viewIndexes()
        const res = await awaitCallback<DesignDocument>((cb) =>
          vmgr.getDesignDocument(
            ddocKey,
            DesignDocumentNamespace.Development,
            cb
          )
        )
        assertDesignDocument(
          res,
          ddocKey,
          DesignDocumentNamespace.Development,
          mapFunc,
          env.ctx(viewCtx(collectionLease.bucketName, 'getDesignDocument'))
        )
      })

      test('should successfully drop a development index', async ({
        cluster,
        collection,
        collectionLease,
        env,
        signal,
      }) => {
        const { ddocKey } = await viewsFor(env, collection)
        const bucketName = collectionLease.bucketName
        const vmgr = cluster.bucket(bucketName).viewIndexes()
        await awaitCallback<void>((cb) =>
          vmgr.dropDesignDocument(
            ddocKey,
            DesignDocumentNamespace.Development,
            cb
          )
        )
        await env.protocol.waitUntilDesignDocumentDropped(
          bucketName,
          `dev_${ddocKey}`,
          { signal }
        )
      })

      test(
        'should successfully recreate an index',
        { timeout: CREATE_DDOC_TIMEOUT_MS },
        async ({ cluster, collection, collectionLease, env, signal }) => {
          const { ddocKey, mapFunc } = await viewsFor(env, collection)
          const bucketName = collectionLease.bucketName
          const vmgr = cluster.bucket(bucketName).viewIndexes()
          await awaitCallback<void>((cb) =>
            vmgr.upsertDesignDocument(
              designDocument(ddocKey, mapFunc),
              DesignDocumentNamespace.Development,
              cb
            )
          )
          await env.protocol.waitUntilDesignDocumentPresent(
            bucketName,
            `dev_${ddocKey}`,
            { signal }
          )
        }
      )

      test('should successfully publish an index', async ({
        cluster,
        collection,
        collectionLease,
        env,
        signal,
      }) => {
        const { ddocKey } = await viewsFor(env, collection)
        const bucketName = collectionLease.bucketName
        const vmgr = cluster.bucket(bucketName).viewIndexes()
        await tryNTimes(PUBLISH_RETRIES, PUBLISH_RETRY_DELAY_MS, () =>
          awaitCallback<void>((cb) => vmgr.publishDesignDocument(ddocKey, cb))
        )
        await tryNTimes(PUBLISH_RETRIES, PUBLISH_RETRY_DELAY_MS, () =>
          awaitCallback<DesignDocument>((cb) =>
            vmgr.getDesignDocument(
              ddocKey,
              DesignDocumentNamespace.Production,
              {},
              cb
            )
          )
        )
        // Every node: see `#viewmgmt-deprecated`'s publish test.
        await env.protocol.waitUntilDesignDocumentPresent(bucketName, ddocKey, {
          signal,
        })
      })

      test('should fail to publish a non-existent index', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        const bucketName = collectionLease.bucketName
        const vmgr = cluster.bucket(bucketName).viewIndexes()
        const { err } = await settleCallback<void>((cb) =>
          vmgr.publishDesignDocument(MISSING_DDOC, cb)
        )
        assertCallbackError(
          err,
          DesignDocumentNotFoundError,
          env.ctx(viewCtx(bucketName, 'publishDesignDocument', MISSING_DDOC))
        )
      })

      test('should successfully get a production index', async ({
        cluster,
        collection,
        collectionLease,
        env,
      }) => {
        const { ddocKey, mapFunc } = await viewsFor(env, collection)
        const vmgr = cluster.bucket(collectionLease.bucketName).viewIndexes()
        const res = await awaitCallback<DesignDocument>((cb) =>
          vmgr.getDesignDocument(
            ddocKey,
            DesignDocumentNamespace.Production,
            {},
            cb
          )
        )
        assertDesignDocument(
          res,
          ddocKey,
          DesignDocumentNamespace.Production,
          mapFunc,
          env.ctx(viewCtx(collectionLease.bucketName, 'getDesignDocument'))
        )
      })

      test('should successfully get all indexes', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        const vmgr = cluster.bucket(collectionLease.bucketName).viewIndexes()
        const res = await awaitCallback<DesignDocument[]>((cb) =>
          vmgr.getAllDesignDocuments(DesignDocumentNamespace.Production, cb)
        )
        assertAllDesignDocuments(
          res,
          env.ctx(viewCtx(collectionLease.bucketName, 'getAllDesignDocuments'))
        )
      })

      test('should successfully drop a production index', async ({
        cluster,
        collection,
        collectionLease,
        env,
        signal,
      }) => {
        const { ddocKey } = await viewsFor(env, collection)
        const bucketName = collectionLease.bucketName
        const vmgr = cluster.bucket(bucketName).viewIndexes()
        await awaitCallback<void>((cb) =>
          vmgr.dropDesignDocument(
            ddocKey,
            DesignDocumentNamespace.Production,
            cb
          )
        )
        await env.protocol.waitUntilDesignDocumentDropped(bucketName, ddocKey, {
          signal,
        })
      })

      test('should fail to drop a non-existent index', async ({
        cluster,
        collectionLease,
        env,
      }) => {
        const bucketName = collectionLease.bucketName
        const vmgr = cluster.bucket(bucketName).viewIndexes()
        const { err } = await settleCallback<void>((cb) =>
          vmgr.dropDesignDocument(
            MISSING_DDOC,
            DesignDocumentNamespace.Development,
            cb
          )
        )
        assertCallbackError(
          err,
          DesignDocumentNotFoundError,
          env.ctx(viewCtx(bucketName, 'dropDesignDocument', MISSING_DDOC))
        )
      })
    })

    describe('#viewquery', () => {
      test(
        'should successfully create an index',
        { timeout: CREATE_DDOC_TIMEOUT_MS },
        async ({ cluster, collection, collectionLease, env, signal }) => {
          const { ddocKey, mapFunc } = await viewsFor(env, collection)
          const bucketName = collectionLease.bucketName
          await cluster
            .bucket(bucketName)
            .viewIndexes()
            .upsertDesignDocument(
              designDocument(ddocKey, mapFunc),
              DesignDocumentNamespace.Development
            )
          await env.protocol.waitUntilDesignDocumentPresent(
            bucketName,
            `dev_${ddocKey}`,
            { signal }
          )
        }
      )

      test(
        'should see test data correctly',
        { timeout: VIEW_REBUILD_TIMEOUT_MS },
        async ({
          annotate,
          cluster,
          collection,
          collectionLease,
          env,
          signal,
        }) => {
          const { docs, ddocKey, mapFunc } = await viewsFor(env, collection)
          const bucketName = collectionLease.bucketName
          // Brought up to date first, for every query after it. The view
          // engine indexes only what has reached disk, so under a backed up
          // disk queue a count can sit short for the whole poll.
          // `RequestPlus` updates the index before answering.
          const upToDate = () =>
            viewUntilRows(
              () =>
                cluster.bucket(bucketName).viewQuery(ddocKey, 'simple', {
                  namespace: DesignDocumentNamespace.Development,
                  scanConsistency: ViewScanConsistency.RequestPlus,
                }),
              docs.size,
              VIEW_QUERY_DEADLINE_MS,
              signal
            )
          try {
            await upToDate()
          } catch (err) {
            if (!(err instanceof PollTimeoutError)) {
              throw err
            }
            // The first index on a new design document can stall short of the
            // data, unmoved by `RequestPlus` or `fullSet`. A changed definition
            // forces a new index. Once only, and logged, because a view that
            // needs it every time is worth knowing about.
            await cluster
              .bucket(bucketName)
              .viewIndexes()
              .upsertDesignDocument(
                designDocument(ddocKey, rebuiltMapFunction(mapFunc)),
                DesignDocumentNamespace.Development
              )
            await env.protocol.waitUntilDesignDocumentPresent(
              bucketName,
              `dev_${ddocKey}`,
              { signal }
            )
            await annotate(
              `the view stalled short and was rebuilt once: ${err.message}`,
              'warning'
            )
            await upToDate()
          }
          const res = await viewUntilRows(
            () =>
              cluster.bucket(bucketName).viewQuery(ddocKey, 'simple', {
                namespace: DesignDocumentNamespace.Development,
                fullSet: true,
              }),
            docs.size,
            VIEW_QUERY_DEADLINE_MS,
            signal
          )
          assertViewRowsDefined(
            res,
            docs.size,
            env.ctx(viewCtx(bucketName, 'viewQuery', 'fullSet'))
          )
        }
      )

      test(
        'should see test data correctly with a new connection',
        { timeout: VIEW_QUERY_TIMEOUT_MS },
        async ({ collection, collectionLease, env, signal }) => {
          const { docs, ddocKey } = await viewsFor(env, collection)
          const bucketName = collectionLease.bucketName
          const other = await env.openCluster()
          const res = await viewUntilRows(
            () =>
              other.bucket(bucketName).viewQuery(ddocKey, 'simple', {
                namespace: DesignDocumentNamespace.Development,
                fullSet: true,
              }),
            docs.size,
            NEW_CONNECTION_DEADLINE_MS,
            signal
          )
          assertViewRowsDefined(
            res,
            docs.size,
            env.ctx(viewCtx(bucketName, 'viewQuery', 'a second connection'))
          )
        }
      )

      test(
        'should receive results in ASC order',
        { timeout: VIEW_QUERY_TIMEOUT_MS },
        async ({ cluster, collection, collectionLease, env, signal }) => {
          const { docs, ddocKey } = await viewsFor(env, collection)
          const bucketName = collectionLease.bucketName
          const res = await viewUntilRows(
            () =>
              cluster.bucket(bucketName).viewQuery(ddocKey, 'simple', {
                namespace: DesignDocumentNamespace.Development,
                order: ViewOrdering.Ascending,
              }),
            docs.size,
            VIEW_QUERY_DEADLINE_MS,
            signal
          )
          assertViewRowOrder(
            res,
            docs.size,
            sortedDocIds(docs.ids),
            env.ctx(viewCtx(bucketName, 'viewQuery', 'ascending'))
          )
        }
      )

      test(
        'should receive results in DESC order',
        { timeout: VIEW_QUERY_TIMEOUT_MS },
        async ({ cluster, collection, collectionLease, env, signal }) => {
          const { docs, ddocKey } = await viewsFor(env, collection)
          const bucketName = collectionLease.bucketName
          const res = await viewUntilRows(
            () =>
              cluster.bucket(bucketName).viewQuery(ddocKey, 'simple', {
                namespace: DesignDocumentNamespace.Development,
                order: ViewOrdering.Descending,
              }),
            docs.size,
            VIEW_QUERY_DEADLINE_MS,
            signal
          )
          assertViewRowOrder(
            res,
            docs.size,
            sortedDocIds(docs.ids, true),
            env.ctx(viewCtx(bucketName, 'viewQuery', 'descending'))
          )
        }
      )

      test(
        'should receive results using endkey and endkey_docids',
        { timeout: VIEW_QUERY_TIMEOUT_MS },
        async ({ cluster, collection, collectionLease, env, signal }) => {
          const { docs, ddocKey } = await viewsFor(env, collection)
          const bucketName = collectionLease.bucketName

          const sorted = distinctUidKeys(docs.uid, KEY_SIZE).sort()
          // The range should return everything up to and including the
          // second smallest key.
          const key = sorted[1]
          const grouped = keysAndDocIds(docs.ids)
          const endKeyDocId = grouped[key][grouped[key].length - 1]
          const expected = grouped[sorted[0]].length + grouped[key].length

          const res = await viewUntilRows(
            () =>
              cluster.bucket(bucketName).viewQuery(ddocKey, 'simple', {
                namespace: DesignDocumentNamespace.Development,
                idRange: { end: endKeyDocId },
                range: { end: key },
              }),
            expected,
            VIEW_QUERY_DEADLINE_MS,
            signal
          )
          assertLastRow(
            res,
            expected,
            key,
            endKeyDocId,
            env.ctx(viewCtx(bucketName, 'viewQuery', 'endkey'))
          )
        }
      )

      test(
        'should receive results using startkey and startkey_docids',
        { timeout: VIEW_QUERY_TIMEOUT_MS },
        async ({ cluster, collection, collectionLease, env, signal }) => {
          const { docs, ddocKey } = await viewsFor(env, collection)
          const bucketName = collectionLease.bucketName
          const bucket = cluster.bucket(bucketName)

          const emitted = [...uidKeys(docs.uid, KEY_SIZE)]
          const sorted = [...emitted].sort()
          const key = emitted[emitted.indexOf(sorted[sorted.length - 1])]
          const grouped = keysAndDocIds(docs.ids)
          const startKeyDocId = grouped[key][grouped[key].length - 1]
          const expected = 1

          // Gives the pagination something to start from.
          await bucket.viewQuery(ddocKey, 'simple', {
            namespace: DesignDocumentNamespace.Development,
            limit: 2,
          })

          const res = await viewUntilRows(
            () =>
              bucket.viewQuery(ddocKey, 'simple', {
                namespace: DesignDocumentNamespace.Development,
                limit: 2,
                idRange: { start: startKeyDocId },
                range: { start: key },
              }),
            expected,
            VIEW_QUERY_DEADLINE_MS,
            signal
          )
          assertFirstRow(
            res,
            expected,
            key,
            startKeyDocId,
            env.ctx(viewCtx(bucketName, 'viewQuery', 'startkey'))
          )
        }
      )

      test(
        'should receive results using a specific key',
        { timeout: VIEW_QUERY_TIMEOUT_MS },
        async ({ cluster, collection, collectionLease, env, signal }) => {
          const { docs, ddocKey } = await viewsFor(env, collection)
          const bucketName = collectionLease.bucketName

          const key = [...uidKeys(docs.uid, KEY_SIZE)][0]
          const expectedDocIds = keysAndDocIds(docs.ids)[key]
          const expected = expectedDocIds.length

          const bucket = cluster.bucket(bucketName)
          const res = await viewUntilRows(
            () =>
              bucket.viewQuery<EmittedValue, string>(ddocKey, 'simple', {
                namespace: DesignDocumentNamespace.Development,
                key,
              }),
            expected,
            VIEW_QUERY_DEADLINE_MS,
            signal
          )
          assertRowsForKey(
            res,
            expected,
            key,
            expectedDocIds,
            env.ctx(viewCtx(bucketName, 'viewQuery', `key=${key}`))
          )
        }
      )

      test(
        'should receive results using a specific keys',
        { timeout: VIEW_QUERY_TIMEOUT_MS },
        async ({ cluster, collection, collectionLease, env, signal }) => {
          const { docs, ddocKey } = await viewsFor(env, collection)
          const bucketName = collectionLease.bucketName

          const keys = distinctUidKeys(docs.uid, KEY_SIZE).slice(0, 2)
          const grouped = keysAndDocIds(docs.ids)
          const expectedDocIds = grouped[keys[0]].concat(grouped[keys[1]])
          const expected = expectedDocIds.length

          const bucket = cluster.bucket(bucketName)
          const res = await viewUntilRows(
            () =>
              bucket.viewQuery<EmittedValue, string>(ddocKey, 'simple', {
                namespace: DesignDocumentNamespace.Development,
                keys,
              }),
            expected,
            VIEW_QUERY_DEADLINE_MS,
            signal
          )
          assertRowsForKeys(
            res,
            expected,
            keys,
            expectedDocIds,
            env.ctx(viewCtx(bucketName, 'viewQuery', `keys=${keys.join(',')}`))
          )
        }
      )

      test(
        'should receive results using raw option',
        { timeout: VIEW_QUERY_TIMEOUT_MS },
        async ({ cluster, collection, collectionLease, env, signal }) => {
          const { docs, ddocKey } = await viewsFor(env, collection)
          const bucketName = collectionLease.bucketName
          const bucket = cluster.bucket(bucketName)

          const emitted = [...uidKeys(docs.uid, KEY_SIZE)]
          const sorted = [...emitted].sort()
          const key = emitted[emitted.indexOf(sorted[sorted.length - 1])]
          const grouped = keysAndDocIds(docs.ids)
          const startKeyDocId = grouped[key][grouped[key].length - 1]
          const expected = 1

          // Gives the pagination something to start from.
          await bucket.viewQuery(ddocKey, 'simple', {
            namespace: DesignDocumentNamespace.Development,
            limit: 2,
          })

          const res = await viewUntilRows(
            () =>
              bucket.viewQuery(ddocKey, 'simple', {
                namespace: DesignDocumentNamespace.Development,
                raw: {
                  limit: '2',
                  startkey: JSON.stringify(key),
                  startkey_docid: startKeyDocId,
                  full_set: 'true',
                },
              }),
            expected,
            VIEW_QUERY_DEADLINE_MS,
            signal
          )
          assertFirstRow(
            res,
            expected,
            key,
            startKeyDocId,
            env.ctx(viewCtx(bucketName, 'viewQuery', 'raw'))
          )
        }
      )

      test('should correctly raise error when using incorrect raw option', async ({
        cluster,
        collection,
        collectionLease,
        env,
      }) => {
        const { docs, ddocKey } = await viewsFor(env, collection)
        const bucketName = collectionLease.bucketName

        const emitted = [...uidKeys(docs.uid, KEY_SIZE)]
        const sorted = [...emitted].sort()
        const key = emitted[emitted.indexOf(sorted[sorted.length - 1])]
        const grouped = keysAndDocIds(docs.ids)
        const startKeyDocId = grouped[key][grouped[key].length - 1]

        await expectThrows(
          () =>
            cluster.bucket(bucketName).viewQuery(ddocKey, 'simple', {
              namespace: DesignDocumentNamespace.Development,
              raw: {
                limit: '2',
                // Illegal JSON: this is the invalid argument under test.
                startkey: `"${key}`,
                startkey_docid: startKeyDocId,
                full_set: 'true',
              },
            }),
          InvalidArgumentError,
          undefined,
          env.ctx(viewCtx(bucketName, 'viewQuery', 'an unquoted raw startkey'))
        )
      })

      test('should successfully drop an index', async ({
        cluster,
        collection,
        collectionLease,
        env,
        signal,
      }) => {
        const { ddocKey } = await viewsFor(env, collection)
        const bucketName = collectionLease.bucketName
        await cluster
          .bucket(bucketName)
          .viewIndexes()
          .dropDesignDocument(ddocKey, DesignDocumentNamespace.Development)
        await env.protocol.waitUntilDesignDocumentDropped(
          bucketName,
          `dev_${ddocKey}`,
          { signal }
        )
      })
    })
  }
)
