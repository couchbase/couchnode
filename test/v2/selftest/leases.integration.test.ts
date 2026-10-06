// Leases against whatever the run is pointed at.
//
// `leases.test.ts` pins which management calls a strategy makes; these pin
// what only a server can answer: whether a new collection is visible to
// key-value yet, and whether a drop really takes its documents with it.

import { expect } from 'vitest'

import { DocumentNotFoundError } from '../../../lib/errors'
import { ServerFeature } from '../infra/capabilities'
import { gridDocCount } from '../infra/data/docs'
import { BucketLease } from '../infra/leases/bucket-lease'
import { acquireCollection } from '../infra/leases/collection-lease'
import { leaseStampMs, resourceName } from '../infra/naming'
import { CollectionStrategy } from '../infra/requirements'
import { defineSuite } from '../infra/suite'

defineSuite(
  'infra: collection lease',
  {
    collection: CollectionStrategy.Named,
    features: [ServerFeature.Collections, ServerFeature.KeyValue],
  },
  ({ test }) => {
    test('hands the suite a collection of its own', async ({
      collectionLease,
      collection,
      env,
    }) => {
      expect(collectionLease.route).toBe('collection')
      expect(leaseStampMs(collectionLease.scopeName)).not.toBeNull()
      expect(collectionLease.collectionName).not.toBe('_default')

      // A collection in the manifest is not yet one key-value will serve; the
      // lease waits for the difference.
      const key = env.key()
      await collection.upsert(key, { leased: true })
      expect((await collection.get(key)).content).toEqual({ leased: true })
    })

    test('gives every test in the suite the same collection', async ({
      collectionLease,
      env,
      requirements,
    }) => {
      // Memoised per suite, not per test. Acquiring per test would be a scope
      // create, two all-node waits and a key-value probe each time.
      expect(await env.collectionLeaseFor(requirements)).toBe(collectionLease)
      expect(collectionLease.collection.name).toBe(
        collectionLease.collectionName
      )
      expect(env.config.bucket).toBe(collectionLease.bucketName)
    })

    test('is empty on acquisition, even after a run left documents in it', async ({
      env,
      requirements,
      signal,
    }) => {
      // Why no suite needs to flush its bucket. A lease of this test's own,
      // so releasing it does not disturb the fixtures' one.
      const reqs = {
        ...requirements,
        suiteName: 'infra: collection lease (emptiness)',
        collection: CollectionStrategy.Named as const,
      }

      const first = await acquireCollection(env, reqs, { signal })
      const key = env.key()
      await first.collection.upsert(key, { survived: 'no' })
      expect((await first.collection.get(key)).content).toEqual({
        survived: 'no',
      })
      await first.release()

      const second = await acquireCollection(env, reqs, { signal })
      try {
        // A different name for the same suite, which is how the promise is
        // kept: nothing the first lease wrote can be under it.
        expect(second.scopeName).not.toBe(first.scopeName)
        await expect(second.collection.get(key)).rejects.toThrow(
          DocumentNotFoundError
        )
      } finally {
        await second.release()
      }
    })

    test('leaves no scope behind when it is released', async ({
      env,
      requirements,
      signal,
    }) => {
      const reqs = {
        ...requirements,
        suiteName: 'infra: collection lease (teardown)',
        collection: CollectionStrategy.Named as const,
      }

      const lease = await acquireCollection(env, reqs, { signal })
      const scopes = await env.bucket.collections().getAllScopes()
      expect(scopes.map((s) => s.name)).toContain(lease.scopeName)

      await lease.release()

      const after = await env.bucket.collections().getAllScopes()
      expect(after.map((s) => s.name)).not.toContain(lease.scopeName)
    })
  }
)

defineSuite(
  'infra: collection lease under repetition',
  {
    collection: CollectionStrategy.DefaultCollection,
    features: [ServerFeature.Collections, ServerFeature.KeyValue],
    tier: 'nightly',
  },
  ({ test }) => {
    test('acquires and releases twenty times without leaking', async ({
      env,
      requirements,
      signal,
    }) => {
      // Twenty cycles, so a release that returns before its drop propagates
      // leaves a visible pile of listed scopes.
      const reqs = {
        ...requirements,
        suiteName: 'infra: lease cycles',
        collection: CollectionStrategy.Named as const,
      }

      const released: string[] = []
      for (let cycle = 0; cycle < 20; ++cycle) {
        const lease = await acquireCollection(env, reqs, { signal })
        await lease.collection.upsert(env.key(), { cycle })
        await lease.release()
        released.push(lease.scopeName)
      }

      const scopes = await env.bucket.collections().getAllScopes()
      const left = scopes.map((s) => s.name)
      expect(released.filter((name) => left.includes(name))).toEqual([])
    }, 300_000)
  }
)

defineSuite(
  'infra: bucket lease',
  {
    features: [ServerFeature.BucketManagement, ServerFeature.KeyValue],
    tier: 'nightly',
  },
  ({ test }) => {
    test('creates a bucket, waits until it answers, and drops it', async ({
      env,
      signal,
    }) => {
      // The reason this needs to be a lease: a drop in an `after` hook leaves
      // the bucket for every later run when a suite fails early.
      const lease = await BucketLease.acquire(env, 'infra: bucket lease', {
        signal,
      })
      try {
        const key = env.key()
        await lease.defaultCollection.upsert(key, { ok: true })
        expect((await lease.defaultCollection.get(key)).content).toEqual({
          ok: true,
        })
      } finally {
        await lease.release()
      }

      const buckets = await env.cluster.buckets().getAllBuckets()
      expect(buckets.map((b) => b.name)).not.toContain(lease.bucketName)
    }, 180_000)
  }
)

defineSuite(
  'infra: clean default collection lease',
  {
    collection: CollectionStrategy.CleanDefault,
    features: [ServerFeature.BucketManagement, ServerFeature.KeyValue],
    tier: 'nightly',
  },
  ({ test }) => {
    test('hands back the default collection of a bucket of its own', async ({
      collectionLease,
      collection,
      env,
    }) => {
      // The distinguishing property: `_default._default`, as the strategy's
      // name says, but not the one every DefaultCollection suite shares.
      expect(collectionLease.route).toBe('clean-default-bucket')
      expect(collectionLease.scopeName).toBe('_default')
      expect(collectionLease.collectionName).toBe('_default')
      expect(collectionLease.bucketName).not.toBe(env.config.bucket)
      expect(collectionLease.bucketName).toBe(
        resourceName('bucket', 'infra: clean default collection lease')
      )

      const key = env.key()
      await collection.upsert(key, { leased: true })
      expect((await collection.get(key)).content).toEqual({ leased: true })
    }, 180_000)

    test('is empty on acquisition, even after a run left documents in it', async ({
      env,
      requirements,
      signal,
    }) => {
      // Why `BucketLease` has `clean`: bucket names are deterministic per
      // (suite, worker), so without the pre-create drop the second
      // acquisition reuses the first bucket and its documents.
      const reqs = {
        ...requirements,
        suiteName: 'infra: clean default lease (emptiness)',
        collection: CollectionStrategy.CleanDefault as const,
      }

      const first = await acquireCollection(env, reqs, { signal })
      const key = env.key()
      await first.collection.upsert(key, { survived: 'no' })
      expect((await first.collection.get(key)).content).toEqual({
        survived: 'no',
      })
      // Not released: the case being pinned is a run that died
      // before its release, which is when reuse would happen.

      const second = await acquireCollection(env, reqs, { signal })
      try {
        expect(second.bucketName).toBe(first.bucketName)
        await expect(second.collection.get(key)).rejects.toThrow(
          DocumentNotFoundError
        )
      } finally {
        await second.release()
      }
    }, 300_000)
  }
)

defineSuite(
  'infra: document batch',
  {
    collection: CollectionStrategy.Named,
    docs: {},
    features: [ServerFeature.Collections, ServerFeature.KeyValue],
  },
  ({ test }) => {
    test('loads the grid into the leased collection', async ({
      docs,
      collection,
    }) => {
      expect(docs.size).toBe(gridDocCount())

      const first = await collection.get(docs.ids[0])
      expect(first.content).toMatchObject({
        x: 0,
        y: 0,
        name: 'x0,y0',
        testUid: docs.uid,
      })
    })

    test('is the same batch for every test in the suite', async ({ docs }) => {
      // Loaded once per file and purged with the env, not per test.
      expect(docs.ids[0].startsWith(docs.uid)).toBe(true)
    })
  }
)
