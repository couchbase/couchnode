import { expect } from 'vitest'

import type {
  BucketManager,
  BucketSettings,
} from '../../../../lib/bucketmanager'
import {
  BucketType,
  CompressionMode,
  EvictionPolicy,
  StorageBackend,
} from '../../../../lib/bucketmanager'
import { DurabilityLevel } from '../../../../lib/generaltypes'
import {
  BucketExistsError,
  BucketNotFoundError,
  CouchbaseError,
  InvalidArgumentError,
} from '../../../../lib/errors'
import { AssertCtx, withCtx } from '../../asserts/ctx'
import { expectThrows } from '../../asserts/errors'
import { ServerFeature } from '../../infra/capabilities'
import { TestEnv } from '../../infra/env'
import { tryNTimes } from '../../infra/retry'
import { defineSuite } from '../../infra/suite'

// The bucket manager is the subject, so buckets are created and dropped
// through it rather than through a lease. Vitest runs a file's tests in
// declaration order: create, read back, flush, update, drop, fail to drop.
//
// Removal is registered as each name is handed out, because a leftover bucket
// fails the next run with `BucketExistsError` and starves the memory quota.
//
// From server 8.0 a new bucket defaults to magma and full eviction. No
// capability describes a default, so this checks a version, not a feature.
//
// `exclusive` because bucket lifecycle operations serialize cluster-wide.

const QUOTA_MB = 256
/** Also magma's smallest legal quota. */
const LARGE_QUOTA_MB = 1024

const HISTORY_BYTES = 2147483648
const HISTORY_DURATION_S = 13000
const UPDATED_HISTORY_DURATION_S = 14000

/** A flush can be refused while the bucket is still warming up. */
const FLUSH_ATTEMPTS = 5
const FLUSH_DELAY_MS = 1000

const BUCKET_TEST_TIMEOUT_MS = 120_000

const MISSING_BUCKET = 'invalid-bucket'

const VBUCKETS = 1024
/** Server 8.0 creates buckets with fewer. */
const VBUCKETS_8_0 = 128

interface Names {
  readonly main: string
  readonly magma: string
  /** Couchstore, for the one 8.0 case that needs a second one. */
  readonly couchstore: string
}

let names: Names | undefined

/** Each name's removal is registered when the name is handed out. */
function namesFor(env: TestEnv, manager: BucketManager): Names {
  if (names) {
    return names
  }
  const created: Names = {
    main: env.key(),
    magma: env.key(),
    couchstore: env.key(),
  }
  names = created

  for (const name of [created.main, created.magma, created.couchstore]) {
    env.registerCleanup(async () => {
      try {
        await manager.dropBucket(name)
      } catch (err) {
        // Usually a test has already dropped it.
        if (!(err instanceof BucketNotFoundError)) {
          throw err
        }
        return
      }
      await env.protocol.waitUntilBucketDropped(name)
    })
  }

  return created
}

function bucketCtx(name: string, op: string, extra?: string): AssertCtx {
  return { op, bucket: name, ...(extra === undefined ? {} : { extra }) }
}

/**
 * Spread to a plain object so `toStrictEqual` can be used: it distinguishes a
 * present `undefined` field from an absent one, which half these expectations
 * are about, but also insists on a matching prototype. The deprecated accessors
 * are prototype getters, so the spread leaves them out.
 */
function fieldsOf(settings: BucketSettings): Record<string, unknown> {
  return { ...settings }
}

function expectedCouchstore(
  env: TestEnv,
  name: string,
  flushEnabled: boolean,
  ramQuotaMB: number,
  replicaIndexes: boolean | undefined
): Record<string, unknown> {
  return {
    name,
    flushEnabled,
    ramQuotaMB,
    numReplicas: 1,
    replicaIndexes,
    bucketType: BucketType.Couchbase,
    storageBackend: env.supports(ServerFeature.StorageBackend)
      ? StorageBackend.Couchstore
      : undefined,
    evictionPolicy: EvictionPolicy.ValueOnly,
    maxExpiry: 0,
    compressionMode: CompressionMode.Passive,
    minimumDurabilityLevel: DurabilityLevel.None,
    historyRetentionCollectionDefault: undefined,
    historyRetentionBytes: undefined,
    historyRetentionDuration: undefined,
    numVBuckets: env.supports(ServerFeature.NumVbucketsSetting)
      ? VBUCKETS
      : undefined,
  }
}

/** A bucket created without naming a backend. */
function expectedDefaultBackend(
  env: TestEnv,
  name: string,
  flushEnabled: boolean,
  ramQuotaMB: number,
  replicaIndexes: boolean | undefined
): Record<string, unknown> {
  const expected = expectedCouchstore(
    env,
    name,
    flushEnabled,
    ramQuotaMB,
    replicaIndexes
  )

  if (env.versionAtLeast(8)) {
    // Magma and full eviction are the defaults from 8.0.
    expected.storageBackend = StorageBackend.Magma
    expected.evictionPolicy = EvictionPolicy.FullEviction
    expected.historyRetentionCollectionDefault = true
    expected.historyRetentionBytes = 0
    expected.historyRetentionDuration = 0
    expected.replicaIndexes = undefined
    expected.numVBuckets = VBUCKETS_8_0
  }

  return expected
}

function expectedMagma(
  env: TestEnv,
  name: string,
  historyDefault: boolean,
  historyBytes: number,
  historyDuration: number
): Record<string, unknown> {
  return {
    name,
    bucketType: BucketType.Couchbase,
    compressionMode: CompressionMode.Passive,
    evictionPolicy: EvictionPolicy.FullEviction,
    flushEnabled: false,
    maxExpiry: 0,
    minimumDurabilityLevel: DurabilityLevel.None,
    numReplicas: 1,
    replicaIndexes: undefined,
    ramQuotaMB: LARGE_QUOTA_MB,
    storageBackend: StorageBackend.Magma,
    historyRetentionCollectionDefault: historyDefault,
    historyRetentionBytes: historyBytes,
    historyRetentionDuration: historyDuration,
    numVBuckets: env.supports(ServerFeature.NumVbucketsSetting)
      ? env.versionAtLeast(8)
        ? VBUCKETS_8_0
        : VBUCKETS
      : undefined,
  }
}

defineSuite(
  '#bucketmanager',
  { features: [ServerFeature.BucketManagement] },
  ({ test, lacking, limited }) => {
    // Functions rather than booleans because calling `limited` records the
    // skip.
    const alwaysSucceeds = () =>
      limited('gocaves-bucket-create-drop-always-succeed')
    const noRoundTrip = () => limited('gocaves-bucket-settings-roundtrip')

    const noHistory = lacking(ServerFeature.BucketDedup)

    test(
      'should successfully create a bucket',
      async ({ cluster, env }) => {
        const manager = cluster.buckets()
        const { main } = namesFor(env, manager)
        await manager.createBucket({
          name: main,
          flushEnabled: true,
          ramQuotaMB: QUOTA_MB,
        })
        await env.protocol.waitUntilBucketPresent(main)
      },
      BUCKET_TEST_TIMEOUT_MS
    )

    test.skipIf(alwaysSucceeds())(
      'should emit the correct error on duplicate buckets',
      async ({ cluster, env }) => {
        const manager = cluster.buckets()
        const { main } = namesFor(env, manager)
        await expectThrows(
          () => manager.createBucket({ name: main, ramQuotaMB: QUOTA_MB }),
          BucketExistsError,
          undefined,
          env.ctx(bucketCtx(main, 'createBucket', 'duplicate'))
        )
      }
    )

    test.skipIf(noRoundTrip())(
      'should successfully get a bucket',
      async ({ cluster, env }) => {
        const manager = cluster.buckets()
        const { main } = namesFor(env, manager)
        const c = env.ctx(bucketCtx(main, 'getBucket'))

        const settings = await manager.getBucket(main)
        expect(settings, withCtx('bucket settings', c)).toBeTypeOf('object')
        expect(fieldsOf(settings), withCtx('every setting', c)).toStrictEqual(
          expectedDefaultBackend(env, main, true, QUOTA_MB, true)
        )
      }
    )

    test('should successfully get all buckets', async ({ cluster, env }) => {
      const c = env.ctx({ op: 'getAllBuckets' })
      const all = await cluster.buckets().getAllBuckets()
      expect(Array.isArray(all), withCtx('an array of buckets', c)).toBe(true)
      expect(all[0], withCtx('the first bucket', c)).toBeTypeOf('object')
    })

    test('should fail to get a missing bucket', async ({ cluster, env }) => {
      await expectThrows(
        () => cluster.buckets().getBucket(MISSING_BUCKET),
        BucketNotFoundError,
        undefined,
        env.ctx(bucketCtx(MISSING_BUCKET, 'getBucket'))
      )
    })

    test(
      'should successfully flush a bucket',
      async ({ cluster, env, signal }) => {
        const manager = cluster.buckets()
        const { main } = namesFor(env, manager)
        await tryNTimes(
          FLUSH_ATTEMPTS,
          FLUSH_DELAY_MS,
          () => manager.flushBucket(main),
          signal
        )
      },
      BUCKET_TEST_TIMEOUT_MS
    )

    test('should error when trying to flush a missing bucket', async ({
      cluster,
      env,
    }) => {
      await expectThrows(
        () => cluster.buckets().flushBucket(MISSING_BUCKET),
        BucketNotFoundError,
        undefined,
        env.ctx(bucketCtx(MISSING_BUCKET, 'flushBucket'))
      )
    })

    test('should successfully update a bucket', async ({ cluster, env }) => {
      const manager = cluster.buckets()
      const { main } = namesFor(env, manager)
      await manager.updateBucket({
        name: main,
        flushEnabled: false,
        ramQuotaMB: LARGE_QUOTA_MB,
      })
    })

    test.skipIf(noHistory)(
      'should return an InvalidArgument error when updating a couchstore bucket with history',
      async ({ cluster, env }) => {
        const manager = cluster.buckets()
        const { main, couchstore } = namesFor(env, manager)

        // From 8.0 the default backend is magma, which accepts history, so
        // this needs an explicitly couchstore bucket.
        let name = main
        if (env.versionAtLeast(8)) {
          name = couchstore
          await manager.createBucket({
            name,
            flushEnabled: true,
            ramQuotaMB: QUOTA_MB,
            storageBackend: StorageBackend.Couchstore,
          })
          await env.protocol.waitUntilBucketPresent(name)
        }

        await expectThrows(
          () =>
            manager.updateBucket({
              name,
              historyRetentionCollectionDefault: true,
              ramQuotaMB: LARGE_QUOTA_MB,
            }),
          InvalidArgumentError,
          undefined,
          env.ctx(bucketCtx(name, 'updateBucket', 'history on couchstore'))
        )

        if (env.versionAtLeast(8)) {
          await manager.dropBucket(name)
          await env.protocol.waitUntilBucketDropped(name)
        }
      },
      BUCKET_TEST_TIMEOUT_MS
    )

    test('should error when trying to flush an unflushable bucket', async ({
      cluster,
      env,
    }) => {
      const manager = cluster.buckets()
      const { main } = namesFor(env, manager)
      await expectThrows(
        () => manager.flushBucket(main),
        CouchbaseError,
        undefined,
        env.ctx(bucketCtx(main, 'flushBucket', 'flushEnabled=false'))
      )
    })

    test(
      'should successfully drop a bucket',
      async ({ cluster, env }) => {
        const manager = cluster.buckets()
        const { main } = namesFor(env, manager)
        await manager.dropBucket(main)
        await env.protocol.waitUntilBucketDropped(main)
      },
      BUCKET_TEST_TIMEOUT_MS
    )

    test.skipIf(alwaysSucceeds())(
      'should fail to drop a missing bucket',
      async ({ cluster, env }) => {
        const manager = cluster.buckets()
        const { main } = namesFor(env, manager)
        await expectThrows(
          () => manager.dropBucket(main),
          BucketNotFoundError,
          undefined,
          env.ctx(bucketCtx(main, 'dropBucket', 'already dropped'))
        )
      }
    )

    test.skipIf(noRoundTrip())(
      'should successfully create a bucket with flush and replicaIndexes disabled',
      async ({ cluster, env }) => {
        const manager = cluster.buckets()
        const { main } = namesFor(env, manager)
        const c = env.ctx(
          bucketCtx(main, 'createBucket', 'flush and replicaIndexes off')
        )

        await manager.createBucket({
          name: main,
          flushEnabled: false,
          replicaIndexes: false,
          ramQuotaMB: QUOTA_MB,
          // From 8.0 the default is magma.
          ...(env.versionAtLeast(8)
            ? { storageBackend: StorageBackend.Couchstore }
            : {}),
        })
        await env.protocol.waitUntilBucketPresent(main)

        const settings = await manager.getBucket(main)
        expect(settings, withCtx('bucket settings', c)).toBeTypeOf('object')

        // Couchstore was named, so 8.0 reports couchstore's own defaults.
        expect(fieldsOf(settings), withCtx('every setting', c)).toStrictEqual(
          expectedCouchstore(env, main, false, QUOTA_MB, false)
        )

        await manager.dropBucket(main)
        await env.protocol.waitUntilBucketDropped(main)
      },
      BUCKET_TEST_TIMEOUT_MS
    )

    test.skipIf(noHistory)(
      'should successfully create a bucket with history settings',
      async ({ cluster, env }) => {
        const manager = cluster.buckets()
        const { magma } = namesFor(env, manager)
        const c = env.ctx(bucketCtx(magma, 'createBucket', 'magma, history on'))

        await manager.createBucket({
          name: magma,
          ramQuotaMB: LARGE_QUOTA_MB,
          storageBackend: StorageBackend.Magma,
          historyRetentionCollectionDefault: true,
          historyRetentionBytes: HISTORY_BYTES,
          historyRetentionDuration: HISTORY_DURATION_S,
        })
        await env.protocol.waitUntilBucketPresent(magma)

        const settings = await manager.getBucket(magma)
        expect(settings, withCtx('bucket settings', c)).toBeTypeOf('object')
        expect(fieldsOf(settings), withCtx('every setting', c)).toStrictEqual(
          expectedMagma(env, magma, true, HISTORY_BYTES, HISTORY_DURATION_S)
        )
      },
      BUCKET_TEST_TIMEOUT_MS
    )

    test.skipIf(noHistory)(
      'should update the history settings on a bucket',
      async ({ cluster, env }) => {
        const manager = cluster.buckets()
        const { magma } = namesFor(env, manager)
        const c = env.ctx(
          bucketCtx(magma, 'updateBucket', 'magma, history off')
        )

        await manager.updateBucket({
          name: magma,
          historyRetentionCollectionDefault: false,
          historyRetentionBytes: 0,
          historyRetentionDuration: UPDATED_HISTORY_DURATION_S,
        })

        const settings = await manager.getBucket(magma)
        expect(settings, withCtx('bucket settings', c)).toBeTypeOf('object')
        expect(fieldsOf(settings), withCtx('every setting', c)).toStrictEqual(
          expectedMagma(env, magma, false, 0, UPDATED_HISTORY_DURATION_S)
        )

        // Dropped now rather than at teardown: it is the largest bucket.
        await manager.dropBucket(magma)
        await env.protocol.waitUntilBucketDropped(magma)
      },
      BUCKET_TEST_TIMEOUT_MS
    )

    test.skipIf(noHistory)(
      'should return an InvalidArgument error when creating a couchstore bucket with history',
      async ({ cluster, env }) => {
        const manager = cluster.buckets()
        const { main } = namesFor(env, manager)
        await expectThrows(
          () =>
            manager.createBucket({
              // The quota is given so history is the only thing to refuse:
              // the server answers both with the same untyped `invalid
              // argument`.
              name: main,
              ramQuotaMB: QUOTA_MB,
              storageBackend: StorageBackend.Couchstore,
              historyRetentionCollectionDefault: true,
            }),
          InvalidArgumentError,
          undefined,
          env.ctx(bucketCtx(main, 'createBucket', 'history on couchstore'))
        )
      }
    )
  }
)
