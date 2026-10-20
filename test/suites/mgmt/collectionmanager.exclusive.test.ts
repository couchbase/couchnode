import { expect } from 'vitest'

import type { Bucket } from '../../../lib/bucket'
import { StorageBackend } from '../../../lib/bucketmanager'
import type {
  CollectionManager,
  CollectionSpec,
  ScopeSpec,
} from '../../../lib/collectionmanager'
import {
  CollectionExistsError,
  CollectionNotFoundError,
  FeatureNotAvailableError,
  InvalidArgumentError,
  ScopeExistsError,
  ScopeNotFoundError,
} from '../../../lib/errors'
import { AssertCtx, withCtx } from '../../asserts/ctx'
import { expectDefined } from '../../asserts/defined'
import { expectThrows } from '../../asserts/errors'
import { awaitCallback } from '../../infra/callbacks'
import { ServerFeature } from '../../infra/capabilities'
import { limits } from '../../infra/limitations'
import { TestEnv } from '../../infra/env'
import { BucketLease } from '../../infra/leases/bucket-lease'
import { PollTimeoutError, pollUntil } from '../../infra/retry'
import { defineSuite } from '../../infra/suite'

// One ordered story in the shared bucket (create a scope, create and drop
// collections in it, read their settings back, drop the scope), relying on
// Vitest running a file's tests in declaration order. Then four tests that
// need buckets with particular storage backends.
//
// The scope's drop is registered when its name is handed out, so it runs even
// if the story fails; a leftover scope fails the next run with
// `ScopeExistsError`.
//
// `exclusive` because it creates buckets, and a cluster serializes bucket
// lifecycle operations cluster-wide.

const CREATE_TIMEOUT_MS = 4000
const OPTIONS_TIMEOUT_MS = 5000
/** How long an update has to reach the node a read lands on. */
const SETTLE_DEADLINE_MS = 10_000

/** Magma's smallest legal bucket quota. */
const MAGMA_QUOTA_MB = 1024
/** Enough for a couchstore bucket that never holds a document. */
const COUCHSTORE_QUOTA_MB = 128

/**
 * Creating a bucket and waiting for it to answer key-value requests has a
 * minute's allowance of its own, and a runner timeout below that would replace
 * the wait's message with nothing.
 */
const BUCKET_TEST_TIMEOUT_MS = 120_000

interface Names {
  readonly scope: string
  readonly collection: string
}

let names: Names | undefined

function namesFor(env: TestEnv, bucket: Bucket): Names {
  if (names) {
    return names
  }
  const created: Names = { scope: env.key(), collection: env.key() }
  names = created

  // GoCAVES reports a missing scope in a body that is not JSON, so the core
  // raises `unsupported_operation` rather than `ScopeNotFoundError`. Thrown
  // here, outside any test, that fails the whole file, so on that backend the
  // teardown discards the error. Every other target still raises it.
  const unclassifiable = limits(
    env.capabilities,
    'gocaves-scope-error-classification'
  )

  env.registerCleanup(async () => {
    try {
      await bucket.collections().dropScope(created.scope)
    } catch (err) {
      // The story's own second to last test drops it, and that is a pass.
      if (!unclassifiable && !(err instanceof ScopeNotFoundError)) {
        throw err
      }
      return
    }
    await env.protocol.waitUntilScopeDropped(bucket.name, created.scope)
  })

  return created
}

function scopeCtx(bucketName: string, op: string, extra?: string): AssertCtx {
  return {
    op,
    bucket: bucketName,
    ...(extra === undefined ? {} : { extra }),
  }
}

/** The scope of that name, asserted to be there. */
function findScope(
  scopes: readonly ScopeSpec[],
  scopeName: string,
  c: AssertCtx
): ScopeSpec {
  const found = scopes.find((s) => s.name === scopeName)
  expectDefined(found, withCtx(`scope ${scopeName} in getAllScopes`, c))
  return found
}

/** The collection of that name within that scope, asserted to be there. */
function findCollection(
  scopes: readonly ScopeSpec[],
  scopeName: string,
  collectionName: string,
  c: AssertCtx
): CollectionSpec {
  const scope = findScope(scopes, scopeName, c)
  const found = scope.collections.find((v) => v.name === collectionName)
  expectDefined(
    found,
    withCtx(`collection ${collectionName} in scope ${scopeName}`, c)
  )
  return found
}

/**
 * The collection's spec once `settled` holds for it. An update returns before
 * every node serves the new manifest, so one read can see the old settings. At
 * the deadline the last spec read is returned, for the caller's assert to
 * report.
 */
async function settledCollection(
  manager: CollectionManager,
  scopeName: string,
  collectionName: string,
  settled: (spec: CollectionSpec) => boolean,
  c: AssertCtx
): Promise<CollectionSpec> {
  let last: CollectionSpec | undefined
  try {
    return await pollUntil(
      `collection ${scopeName}.${collectionName} to show its update`,
      async () => {
        last = findCollection(
          await manager.getAllScopes(),
          scopeName,
          collectionName,
          c
        )
        return settled(last) ? last : undefined
      },
      { deadlineMs: SETTLE_DEADLINE_MS }
    )
  } catch (err) {
    if (err instanceof PollTimeoutError && last) {
      return last
    }
    throw err
  }
}

/**
 * Creates a collection, waits for every node to see it, and drops it again,
 * leaving the scope as the next test expects it. The callback-overload tests
 * assert only that the SDK accepts their argument shapes.
 */
async function createAndDrop(
  env: TestEnv,
  manager: CollectionManager,
  bucketName: string,
  scopeName: string,
  collectionName: string,
  create: () => Promise<void>
): Promise<void> {
  await create()
  await env.protocol.waitUntilCollectionPresent(
    bucketName,
    scopeName,
    collectionName
  )
  await manager.dropCollection(collectionName, scopeName)
  await env.protocol.waitUntilCollectionDropped(
    bucketName,
    scopeName,
    collectionName
  )
}

defineSuite(
  '#collectionmanager',
  { features: [ServerFeature.Collections] },
  ({ test, lacking, limited }) => {
    // GoCAVES reports a missing scope or collection in a body the client
    // cannot parse. A function because calling `limited` records the skip.
    const noNotFound = () => limited('gocaves-scope-error-classification')

    test('should successfully create a scope', async ({ env }) => {
      const { scope } = namesFor(env, env.bucket)
      await env.bucket.collections().createScope(scope)
      await env.protocol.waitUntilScopePresent(env.bucket.name, scope)
    })

    test('should emit the correct error on duplicate scopes', async ({
      env,
    }) => {
      const { scope } = namesFor(env, env.bucket)
      await expectThrows(
        () => env.bucket.collections().createScope(scope),
        ScopeExistsError,
        undefined,
        env.ctx(scopeCtx(env.bucket.name, 'createScope', `scope=${scope}`))
      )
    })

    test('should successfully create a collection', async ({ env }) => {
      const { scope, collection } = namesFor(env, env.bucket)
      await env.bucket
        .collections()
        .createCollection(collection, scope, { timeout: CREATE_TIMEOUT_MS })
      await env.protocol.waitUntilCollectionPresent(
        env.bucket.name,
        scope,
        collection
      )
    })

    test('should emit the correct error on duplicate collections', async ({
      env,
    }) => {
      const { scope, collection } = namesFor(env, env.bucket)
      await expectThrows(
        () => env.bucket.collections().createCollection(collection, scope),
        CollectionExistsError,
        undefined,
        env.ctx(
          scopeCtx(
            env.bucket.name,
            'createCollection',
            `duplicate ${collection}`
          )
        )
      )
    })

    test.skipIf(noNotFound())(
      'should emit the correct error on missing scopes',
      async ({ env }) => {
        await expectThrows(
          () =>
            env.bucket
              .collections()
              .createCollection('some-scope-for-testing', 'invalid-scope'),
          ScopeNotFoundError,
          undefined,
          env.ctx(
            scopeCtx(env.bucket.name, 'createCollection', 'scope=invalid-scope')
          )
        )
      }
    )

    test('should successfully fetch all scopes', async ({ env }) => {
      const { scope, collection } = namesFor(env, env.bucket)
      const c = env.ctx(scopeCtx(env.bucket.name, 'getAllScopes'))
      const scopes = await env.bucket.collections().getAllScopes()
      findCollection(scopes, scope, collection, c)
    })

    test('should successfully drop a collection', async ({ env }) => {
      const { scope, collection } = namesFor(env, env.bucket)
      await env.bucket.collections().dropCollection(collection, scope)
      await env.protocol.waitUntilCollectionDropped(
        env.bucket.name,
        scope,
        collection
      )
    })

    // Regression guard (JSCBC-1479): the drop path against a missing scope.
    test.skipIf(noNotFound())(
      'should fail to drop a collection from a missing scope',
      async ({ env }) => {
        const { collection } = namesFor(env, env.bucket)
        await expectThrows(
          () =>
            env.bucket
              .collections()
              .dropCollection(collection, 'invalid-scope'),
          ScopeNotFoundError,
          undefined,
          env.ctx(
            scopeCtx(env.bucket.name, 'dropCollection', 'scope=invalid-scope')
          )
        )
      }
    )

    test.skipIf(noNotFound())(
      'should fail to drop a missing collection',
      async ({ env }) => {
        const { scope, collection } = namesFor(env, env.bucket)
        await expectThrows(
          () => env.bucket.collections().dropCollection(collection, scope),
          CollectionNotFoundError,
          undefined,
          env.ctx(
            scopeCtx(env.bucket.name, 'dropCollection', `missing ${collection}`)
          )
        )
      }
    )

    test('should successfully create a collection with a collection spec', async ({
      env,
    }) => {
      const { scope, collection } = namesFor(env, env.bucket)
      const manager = env.bucket.collections()
      await createAndDrop(
        env,
        manager,
        env.bucket.name,
        scope,
        collection,
        () =>
          manager.createCollection(
            { name: collection, scopeName: scope, maxExpiry: 3 },
            { timeout: CREATE_TIMEOUT_MS }
          )
      )
    })

    // Which argument shapes `createCollection` accepts. The callback settles
    // the wait; `awaitCallback` moves a failed assertion back into the test
    // body instead of letting it escape into the SDK's promise chain.
    test('should should successfully create a collection with callback', async ({
      env,
    }) => {
      const { scope } = namesFor(env, env.bucket)
      const manager = env.bucket.collections()
      const collection = env.key()
      await createAndDrop(
        env,
        manager,
        env.bucket.name,
        scope,
        collection,
        () =>
          awaitCallback<void>((cb) =>
            manager.createCollection(collection, scope, { maxExpiry: 3 }, cb)
          )
      )
    })

    test('should should successfully create a collection with callback and options', async ({
      env,
    }) => {
      const { scope } = namesFor(env, env.bucket)
      const manager = env.bucket.collections()
      const collection = env.key()
      await createAndDrop(
        env,
        manager,
        env.bucket.name,
        scope,
        collection,
        () =>
          awaitCallback<void>((cb) =>
            manager.createCollection(
              collection,
              scope,
              { maxExpiry: 3 },
              { timeout: OPTIONS_TIMEOUT_MS },
              cb
            )
          )
      )
    })

    test('should should successfully create a collection with callback and options no settings', async ({
      env,
    }) => {
      const { scope } = namesFor(env, env.bucket)
      const manager = env.bucket.collections()
      const collection = env.key()
      await createAndDrop(
        env,
        manager,
        env.bucket.name,
        scope,
        collection,
        () =>
          awaitCallback<void>((cb) =>
            manager.createCollection(
              collection,
              scope,
              { timeout: OPTIONS_TIMEOUT_MS },
              cb
            )
          )
      )
    })

    test('should should successfully create a collection with callback no settings', async ({
      env,
    }) => {
      const { scope } = namesFor(env, env.bucket)
      const manager = env.bucket.collections()
      const collection = env.key()
      await createAndDrop(
        env,
        manager,
        env.bucket.name,
        scope,
        collection,
        () =>
          awaitCallback<void>((cb) =>
            manager.createCollection(collection, scope, cb)
          )
      )
    })

    test('should successfully create a collection with callback deprecated API', async ({
      env,
    }) => {
      const { scope } = namesFor(env, env.bucket)
      const manager = env.bucket.collections()
      const collection = env.key()
      await createAndDrop(
        env,
        manager,
        env.bucket.name,
        scope,
        collection,
        () =>
          awaitCallback<void>((cb) =>
            manager.createCollection({ name: collection, scopeName: scope }, cb)
          )
      )
    })

    test('should successfully create a collection with callback and options deprecated API', async ({
      env,
    }) => {
      const { scope } = namesFor(env, env.bucket)
      const manager = env.bucket.collections()
      const collection = env.key()
      await createAndDrop(
        env,
        manager,
        env.bucket.name,
        scope,
        collection,
        () =>
          awaitCallback<void>((cb) =>
            manager.createCollection(
              { name: collection, scopeName: scope },
              { timeout: OPTIONS_TIMEOUT_MS },
              cb
            )
          )
      )
    })

    test('should successfully create a collection with settings', async ({
      env,
    }) => {
      const { scope, collection } = namesFor(env, env.bucket)
      const c = env.ctx(
        scopeCtx(env.bucket.name, 'createCollection', 'maxExpiry=3')
      )
      await env.bucket
        .collections()
        .createCollection(collection, scope, { maxExpiry: 3 })
      await env.protocol.waitUntilCollectionPresent(
        env.bucket.name,
        scope,
        collection
      )

      const scopes = await env.bucket.collections().getAllScopes()
      const found = findCollection(scopes, scope, collection, c)
      expect(found.maxExpiry, withCtx('maxExpiry', c)).toStrictEqual(3)
    })

    // Gated per test, not per block: a nested describe would change the full
    // title of every test beneath it.
    test.skipIf(lacking(ServerFeature.UpdateCollectionMaxExpiry))(
      'should successfully update a collection',
      async ({ env }) => {
        const { scope, collection } = namesFor(env, env.bucket)
        const c = env.ctx(
          scopeCtx(env.bucket.name, 'updateCollection', 'maxExpiry=1')
        )
        const manager = env.bucket.collections()
        await manager.updateCollection(collection, scope, { maxExpiry: 1 })

        const found = await settledCollection(
          manager,
          scope,
          collection,
          (spec) => spec.maxExpiry === 1,
          c
        )
        expect(found.maxExpiry, withCtx('maxExpiry', c)).toStrictEqual(1)
      }
    )

    const noNegativeExpiry = lacking(ServerFeature.NegativeCollectionMaxExpiry)

    test.skipIf(noNegativeExpiry)(
      'should successfully create a collection with default max expiry',
      async ({ env }) => {
        const { scope } = namesFor(env, env.bucket)
        const collection = env.key()
        const c = env.ctx(
          scopeCtx(env.bucket.name, 'createCollection', 'settings={}')
        )
        await env.bucket.collections().createCollection(collection, scope, {})
        await env.protocol.waitUntilCollectionPresent(
          env.bucket.name,
          scope,
          collection
        )

        const scopes = await env.bucket.collections().getAllScopes()
        const found = findCollection(scopes, scope, collection, c)
        expect(found.maxExpiry, withCtx('maxExpiry', c)).toStrictEqual(0)
      }
    )

    test.skipIf(noNegativeExpiry)(
      'should successfully create a collection with no expiry',
      async ({ env }) => {
        const { scope } = namesFor(env, env.bucket)
        const collection = env.key()
        const c = env.ctx(
          scopeCtx(env.bucket.name, 'createCollection', 'maxExpiry=-1')
        )
        await env.bucket
          .collections()
          .createCollection(collection, scope, { maxExpiry: -1 })
        await env.protocol.waitUntilCollectionPresent(
          env.bucket.name,
          scope,
          collection
        )

        const scopes = await env.bucket.collections().getAllScopes()
        const found = findCollection(scopes, scope, collection, c)
        expect(found.maxExpiry, withCtx('maxExpiry', c)).toStrictEqual(-1)
      }
    )

    test.skipIf(noNegativeExpiry)(
      'should fail to create a collection with invalid expiry',
      async ({ env }) => {
        const { scope } = namesFor(env, env.bucket)
        const collection = env.key()
        await expectThrows(
          () =>
            env.bucket
              .collections()
              .createCollection(collection, scope, { maxExpiry: -20 }),
          InvalidArgumentError,
          undefined,
          env.ctx(
            scopeCtx(env.bucket.name, 'createCollection', 'maxExpiry=-20')
          )
        )
      }
    )

    test.skipIf(noNegativeExpiry)(
      'should successfully update a collection with default max expiry',
      async ({ env }) => {
        const { scope } = namesFor(env, env.bucket)
        const collection = env.key()
        const manager = env.bucket.collections()
        const c = env.ctx(
          scopeCtx(env.bucket.name, 'updateCollection', 'maxExpiry 5 to 0')
        )

        await manager.createCollection(collection, scope, { maxExpiry: 5 })
        await env.protocol.waitUntilCollectionPresent(
          env.bucket.name,
          scope,
          collection
        )
        expect(
          findCollection(await manager.getAllScopes(), scope, collection, c)
            .maxExpiry,
          withCtx('maxExpiry as created', c)
        ).toStrictEqual(5)

        await manager.updateCollection(collection, scope, { maxExpiry: 0 })
        const updated = await settledCollection(
          manager,
          scope,
          collection,
          (spec) => spec.maxExpiry === 0,
          c
        )
        expect(
          updated.maxExpiry,
          withCtx('maxExpiry as updated', c)
        ).toStrictEqual(0)
      }
    )

    test.skipIf(noNegativeExpiry)(
      'should successfully update a collection with no expiry',
      async ({ env }) => {
        const { scope } = namesFor(env, env.bucket)
        const collection = env.key()
        const manager = env.bucket.collections()
        const c = env.ctx(
          scopeCtx(env.bucket.name, 'updateCollection', 'maxExpiry 0 to -1')
        )

        await manager.createCollection(collection, scope, {})
        await env.protocol.waitUntilCollectionPresent(
          env.bucket.name,
          scope,
          collection
        )
        expect(
          findCollection(await manager.getAllScopes(), scope, collection, c)
            .maxExpiry,
          withCtx('maxExpiry as created', c)
        ).toStrictEqual(0)

        await manager.updateCollection(collection, scope, { maxExpiry: -1 })
        const updated = await settledCollection(
          manager,
          scope,
          collection,
          (spec) => spec.maxExpiry === -1,
          c
        )
        expect(
          updated.maxExpiry,
          withCtx('maxExpiry as updated', c)
        ).toStrictEqual(-1)
      }
    )

    test.skipIf(noNegativeExpiry)(
      'should fail to update a collection with invalid expiry',
      async ({ env }) => {
        const { scope, collection } = namesFor(env, env.bucket)
        await expectThrows(
          () =>
            env.bucket
              .collections()
              .updateCollection(collection, scope, { maxExpiry: -20 }),
          InvalidArgumentError,
          undefined,
          env.ctx(
            scopeCtx(env.bucket.name, 'updateCollection', 'maxExpiry=-20')
          )
        )
      }
    )

    test('should successfully drop a scope', async ({ env }) => {
      const { scope } = namesFor(env, env.bucket)
      await env.bucket.collections().dropScope(scope)
      await env.protocol.waitUntilScopeDropped(env.bucket.name, scope)
    })

    test.skipIf(noNotFound())(
      'should fail to drop a missing scope',
      async ({ env }) => {
        const { scope } = namesFor(env, env.bucket)
        await expectThrows(
          () => env.bucket.collections().dropScope(scope),
          ScopeNotFoundError,
          undefined,
          env.ctx(scopeCtx(env.bucket.name, 'dropScope', `missing ${scope}`))
        )
      }
    )

    // History is a magma feature: a couchstore bucket must refuse it and a
    // magma bucket must take it. A lease derives its bucket name from its
    // label, so each backend has a label of its own.
    const noHistory = lacking(ServerFeature.BucketDedup)

    const COUCHSTORE_LEASE = '#collectionmanager couchstore'
    const MAGMA_LEASE = '#collectionmanager magma'

    test.skipIf(noHistory)(
      'should fail to create a collection with history on a couchstore bucket',
      async ({ env, signal }) => {
        const { scope, collection } = namesFor(env, env.bucket)
        const lease = await BucketLease.acquire(env, COUCHSTORE_LEASE, {
          ramQuotaMB: COUCHSTORE_QUOTA_MB,
          storageBackend: StorageBackend.Couchstore,
          signal,
        })
        const c = env.ctx(
          scopeCtx(lease.bucketName, 'createCollection', 'history=true')
        )

        const settings = await env.cluster.buckets().getBucket(lease.bucketName)
        expect(settings, withCtx('the leased bucket', c)).toBeTruthy()

        const manager = lease.bucket.collections()
        await manager.createScope(scope)
        await env.protocol.waitUntilScopePresent(lease.bucketName, scope)

        await expectThrows(
          () => manager.createCollection(collection, scope, { history: true }),
          FeatureNotAvailableError,
          undefined,
          c
        )
      },
      BUCKET_TEST_TIMEOUT_MS
    )

    test.skipIf(noHistory)(
      'should fail to update a collection with history on a couchstore bucket',
      async ({ env, signal }) => {
        const { scope, collection } = namesFor(env, env.bucket)
        // The same label, so this resolves to the bucket the test above
        // created and waits for it rather than making a second one.
        const lease = await BucketLease.acquire(env, COUCHSTORE_LEASE, {
          ramQuotaMB: COUCHSTORE_QUOTA_MB,
          storageBackend: StorageBackend.Couchstore,
          signal,
        })
        const manager = lease.bucket.collections()

        await manager.createCollection(collection, scope)
        await env.protocol.waitUntilCollectionPresent(
          lease.bucketName,
          scope,
          collection
        )

        await expectThrows(
          () => manager.updateCollection(collection, scope, { history: true }),
          FeatureNotAvailableError,
          undefined,
          env.ctx(
            scopeCtx(lease.bucketName, 'updateCollection', 'history=true')
          )
        )

        // Released now rather than at teardown: a magma bucket is created
        // next, and holding both is more memory than a modest cluster has.
        await lease.release()
      },
      BUCKET_TEST_TIMEOUT_MS
    )

    test.skipIf(noHistory)(
      'should successfully create a collection with history',
      async ({ env, signal }) => {
        const { scope, collection } = namesFor(env, env.bucket)
        const lease = await BucketLease.acquire(env, MAGMA_LEASE, {
          ramQuotaMB: MAGMA_QUOTA_MB,
          storageBackend: StorageBackend.Magma,
          signal,
        })
        const c = env.ctx(
          scopeCtx(lease.bucketName, 'createCollection', 'history=true')
        )

        const settings = await env.cluster.buckets().getBucket(lease.bucketName)
        expect(settings, withCtx('the leased bucket', c)).toBeTruthy()

        const manager = lease.bucket.collections()
        await manager.createScope(scope)
        await env.protocol.waitUntilScopePresent(lease.bucketName, scope)

        await manager.createCollection(collection, scope, { history: true })
        await env.protocol.waitUntilCollectionPresent(
          lease.bucketName,
          scope,
          collection
        )

        const found = findCollection(
          await manager.getAllScopes(),
          scope,
          collection,
          c
        )
        expect(found.history, withCtx('history', c)).toBe(true)
      },
      BUCKET_TEST_TIMEOUT_MS
    )

    test.skipIf(noHistory)(
      'should successfully update a collection with history',
      async ({ env, signal }) => {
        const { scope, collection } = namesFor(env, env.bucket)
        const lease = await BucketLease.acquire(env, MAGMA_LEASE, {
          ramQuotaMB: MAGMA_QUOTA_MB,
          storageBackend: StorageBackend.Magma,
          signal,
        })
        const c = env.ctx(
          scopeCtx(lease.bucketName, 'updateCollection', 'history=false')
        )
        const manager = lease.bucket.collections()

        await manager.updateCollection(collection, scope, { history: false })

        const found = await settledCollection(
          manager,
          scope,
          collection,
          (spec) => spec.history === false,
          c
        )
        expect(found.history, withCtx('history', c)).toBe(false)

        await lease.release()
      },
      BUCKET_TEST_TIMEOUT_MS
    )
  }
)
