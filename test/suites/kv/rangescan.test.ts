import { describe, expect } from 'vitest'

import type { ScanOptions } from '../../../lib/collection'
import { ScanResult } from '../../../lib/crudoptypes'
import { InvalidArgumentError } from '../../../lib/errors'
import { MutationState, MutationToken } from '../../../lib/mutationstate'
import {
  PrefixScan,
  RangeScan,
  SamplingScan,
  ScanTerm,
} from '../../../lib/rangeScan'
import { StreamableScanPromise } from '../../../lib/streamablepromises'
import { AssertCtx, withCtx } from '../../asserts/ctx'
import { expectThrows } from '../../asserts/errors'
import { ServerFeature } from '../../infra/capabilities'
import { TestEnv } from '../../infra/env'
import { CollectionLease } from '../../infra/leases/collection-lease'
import { CollectionStrategy, SuiteRequirements } from '../../infra/requirements'
import { defineSuite } from '../../infra/suite'

// A range scan reads every document in a collection, so each block needs a
// collection nothing else writes to. A flush would destroy other suites'
// documents without isolating this one, so each block leases one instead.
//
// The shared bucket's default collection holds every `DefaultCollection`
// suite's documents, so `#default-rangescan` declares `CleanDefault`: the
// default collection of a leased bucket, empty by construction. That costs a
// bucket create and drop, hence `slow`. One `defineSuite` per block because
// `CollectionStrategy.Both` pairs `Named` with `DefaultCollection`, not
// `CleanDefault`.

const DOC_COUNT = 100

/**
 * `${uid}::1`, `${uid}::10`..`${uid}::19`, `${uid}::2`: the keys between the
 * two scan terms inclusive.
 */
const IN_RANGE_INCLUSIVE = 12
const IN_RANGE_EXCLUSIVE = 10

/** `SamplingScan`'s limit, and the seed that makes two samples comparable. */
const SAMPLE_LIMIT = 10
const SAMPLE_SEED = 50

/** Where the streaming-cancel test stops reading. */
const CANCEL_AFTER = 5

interface ScanData {
  readonly uid: string
  readonly ids: readonly string[]
  readonly mutationState: MutationState
}

/**
 * Keyed per collection, not per file: the blocks get different collections,
 * and a file-scoped memo would hand the second the first one's ids while every
 * count still passed.
 */
const loaded = new Map<string, Promise<ScanData>>()

function scanDataFor(env: TestEnv, lease: CollectionLease): Promise<ScanData> {
  const key = `${lease.bucketName}.${lease.scopeName}.${lease.collectionName}`
  const existing = loaded.get(key)
  if (existing) {
    return existing
  }

  const pending = loadScanData(env, lease)
  loaded.set(key, pending)
  return pending.catch((err) => {
    // Not cached, or every later test fails with this rejection and no retry.
    loaded.delete(key)
    throw err
  })
}

async function loadScanData(
  env: TestEnv,
  lease: CollectionLease
): Promise<ScanData> {
  const uid = env.key()
  const written = await Promise.all(
    Array.from({ length: DOC_COUNT }, async (_unused, index) => {
      const id = `${uid}::${index}`
      const res = await lease.collection.upsert(id, { id })
      return { id, token: res.token }
    })
  )

  const ids = written.map((doc) => doc.id)
  env.registerCleanup(async () => {
    await Promise.allSettled(ids.map((id) => lease.collection.remove(id)))
  })

  const tokens = written
    .map((doc) => doc.token)
    .filter((token): token is MutationToken => token !== undefined)

  return { uid, ids, mutationState: new MutationState(...tokens) }
}

function scanCtx(lease: CollectionLease, extra?: string): AssertCtx {
  return {
    op: 'scan',
    bucket: lease.bucketName,
    scope: lease.scopeName,
    collection: lease.collectionName,
    ...(extra === undefined ? {} : { extra }),
  }
}

/**
 * Rows before the count, so one malformed row among the right number reports
 * the row, not the count.
 */
function validateResults(
  rows: readonly ScanResult[],
  expectedCount: number,
  idsOnly: boolean,
  c: AssertCtx = {}
): readonly ScanResult[] {
  for (const row of rows) {
    expect(row, withCtx('scan row is not an object', c)).toBeTypeOf('object')
    expect(row.id, withCtx('scan row id is not a string', c)).toBeTypeOf(
      'string'
    )
    if (idsOnly) {
      expect(
        row.expiryTime,
        withCtx(`idsOnly row '${row.id}' carried an expiryTime`, c)
      ).toBeUndefined()
      expect(
        row.cas,
        withCtx(`idsOnly row '${row.id}' carried a cas`, c)
      ).toBeUndefined()
      expect(
        row.content,
        withCtx(`idsOnly row '${row.id}' carried content`, c)
      ).toBeUndefined()
    } else {
      expect(
        row.cas,
        withCtx(`scan row '${row.id}' has no cas`, c)
      ).toBeTruthy()
      expect(
        row.content,
        withCtx(`scan row '${row.id}' content is not an object`, c)
      ).toBeTypeOf('object')
      expect(
        row.content,
        withCtx(`scan row '${row.id}' content`, c)
      ).toStrictEqual({ id: row.id })
    }
  }

  expect(
    rows.length,
    withCtx(`expected ${expectedCount} row(s), got ${rows.length}`, c)
  ).toStrictEqual(expectedCount)
  return rows
}

function assertIsArray(res: unknown, c: AssertCtx = {}): void {
  expect(Array.isArray(res), withCtx('scan did not return an array', c)).toBe(
    true
  )
}

// `scan` returns a `StreamableScanPromise` but is declared as returning a plain
// `Promise`, so its emitter is invisible to a TypeScript caller
// (JSCBC-1463). The cast is confined to this helper.

function streamScan(
  lease: CollectionLease,
  scanType: RangeScan | SamplingScan | PrefixScan,
  options: Pick<ScanOptions, 'idsOnly' | 'consistentWith'>,
  cancelAt?: number
): Promise<ScanResult[]> {
  return new Promise<ScanResult[]>((resolve, reject) => {
    const results: ScanResult[] = []
    const emitter = lease.collection.scan(
      scanType,
      options
    ) as StreamableScanPromise<ScanResult[], ScanResult>

    emitter
      .on('result', (res: ScanResult) => {
        results.push(res)
        if (cancelAt !== undefined && results.length === cancelAt) {
          emitter.cancelStreaming()
        }
      })
      .on('end', () => {
        resolve(results)
      })
      .on('error', (err: Error) => {
        reject(err)
      })
  })
}

type BatchOption = 'batchByteLimit' | 'batchItemLimit'

interface BatchCase {
  readonly kind: string
  readonly limit: number
  readonly expected: number
  readonly scanType: (uid: string) => RangeScan | SamplingScan | PrefixScan
}

// Regression guard (JSCBC-1465): `scanType` takes the uid at call time, since
// the cases are built before it exists. An undefined prefix scans the whole
// collection and still matches the count.
function batchCases(limits: readonly number[]): readonly BatchCase[] {
  return [
    ...limits.map((limit) => ({
      kind: 'RangeScan',
      limit,
      expected: DOC_COUNT,
      scanType: () => new RangeScan(),
    })),
    ...limits.map((limit) => ({
      kind: 'PrefixScan',
      limit,
      expected: DOC_COUNT,
      scanType: (uid: string) => new PrefixScan(uid),
    })),
    ...limits.map((limit) => ({
      kind: 'SamplingScan',
      limit,
      expected: SAMPLE_LIMIT,
      scanType: () => new SamplingScan(SAMPLE_LIMIT, SAMPLE_SEED),
    })),
  ]
}

const BATCH_BYTE_CASES = batchCases([0, 1, 25, 100])
const BATCH_ITEM_CASES = batchCases([0, 10, 25, 100])

const CONCURRENCY_CASES = [1, 2, 4, 16, 64, 128] as const
const INVALID_CONCURRENCY_CASES = [0, -1] as const
const INVALID_SAMPLE_LIMIT_CASES = [0, -10] as const

async function runRangeScan(
  env: TestEnv,
  lease: CollectionLease
): Promise<void> {
  const data = await scanDataFor(env, lease)
  const scanType = new RangeScan(
    new ScanTerm(`${data.uid}::1`),
    new ScanTerm(`${data.uid}::2`)
  )

  const res = await lease.collection.scan(scanType, {
    consistentWith: data.mutationState,
  })

  const c = env.ctx(scanCtx(lease, 'RangeScan'))
  assertIsArray(res, c)
  validateResults(res, IN_RANGE_INCLUSIVE, false, c)
}

async function runRangeScanDefaultTerms(
  env: TestEnv,
  lease: CollectionLease
): Promise<void> {
  const data = await scanDataFor(env, lease)

  const res = await lease.collection.scan(new RangeScan(), {
    consistentWith: data.mutationState,
  })

  const c = env.ctx(scanCtx(lease, 'RangeScan, default terms'))
  assertIsArray(res, c)
  validateResults(res, data.ids.length, false, c)
}

async function runRangeScanExclusive(
  env: TestEnv,
  lease: CollectionLease
): Promise<void> {
  const data = await scanDataFor(env, lease)
  const scanType = new RangeScan(
    new ScanTerm(`${data.uid}::1`, true),
    new ScanTerm(`${data.uid}::2`, true)
  )

  const res = await lease.collection.scan(scanType, {
    consistentWith: data.mutationState,
  })

  const c = env.ctx(scanCtx(lease, 'RangeScan, exclusive terms'))
  assertIsArray(res, c)
  validateResults(res, IN_RANGE_EXCLUSIVE, false, c)
}

async function runPrefixScan(
  env: TestEnv,
  lease: CollectionLease
): Promise<void> {
  const data = await scanDataFor(env, lease)

  const res = await lease.collection.scan(new PrefixScan(data.uid), {
    consistentWith: data.mutationState,
  })

  const c = env.ctx(scanCtx(lease, 'PrefixScan'))
  assertIsArray(res, c)
  validateResults(res, data.ids.length, false, c)
}

async function runPrefixScanIdsOnly(
  env: TestEnv,
  lease: CollectionLease
): Promise<void> {
  const data = await scanDataFor(env, lease)

  const res = await lease.collection.scan(new PrefixScan(data.uid), {
    idsOnly: true,
    consistentWith: data.mutationState,
  })

  const c = env.ctx(scanCtx(lease, 'PrefixScan, idsOnly'))
  assertIsArray(res, c)
  validateResults(res, data.ids.length, true, c)
}

async function runStreamScan(
  env: TestEnv,
  lease: CollectionLease
): Promise<void> {
  const data = await scanDataFor(env, lease)

  const results = await streamScan(lease, new PrefixScan(data.uid), {
    idsOnly: true,
    consistentWith: data.mutationState,
  })

  const c = env.ctx(scanCtx(lease, 'PrefixScan, streamed'))
  assertIsArray(results, c)
  validateResults(results, data.ids.length, true, c)
}

async function runCancelStreamScan(
  env: TestEnv,
  lease: CollectionLease
): Promise<void> {
  const data = await scanDataFor(env, lease)

  const results = await streamScan(
    lease,
    new PrefixScan(data.uid),
    { idsOnly: true, consistentWith: data.mutationState },
    CANCEL_AFTER
  )

  const c = env.ctx(scanCtx(lease, `PrefixScan, cancelled at ${CANCEL_AFTER}`))
  assertIsArray(results, c)
  validateResults(results, CANCEL_AFTER, true, c)
}

async function runSampleScan(
  env: TestEnv,
  lease: CollectionLease
): Promise<void> {
  const data = await scanDataFor(env, lease)

  const res = await lease.collection.scan(new SamplingScan(SAMPLE_LIMIT), {
    idsOnly: true,
    consistentWith: data.mutationState,
  })

  const c = env.ctx(scanCtx(lease, 'SamplingScan'))
  assertIsArray(res, c)
  const rows = validateResults(res, SAMPLE_LIMIT, true, c)
  for (const row of rows) {
    expect(
      data.ids.includes(row.id),
      withCtx(`sampled id '${row.id}' is not one this suite wrote`, c)
    ).toBe(true)
  }
}

async function runSampleScanWithSeed(
  env: TestEnv,
  lease: CollectionLease
): Promise<void> {
  const data = await scanDataFor(env, lease)
  const scanType = new SamplingScan(SAMPLE_LIMIT, SAMPLE_SEED)
  const c = env.ctx(scanCtx(lease, `SamplingScan, seed ${SAMPLE_SEED}`))

  const first = await lease.collection.scan(scanType, {
    idsOnly: true,
    consistentWith: data.mutationState,
  })
  assertIsArray(first, c)
  const firstRows = validateResults(first, SAMPLE_LIMIT, true, c)
  const firstIds: string[] = []
  for (const row of firstRows) {
    expect(
      data.ids.includes(row.id),
      withCtx(`sampled id '${row.id}' is not one this suite wrote`, c)
    ).toBe(true)
    firstIds.push(row.id)
  }

  const second = await lease.collection.scan(scanType, {
    idsOnly: true,
    consistentWith: data.mutationState,
  })
  assertIsArray(second, c)
  const secondIds = validateResults(second, SAMPLE_LIMIT, true, c).map(
    (row) => row.id
  )

  expect(
    firstIds.length,
    withCtx('the two samples differ in size', c)
  ).toStrictEqual(secondIds.length)
  for (const id of firstIds) {
    expect(
      secondIds.includes(id),
      withCtx(`'${id}' was sampled once but not the second time`, c)
    ).toBe(true)
  }
}

async function runBatchLimit(
  env: TestEnv,
  lease: CollectionLease,
  option: BatchOption,
  batchCase: BatchCase
): Promise<void> {
  const data = await scanDataFor(env, lease)

  const res = await lease.collection.scan(batchCase.scanType(data.uid), {
    [option]: batchCase.limit,
    consistentWith: data.mutationState,
  })

  const c = env.ctx(
    scanCtx(lease, `${batchCase.kind}, ${option}=${batchCase.limit}`)
  )
  assertIsArray(res, c)
  validateResults(res, batchCase.expected, false, c)
}

async function runConcurrency(
  env: TestEnv,
  lease: CollectionLease,
  concurrency: number
): Promise<void> {
  const data = await scanDataFor(env, lease)
  const scanType = new RangeScan(
    new ScanTerm(`${data.uid}::1`),
    new ScanTerm(`${data.uid}::2`)
  )

  const res = await lease.collection.scan(scanType, {
    concurrency,
    consistentWith: data.mutationState,
  })

  const c = env.ctx(scanCtx(lease, `RangeScan, concurrency=${concurrency}`))
  assertIsArray(res, c)
  validateResults(res, IN_RANGE_INCLUSIVE, false, c)
}

async function runInvalidConcurrency(
  env: TestEnv,
  lease: CollectionLease,
  concurrency: number
): Promise<void> {
  const data = await scanDataFor(env, lease)
  const scanType = new RangeScan(
    new ScanTerm(`${data.uid}::1`),
    new ScanTerm(`${data.uid}::2`)
  )

  await expectThrows(
    () =>
      lease.collection.scan(scanType, {
        concurrency,
        consistentWith: data.mutationState,
      }),
    InvalidArgumentError,
    undefined,
    env.ctx(scanCtx(lease, `concurrency=${concurrency}`))
  )
}

async function runInvalidSampleLimit(
  env: TestEnv,
  lease: CollectionLease,
  limit: number
): Promise<void> {
  await expectThrows(
    () => lease.collection.scan(new SamplingScan(limit)),
    InvalidArgumentError,
    undefined,
    env.ctx(scanCtx(lease, `SamplingScan limit=${limit}`))
  )
}

const SUITES: readonly { name: string; requirements: SuiteRequirements }[] = [
  {
    name: '#default-rangescan',
    requirements: {
      // `BucketManagement` comes from the provisioning rather than from the
      // tests: `CleanDefault` leases a bucket to get an empty default
      // collection.
      features: [
        ServerFeature.RangeScan,
        ServerFeature.KeyValue,
        ServerFeature.BucketManagement,
      ],
      collection: CollectionStrategy.CleanDefault,
      // Creating and dropping a bucket is seconds, not milliseconds.
      tier: 'slow',
    },
  },
  {
    name: '#collections-rangescan',
    requirements: {
      features: [
        ServerFeature.RangeScan,
        ServerFeature.KeyValue,
        ServerFeature.Collections,
      ],
      collection: CollectionStrategy.Named,
    },
  },
]

for (const suite of SUITES) {
  defineSuite(suite.name, suite.requirements, ({ test }) => {
    describe('#rangescan', () => {
      test('should execute a range scan', async ({ collectionLease, env }) => {
        await runRangeScan(env, collectionLease)
      })

      test('should execute a range scan with default terms', async ({
        collectionLease,
        env,
      }) => {
        await runRangeScanDefaultTerms(env, collectionLease)
      })

      test('should execute a range scan exclusive', async ({
        collectionLease,
        env,
      }) => {
        await runRangeScanExclusive(env, collectionLease)
      })

      test('should execute a range scan from prefix', async ({
        collectionLease,
        env,
      }) => {
        await runPrefixScan(env, collectionLease)
      })

      test('should execute a range scan returning only ids', async ({
        collectionLease,
        env,
      }) => {
        await runPrefixScanIdsOnly(env, collectionLease)
      })

      test('should stream scan results', async ({ collectionLease, env }) => {
        await runStreamScan(env, collectionLease)
      })

      test('should cancel streaming scan results', async ({
        collectionLease,
        env,
      }) => {
        await runCancelStreamScan(env, collectionLease)
      })

      test('should execute a sample scan', async ({ collectionLease, env }) => {
        await runSampleScan(env, collectionLease)
      })

      test('should execute a sample scan with seed', async ({
        collectionLease,
        env,
      }) => {
        await runSampleScanWithSeed(env, collectionLease)
      })

      describe('#batchByteLimit', () => {
        for (const batchCase of BATCH_BYTE_CASES) {
          test(`should execute ${batchCase.kind} with batchByteLimit=${batchCase.limit}`, async ({
            collectionLease,
            env,
          }) => {
            await runBatchLimit(
              env,
              collectionLease,
              'batchByteLimit',
              batchCase
            )
          })
        }
      })

      describe('#batchItemLimit', () => {
        for (const batchCase of BATCH_ITEM_CASES) {
          test(`should execute ${batchCase.kind} with batchItemLimit=${batchCase.limit}`, async ({
            collectionLease,
            env,
          }) => {
            await runBatchLimit(
              env,
              collectionLease,
              'batchItemLimit',
              batchCase
            )
          })
        }
      })

      describe('#concurrency', () => {
        for (const concurrency of CONCURRENCY_CASES) {
          test(`should execute RangeScan with concurrency=${concurrency}`, async ({
            collectionLease,
            env,
          }) => {
            await runConcurrency(env, collectionLease, concurrency)
          })
        }
      })

      describe('#invalid-concurrency', () => {
        for (const concurrency of INVALID_CONCURRENCY_CASES) {
          test(`should return an invalid argument when concurrency <= 0 (concurrency=${concurrency})`, async ({
            collectionLease,
            env,
          }) => {
            await runInvalidConcurrency(env, collectionLease, concurrency)
          })
        }
      })

      describe('#invalid-sample-limit', () => {
        for (const limit of INVALID_SAMPLE_LIMIT_CASES) {
          test(`should return an invalid argument when SamplingScan limit <= 0 (limit=${limit})`, async ({
            collectionLease,
            env,
          }) => {
            await runInvalidSampleLimit(env, collectionLease, limit)
          })
        }
      })
    })
  })
}
