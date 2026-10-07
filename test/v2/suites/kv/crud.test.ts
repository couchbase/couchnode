import { describe, expect } from 'vitest'

import { Collection } from '../../../../lib/collection'
import {
  CounterResult,
  ExistsResult,
  GetReplicaResult,
  GetResult,
  LookupInReplicaResult,
  MutateInResultEntry,
  MutationResult,
} from '../../../../lib/crudoptypes'
import {
  CasMismatchError,
  DocumentExistsError,
  DocumentNotFoundError,
  DocumentNotLockedError,
  DocumentUnretrievableError,
  DurabilityImpossibleError,
  InvalidArgumentError,
  InvalidDurabilityLevel,
  InvalidDurabilityPersistToLevel,
  InvalidDurabilityReplicateToLevel,
} from '../../../../lib/errors'
import { KeyValueErrorContext } from '../../../../lib/errorcontexts'
import { DurabilityLevel, ReadPreference } from '../../../../lib/generaltypes'
import { MutationToken } from '../../../../lib/mutationstate'
import {
  LookupInMacro,
  LookupInSpec,
  MutateInMacro,
  MutateInSpec,
} from '../../../../lib/sdspecs'
import { SdUtils } from '../../../../lib/sdutils'
import { StreamableReplicasPromise } from '../../../../lib/streamablepromises'
import { DefaultTranscoder } from '../../../../lib/transcoders'
import { AssertCtx, withCtx } from '../../asserts/ctx'
import {
  expectCouchbaseError,
  expectErrorContext,
  expectThrows,
} from '../../asserts/errors'
import { assertDocEquals, assertMutationResult } from '../../asserts/kv'
import { awaitCallback, settleCallback, Settled } from '../../infra/callbacks'
import { ServerFeature } from '../../infra/capabilities'
import { DocBatch } from '../../infra/data/loader'
import { TestEnv } from '../../infra/env'
import { numReplicasOf, waitUntilReplicated } from '../../infra/replicas'
import { CollectionStrategy } from '../../infra/requirements'
import { pollWhile, sleep, tryNTimes } from '../../infra/retry'
import { defineSuite } from '../../infra/suite'

// Documents are set up by memoized helpers that register removal with the
// env, so cleanup runs on the failure path too.
//
// Test order is load-bearing. `#upsert` writes `testKeyA`, `#get` reads it,
// `#replace` overwrites it, `#remove` deletes it, and `#serverDurability`
// writes it again, so the blocks stay in this order and the tests within them
// do too.
//
// Callback-form calls go through `infra/callbacks.ts`, so a failed assertion
// fails the test instead of hanging it.

const errorTranscoder = {
  encode: (): never => {
    throw new Error('encode error')
  },
  decode: (): never => {
    throw new Error('decode error')
  },
}

const testObjVal = {
  foo: 'bar',
  baz: 19,
  c: 1,
  d: 'str',
  e: true,
  f: false,
  g: 5,
  h: 6,
  i: 7,
  j: 8,
  k: 9,
  l: 10,
  m: 11,
  n: 12,
  o: 13,
  p: 14,
  q: 15,
  r: 16,
  utf8: 'é',
}
const testUtf8Val = 'é'
const testBinVal = Buffer.from(
  '00092bc691fb824300a6871ceddf7090d7092bc691fb824300a6871ceddf7090d7',
  'hex'
)

const subdocVal = { foo: 14, bar: 2, baz: 'hello', arr: [1, 2, 3] }

/**
 * Retries a client durability write that should succeed. The core gives the
 * observe poll a fixed 5s whatever the operation's timeout, so a loaded cluster
 * can report ambiguous a write that did persist (CXXCBC-1056). Drop this once
 * the core bounds the poll by the operation timeout.
 */
const OBSERVE_DEADLINE_OPTS = { retry: { count: 3, delay: 1000 } }

/**
 * How long a test reads a document waiting for it to expire. An expired
 * document stops being readable when the server decides, not exactly when the
 * expiry ends, so a single read at a fixed delay races it.
 */
const EXPIRY_DEADLINE_MS = 10_000

/**
 * `get` again until it rejects. Resolves with the last result if the deadline
 * passes first, so the caller's `expectThrows` fails.
 */
function getUntilGone(
  collection: Collection,
  key: string,
  signal: AbortSignal
): Promise<GetResult> {
  return pollWhile(
    () => collection.get(key),
    () => true,
    { deadlineMs: EXPIRY_DEADLINE_MS, signal }
  )
}

function getUntilGoneWithCallback(
  collection: Collection,
  key: string,
  signal: AbortSignal
): Promise<Settled<GetResult>> {
  return pollWhile(
    () => settleCallback<GetResult>((cb) => collection.get(key, cb)),
    (got) => got.err === null,
    { deadlineMs: EXPIRY_DEADLINE_MS, signal }
  )
}

function validateMutationToken(
  token: MutationToken | undefined,
  c: AssertCtx = {}
): void {
  if (token === undefined) {
    throw new Error(withCtx('mutation token missing', c))
  }
  const mutToken = token.toJSON() as Record<string, unknown>
  expect(
    mutToken.partition_uuid,
    withCtx('mutation token partition_uuid', c)
  ).toBeTypeOf('string')
  expect(
    mutToken.sequence_number,
    withCtx('mutation token sequence_number', c)
  ).toBeTypeOf('string')
  expect(
    mutToken.partition_id,
    withCtx('mutation token partition_id', c)
  ).toBeTypeOf('number')
  expect(
    mutToken.bucket_name,
    withCtx('mutation token bucket_name', c)
  ).toBeTypeOf('string')
}

// Keyed per (collection, name) because `Both` runs this body twice, and a
// module-level key would hand both runs the same document.
const namedKeys = new Map<string, string>()

/** A key shared by a block's tests, removed when the env closes. */
function sharedKey(env: TestEnv, collection: Collection, name: string): string {
  const id = `${collection.name}:${name}`
  const existing = namedKeys.get(id)
  if (existing) {
    return existing
  }
  const key = env.key()
  namedKeys.set(id, key)
  env.registerCleanup(async () => {
    await collection.remove(key).catch(() => undefined)
  })
  return key
}

/** A key for one test's own document, removed when the env closes. */
function scratchKey(env: TestEnv, collection: Collection): string {
  const key = env.key()
  env.registerCleanup(async () => {
    await collection.remove(key).catch(() => undefined)
  })
  return key
}

const seeded = new Map<string, Promise<string>>()

/**
 * A shared key whose document is written once, before the first test that asks
 * for it. The promise is memoized, not the key, so two tests cannot seed twice.
 */
function seededKey(
  env: TestEnv,
  collection: Collection,
  name: string,
  write: (key: string) => Promise<unknown>
): Promise<string> {
  const id = `${collection.name}:${name}`
  const existing = seeded.get(id)
  if (existing) {
    return existing
  }
  const pending = (async () => {
    const key = sharedKey(env, collection, name)
    await write(key)
    return key
  })()
  seeded.set(id, pending)
  // Not kept, or the next test inherits the rejection with no retry.
  pending.catch(() => seeded.delete(id))
  return pending
}

/**
 * The mutate-in macro block's document batch, and a cursor over it, so each of
 * its tests gets a document nobody else has touched.
 */
interface MacroDocs {
  next(): string
}

const macroDocs = new Map<string, Promise<MacroDocs>>()

function macroDocsFor(
  env: TestEnv,
  collection: Collection
): Promise<MacroDocs> {
  const existing = macroDocs.get(collection.name)
  if (existing) {
    return existing
  }
  const pending = (async () => {
    const batch = await DocBatch.load(collection, {
      uid: env.key(),
      retries: 1,
    })
    env.registerCleanup(() => batch.purge())
    let index = 0
    return {
      next: () => {
        const id = batch.ids[index++]
        if (!id) {
          throw new Error(
            `The macro block asked for document ${index} of a batch holding ` +
              `${batch.size}. Add documents or take fewer.`
          )
        }
        return id
      },
    }
  })()
  macroDocs.set(collection.name, pending)
  // As for `seededKey`: a failed load is not kept.
  pending.catch(() => macroDocs.delete(collection.name))
  return pending
}

/**
 * GoCAVES answers every mutate-in macro with `xattr_unknown_macro`, even on
 * paths expecting an SDK-side `InvalidArgumentError`, so nothing is left to
 * assert. The lookup-in macro block is unaffected.
 */
const MUTATE_IN_MACROS = {
  features: [ServerFeature.Xattr],
  limitations: ['gocaves-subdoc-mutation-macros'],
} as const

defineSuite(
  '#crud',
  { features: [ServerFeature.KeyValue], collection: CollectionStrategy.Both },
  ({ test, group, lacking, belowTier }) => {
    describe('#kvops', () => {
      describe('#upsert', () => {
        test('should perform basic upserts', async ({ collection, env }) => {
          const key = sharedKey(env, collection, 'A')
          const res = await collection.upsert(key, testObjVal)
          expect(res, 'upsert result').toBeTypeOf('object')
          expect(res.cas, 'upsert cas').toBeTruthy()
          validateMutationToken(res.token, env.ctx({ op: 'upsert', key }))
        })

        test('should perform basic upserts with callback', async ({
          collection,
          env,
        }) => {
          const key = sharedKey(env, collection, 'A')
          const res = await awaitCallback<MutationResult>((cb) =>
            collection.upsert(key, testObjVal, cb)
          )
          expect(res, 'upsert result').toBeTypeOf('object')
          expect(res.cas, 'upsert cas').toBeTruthy()
          validateMutationToken(res.token, env.ctx({ op: 'upsert', key }))
        })

        // Regression guard (JSCBC-1458): polls until the document expires
        // rather than reading once at a fixed delay.
        test('should upsert successfully using options and callback', async ({
          collection,
          env,
          signal,
        }) => {
          const key = scratchKey(env, collection)

          const upserted = await settleCallback<MutationResult>((cb) =>
            collection.upsert(key, { foo: 14 }, { expiry: 1 }, cb)
          )
          expect(upserted.err, 'upsert error').toBeNull()
          expect(upserted.res, 'upsert result').toBeTypeOf('object')

          const got = await getUntilGoneWithCallback(collection, key, signal)
          expect(got.res, 'get result after expiry').toBeNull()
          expect(got.err, 'get error after expiry').toBeTruthy()
        })

        test('should upsert with UTF8 data properly', async ({
          collection,
          env,
        }) => {
          const res = await collection.upsert(
            sharedKey(env, collection, 'utf8'),
            testUtf8Val
          )
          expect(res, 'upsert result').toBeTypeOf('object')
          expect(res.cas, 'upsert cas').toBeTruthy()
        })

        test('should upsert with binary data properly', async ({
          collection,
          env,
        }) => {
          const res = await collection.upsert(
            sharedKey(env, collection, 'bin'),
            testBinVal
          )
          expect(res, 'upsert result').toBeTypeOf('object')
          expect(res.cas, 'upsert cas').toBeTruthy()
        })

        test('should not crash on transcoder errors', async ({
          collection,
          env,
        }) => {
          const key = sharedKey(env, collection, 'A')
          await expectThrows(
            () =>
              collection.upsert(key, testObjVal, {
                transcoder: errorTranscoder,
              }),
            Error,
            'encode error',
            env.ctx({ op: 'upsert', key, collection: collection.name })
          )
        })

        // Regression guard (JSCBC-1458), as for the upsert above.
        test.skipIf(lacking(ServerFeature.PreserveExpiry))(
          'should preserve expiry successfully',
          async ({ collection, env, signal }) => {
            const key = scratchKey(env, collection)

            const res = await collection.insert(key, { foo: 14 }, { expiry: 1 })
            expect(res, 'insert result').toBeTypeOf('object')

            await collection.upsert(key, { foo: 13 }, { preserveExpiry: true })

            await expectThrows(
              () => getUntilGone(collection, key, signal),
              DocumentNotFoundError,
              undefined,
              env.ctx({ op: 'get', key, extra: 'after preserved expiry' })
            )
          }
        )
      })

      describe('#get', () => {
        test('should perform basic gets', async ({ collection, env }) => {
          const res = await collection.get(sharedKey(env, collection, 'A'))
          expect(res, 'get result').toBeTypeOf('object')
          expect(res.cas, 'get cas').toBeTruthy()
          expect(res.value, 'get value').toEqual(testObjVal)

          // Regression guard (JSCBC-784): `value` and `content` must be the
          // same object, not merely equal ones.
          expect(res.value, 'value is content').toBe(res.content)
        })

        test('should fetch utf8 documents', async ({ collection, env }) => {
          const res = await collection.get(sharedKey(env, collection, 'utf8'))
          expect(res, 'get result').toBeTypeOf('object')
          expect(res.cas, 'get cas').toBeTruthy()
          expect(res.value, 'get value').toEqual(testUtf8Val)
        })

        test('should fetch binary documents', async ({ collection, env }) => {
          const res = await collection.get(sharedKey(env, collection, 'bin'))
          expect(res, 'get result').toBeTypeOf('object')
          expect(res.cas, 'get cas').toBeTruthy()
          expect(res.value, 'get value').toEqual(testBinVal)
        })

        test('should not crash on transcoder errors', async ({
          collection,
          env,
        }) => {
          const key = sharedKey(env, collection, 'A')
          await collection.upsert(key, testObjVal)

          await expectThrows(
            () => collection.get(key, { transcoder: errorTranscoder }),
            Error,
            'decode error',
            env.ctx({ op: 'get', key, collection: collection.name })
          )
        })

        test('should perform basic gets with callback', async ({
          collection,
          env,
        }) => {
          const res = await awaitCallback<GetResult>((cb) =>
            collection.get(sharedKey(env, collection, 'A'), cb)
          )
          expect(res, 'get result').toBeTypeOf('object')
          expect(res.cas, 'get cas').toBeTruthy()
          expect(res.value, 'get value').toEqual(testObjVal)
        })

        test('should perform errored gets with callback', async ({
          collection,
        }) => {
          const got = await settleCallback<GetResult>((cb) =>
            collection.get('invalid-key', cb)
          )
          expect(got.res, 'get result').toBeNull()
          expect(got.err, 'get error').toBeTruthy()
        })

        test('should perform projected gets', async ({ collection, env }) => {
          const res = await collection.get(sharedKey(env, collection, 'A'), {
            project: ['baz'],
          })
          expect(res, 'get result').toBeTypeOf('object')
          expect(res.cas, 'get cas').toBeTruthy()
          expect(res.content, 'projected content').toEqual({ baz: 19 })

          // Regression guard (JSCBC-784), as above.
          expect(res.value, 'value is content').toBe(res.content)
        })

        test('should perform projected gets with callback', async ({
          collection,
          env,
        }) => {
          const res = await awaitCallback<GetResult>((cb) =>
            collection.get(
              sharedKey(env, collection, 'A'),
              { project: ['baz'] },
              cb
            )
          )
          expect(res, 'get result').toBeTypeOf('object')
          expect(res.cas, 'get cas').toBeTruthy()
          expect(res.content, 'projected content').toEqual({ baz: 19 })
        })

        test.skipIf(lacking(ServerFeature.Xattr))(
          'should fall back to full get projection',
          async ({ collection, env }) => {
            const res = await collection.get(sharedKey(env, collection, 'A'), {
              project: [
                'c',
                'd',
                'e',
                'f',
                'g',
                'h',
                'i',
                'j',
                'k',
                'l',
                'm',
                'n',
                'o',
                'p',
                'q',
                'r',
              ],
              withExpiry: true,
            })
            expect(res, 'get result').toBeTypeOf('object')
            expect(res.cas, 'get cas').toBeTruthy()
            expect(res.expiry, 'get expiry').toBeTypeOf('number')
            expect(res.content, 'projected content').toEqual({
              c: 1,
              d: 'str',
              e: true,
              f: false,
              g: 5,
              h: 6,
              i: 7,
              j: 8,
              k: 9,
              l: 10,
              m: 11,
              n: 12,
              o: 13,
              p: 14,
              q: 15,
              r: 16,
            })

            // Regression guard (JSCBC-784), as above.
            expect(res.value, 'value is content').toBe(res.content)
          }
        )
      })

      group('#exists', [ServerFeature.GetMeta], () => {
        test('should successfully perform exists -> true', async ({
          collection,
          env,
        }) => {
          const res = await collection.exists(sharedKey(env, collection, 'A'))
          expect(res, 'exists result').toBeTypeOf('object')
          expect(res.exists, 'exists').toBe(true)
          expect(res.cas, 'exists cas').toBeTruthy()
        })

        test('should successfully perform exists -> false', async ({
          collection,
        }) => {
          const res = await collection.exists('a-missing-key')
          expect(res, 'exists result').toBeTypeOf('object')
          expect(res.exists, 'exists').toBe(false)
          if (res.cas === undefined) {
            throw new Error('exists returned no cas for a missing document')
          }
          expect(Object.keys(res.cas), 'exists cas').not.toHaveLength(0)
          expect(
            parseInt(res.cas.toString()),
            'exists cas is zero for a missing document'
          ).toBeFalsy()
        })

        test('should perform basic exists with callback', async ({
          collection,
          env,
        }) => {
          const res = await awaitCallback<ExistsResult>((cb) =>
            collection.exists(sharedKey(env, collection, 'A'), cb)
          )
          expect(res, 'exists result').toBeTypeOf('object')
          expect(res.exists, 'exists').toBe(true)
        })

        test('should perform basic exists with options and callback', async ({
          collection,
          env,
        }) => {
          const res = await awaitCallback<ExistsResult>((cb) =>
            collection.exists(
              sharedKey(env, collection, 'A'),
              { timeout: 2000 },
              cb
            )
          )
          expect(res, 'exists result').toBeTypeOf('object')
          expect(res.exists, 'exists').toBe(true)
        })

        // Regression guard (JSCBC-1454): calls `exists`, which answers a
        // missing key with `exists: false` and no error.
        test('should perform exists on a missing key with callback', async ({
          collection,
        }) => {
          const got = await settleCallback<ExistsResult>((cb) =>
            collection.exists('a-missing-key', cb)
          )
          expect(got.err, 'error').toBeNull()
          expect(got.res?.exists, 'exists').toBe(false)
        })
      })

      describe('#replace', () => {
        test('should replace data correctly', async ({ collection, env }) => {
          const key = sharedKey(env, collection, 'A')
          const res = await collection.replace(key, { foo: 'baz' })
          expect(res, 'replace result').toBeTypeOf('object')
          expect(res.cas, 'replace cas').toBeTruthy()
          validateMutationToken(res.token, env.ctx({ op: 'replace', key }))

          const gres = await collection.get(key)
          expect(gres.value, 'replaced value').toEqual({ foo: 'baz' })
        })

        test('should perform replace with callback', async ({
          collection,
          env,
        }) => {
          const key = sharedKey(env, collection, 'A')
          const replaced = await settleCallback<MutationResult>((cb) =>
            collection.replace(key, { foo: 'qux' }, cb)
          )
          expect(replaced.err, 'replace error').toBeNull()
          const res = replaced.res
          if (res === null) {
            throw new Error('replace reported neither an error nor a result')
          }
          expect(res, 'replace result').toBeTypeOf('object')
          expect(res.cas, 'replace cas').toBeTruthy()
          validateMutationToken(res.token, env.ctx({ op: 'replace', key }))

          const gres = await awaitCallback<GetResult>((cb) =>
            collection.get(key, cb)
          )
          expect(gres.value, 'replaced value').toEqual({ foo: 'qux' })
        })

        test('should perform replace with options and callback', async ({
          collection,
          env,
        }) => {
          const key = sharedKey(env, collection, 'A')
          const tc = new DefaultTranscoder()
          const replaced = await settleCallback<MutationResult>((cb) =>
            collection.replace(key, { foo: 'qux' }, { transcoder: tc }, cb)
          )
          expect(replaced.err, 'replace error').toBeNull()
          const res = replaced.res
          if (res === null) {
            throw new Error('replace reported neither an error nor a result')
          }
          expect(res, 'replace result').toBeTypeOf('object')
          expect(res.cas, 'replace cas').toBeTruthy()
          validateMutationToken(res.token, env.ctx({ op: 'replace', key }))

          const gres = await awaitCallback<GetResult>((cb) =>
            collection.get(key, cb)
          )
          expect(gres.value, 'replaced value').toEqual({ foo: 'qux' })
        })

        test('should cas mismatch when replacing with wrong cas', async ({
          collection,
          env,
        }) => {
          const key = sharedKey(env, collection, 'A')
          const getRes = await collection.get(key)

          await collection.replace(key, { foo: 'boz' })

          await expectCouchbaseError(
            () => collection.replace(key, { foo: 'bla' }, { cas: getRes.cas }),
            CasMismatchError,
            env.ctx({ op: 'replace', key, extra: 'stale cas' })
          )
        })
      })

      describe('#remove', () => {
        test('should perform basic removes', async ({ collection, env }) => {
          const key = sharedKey(env, collection, 'A')
          const res = await collection.remove(key)
          expect(res, 'remove result').toBeTypeOf('object')
          expect(res.cas, 'remove cas').toBeTruthy()
          validateMutationToken(res.token, env.ctx({ op: 'remove', key }))
        })

        test('should perform basic remove with options and callback', async ({
          collection,
          env,
        }) => {
          const removed = await settleCallback<MutationResult>((cb) =>
            collection.remove(
              sharedKey(env, collection, 'A'),
              { timeout: 2000 },
              cb
            )
          )
          expect(removed.res, 'remove result').toBeNull()
          expect(removed.err, 'remove error').toBeTruthy()
          expect(
            removed.err instanceof DocumentNotFoundError,
            'remove error type'
          ).toBe(true)
        })
      })

      describe('#insert', () => {
        test('should perform inserts correctly', async ({
          collection,
          env,
        }) => {
          const key = sharedKey(env, collection, 'ins')
          const res = await collection.insert(key, { foo: 'bar' })
          expect(res, 'insert result').toBeTypeOf('object')
          expect(res.cas, 'insert cas').toBeTruthy()
          validateMutationToken(res.token, env.ctx({ op: 'insert', key }))
        })

        test('should fail to insert a second time', async ({
          collection,
          env,
        }) => {
          const key = sharedKey(env, collection, 'ins')
          await expectThrows(
            () => collection.insert(key, { foo: 'bar' }),
            DocumentExistsError,
            undefined,
            env.ctx({ op: 'insert', key, extra: 'second insert' })
          )
        })

        test('should remove the insert test key', async ({
          collection,
          env,
        }) => {
          await collection.remove(sharedKey(env, collection, 'ins'))
        })

        test('should perform inserts with callback', async ({
          collection,
          env,
        }) => {
          const key = sharedKey(env, collection, 'ins')
          const res = await awaitCallback<MutationResult>((cb) =>
            collection.insert(key, { foo: 'bar' }, cb)
          )
          expect(res, 'insert result').toBeTypeOf('object')
          expect(res.cas, 'insert cas').toBeTruthy()
          validateMutationToken(res.token, env.ctx({ op: 'insert', key }))
        })

        // Regression guard (JSCBC-1458), as for the upsert above.
        test('should insert successfully using options and callback', async ({
          collection,
          env,
          signal,
        }) => {
          const key = scratchKey(env, collection)

          const inserted = await settleCallback<MutationResult>((cb) =>
            collection.insert(key, { foo: 14 }, { expiry: 1 }, cb)
          )
          expect(inserted.err, 'insert error').toBeNull()
          expect(inserted.res, 'insert result').toBeTypeOf('object')

          const got = await getUntilGoneWithCallback(collection, key, signal)
          expect(got.res, 'get result after expiry').toBeNull()
          expect(got.err, 'get error after expiry').toBeTruthy()
        })

        test('should fail to insert a second time with callback', async ({
          collection,
          env,
        }) => {
          const inserted = await settleCallback<MutationResult>((cb) =>
            collection.insert(
              sharedKey(env, collection, 'ins'),
              { foo: 'bar' },
              cb
            )
          )
          expect(inserted.err, 'insert error').toBeTruthy()
          expect(inserted.res, 'insert result').toBeNull()
        })

        test('should remove the insert test key with callback', async ({
          collection,
          env,
        }) => {
          const res = await awaitCallback<MutationResult>((cb) =>
            collection.remove(sharedKey(env, collection, 'ins'), cb)
          )
          expect(res.cas, 'remove cas').toBeTruthy()
        })

        // Regression guard (JSCBC-1458), as for the upsert above.
        test.skipIf(belowTier('slow'))(
          'should insert w/ expiry successfully (slow)',
          async ({ collection, env, signal }) => {
            const key = scratchKey(env, collection)

            const res = await collection.insert(key, { foo: 14 }, { expiry: 1 })
            expect(res, 'insert result').toBeTypeOf('object')
            expect(res.cas, 'insert cas').toBeTruthy()

            await expectThrows(
              () => getUntilGone(collection, key, signal),
              DocumentNotFoundError,
              undefined,
              env.ctx({ op: 'get', key, extra: 'after expiry' })
            )
          }
        )
      })

      group('#serverDurability', [ServerFeature.ServerDurability], () => {
        test('should insert w/ server durability', async ({
          collection,
          env,
        }) => {
          const res = await collection.insert(
            sharedKey(env, collection, 'srvdur'),
            { foo: 'bar' },
            { durabilityLevel: DurabilityLevel.PersistToMajority }
          )
          expect(res, 'insert result').toBeTypeOf('object')
          expect(res.cas, 'insert cas').toBeTruthy()
        })

        test('should upsert data w/ server durability', async ({
          collection,
          env,
        }) => {
          const key = sharedKey(env, collection, 'A')
          const res = await collection.upsert(
            key,
            { foo: 'baz' },
            { durabilityLevel: DurabilityLevel.PersistToMajority }
          )
          expect(res, 'upsert result').toBeTypeOf('object')
          expect(res.cas, 'upsert cas').toBeTruthy()

          const gres = await collection.get(key)
          expect(gres.value, 'upserted value').toEqual({ foo: 'baz' })
        })

        test('should replace data correctly w/ server durability', async ({
          collection,
          env,
        }) => {
          const key = sharedKey(env, collection, 'A')
          const res = await collection.replace(
            key,
            { foo: 'qux' },
            { durabilityLevel: DurabilityLevel.PersistToMajority }
          )
          expect(res, 'replace result').toBeTypeOf('object')
          expect(res.cas, 'replace cas').toBeTruthy()

          const gres = await collection.get(key)
          expect(gres.value, 'replaced value').toEqual({ foo: 'qux' })
        })

        test('should remove the insert test key w/ server durability', async ({
          collection,
          env,
        }) => {
          await collection.remove(sharedKey(env, collection, 'srvdur'), {
            durabilityLevel: DurabilityLevel.PersistToMajority,
          })
        })

        test('should fail w/ InvalidDurabilityLevel', async ({
          collection,
          env,
        }) => {
          const key = sharedKey(env, collection, 'srvdur')
          await expectCouchbaseError(
            () =>
              collection.insert(
                key,
                { foo: 'bar' },
                // @ts-expect-error 5 is not a DurabilityLevel member
                { durabilityLevel: 5 }
              ),
            InvalidDurabilityLevel,
            env.ctx({ op: 'insert', key, extra: 'durabilityLevel=5' })
          )
        })
      })

      group('#clientDurability', [ServerFeature.BucketManagement], () => {
        test(
          'should insert w/ client durability',
          OBSERVE_DEADLINE_OPTS,
          async ({ collection, collectionLease, env, task }) => {
            const replicas = await numReplicasOf(
              env,
              collectionLease.bucketName
            )
            const key = sharedKey(env, collection, 'clidur')
            if (task.result?.retryCount) {
              // The attempt reported ambiguous may still have written the key.
              await collection.remove(key).catch(() => undefined)
            }
            const res = await collection.insert(
              key,
              { foo: 'bar' },
              { durabilityPersistTo: 1, durabilityReplicateTo: replicas }
            )
            expect(res, 'insert result').toBeTypeOf('object')
            expect(res.cas, 'insert cas').toBeTruthy()
          }
        )

        test(
          'should upsert data w/ client durability',
          OBSERVE_DEADLINE_OPTS,
          async ({ collection, collectionLease, env }) => {
            const replicas = await numReplicasOf(
              env,
              collectionLease.bucketName
            )
            const key = sharedKey(env, collection, 'A')
            const res = await collection.upsert(
              key,
              { foo: 'baz' },
              { durabilityPersistTo: 1, durabilityReplicateTo: replicas }
            )
            expect(res, 'upsert result').toBeTypeOf('object')
            expect(res.cas, 'upsert cas').toBeTruthy()

            const gres = await collection.get(key)
            expect(gres.value, 'upserted value').toEqual({ foo: 'baz' })
          }
        )

        test(
          'should replace data correctly w/ client durability',
          OBSERVE_DEADLINE_OPTS,
          async ({ collection, collectionLease, env }) => {
            const replicas = await numReplicasOf(
              env,
              collectionLease.bucketName
            )
            const key = sharedKey(env, collection, 'A')
            const res = await collection.replace(
              key,
              { foo: 'qux' },
              { durabilityPersistTo: 1, durabilityReplicateTo: replicas }
            )
            expect(res, 'replace result').toBeTypeOf('object')
            expect(res.cas, 'replace cas').toBeTruthy()

            const gres = await collection.get(key)
            expect(gres.value, 'replaced value').toEqual({ foo: 'qux' })
          }
        )

        // Regression guard (JSCBC-1455): passes client durability options.
        test(
          'should remove the client test key w/ client durability',
          OBSERVE_DEADLINE_OPTS,
          async ({ collection, collectionLease, env, task }) => {
            const replicas = await numReplicasOf(
              env,
              collectionLease.bucketName
            )
            const removed = collection.remove(
              sharedKey(env, collection, 'clidur'),
              { durabilityPersistTo: 1, durabilityReplicateTo: replicas }
            )
            if (task.result?.retryCount) {
              // The attempt reported ambiguous may already have removed it.
              await removed.catch((err: unknown) => {
                if (!(err instanceof DocumentNotFoundError)) {
                  throw err
                }
              })
              return
            }
            await removed
          }
        )

        test('should fail w/ DurabilityImpossibleError', async ({
          collection,
          collectionLease,
          env,
        }) => {
          const replicas = await numReplicasOf(env, collectionLease.bucketName)
          // One past the bucket's replicas; the client rejects anything over 3.
          const replicateTo = replicas + 1
          const key = sharedKey(env, collection, 'clidur')
          await expectCouchbaseError(
            () =>
              collection.insert(
                key,
                { foo: 'bar' },
                { durabilityPersistTo: 1, durabilityReplicateTo: replicateTo }
              ),
            DurabilityImpossibleError,
            env.ctx({ op: 'insert', key, extra: `replicateTo=${replicateTo}` })
          )
        })

        test('should fail w/ InvalidDurabilityPersistToLevel', async ({
          collection,
          collectionLease,
          env,
        }) => {
          const replicas = await numReplicasOf(env, collectionLease.bucketName)
          const key = sharedKey(env, collection, 'clidur')
          await expectCouchbaseError(
            () =>
              collection.insert(
                key,
                { foo: 'bar' },
                { durabilityPersistTo: 6, durabilityReplicateTo: replicas }
              ),
            InvalidDurabilityPersistToLevel,
            env.ctx({ op: 'insert', key, extra: 'persistTo=6' })
          )
        })

        test('should fail w/ InvalidDurabilityReplicateToLevel', async ({
          collection,
          env,
        }) => {
          const key = sharedKey(env, collection, 'clidur')
          await expectCouchbaseError(
            () =>
              collection.insert(
                key,
                { foo: 'bar' },
                { durabilityPersistTo: 1, durabilityReplicateTo: 4 }
              ),
            InvalidDurabilityReplicateToLevel,
            env.ctx({ op: 'insert', key, extra: 'replicateTo=4' })
          )
        })
      })

      describe('#touch', () => {
        // Regression guard (JSCBC-1458): the final read polls until the
        // document expires. The read at 4s stays a fixed wait: it expects the
        // document present, four seconds clear of the expiry.
        test.skipIf(belowTier('slow'))(
          'should touch a document successfully (slow)',
          async ({ collection, env, signal }) => {
            const key = scratchKey(env, collection)

            const res = await collection.insert(key, { foo: 14 }, { expiry: 3 })
            expect(res, 'insert result').toBeTypeOf('object')
            expect(res.cas, 'insert cas').toBeTruthy()

            await collection.get(key)

            const tres = await collection.touch(key, 8)
            expect(tres, 'touch result').toBeTypeOf('object')
            expect(tres.cas, 'touch cas').toBeTruthy()

            await sleep(4000)

            await collection.get(key)

            await expectThrows(
              () => getUntilGone(collection, key, signal),
              DocumentNotFoundError,
              undefined,
              env.ctx({ op: 'get', key, extra: 'after touched expiry' })
            )
          }
        )
      })

      describe('#getAndTouch', () => {
        // Regression guard (JSCBC-1458), as in `#touch` above.
        test.skipIf(belowTier('slow'))(
          'should touch a document successfully (slow)',
          async ({ collection, env, signal }) => {
            const key = scratchKey(env, collection)

            const res = await collection.insert(key, { foo: 14 }, { expiry: 3 })
            expect(res, 'insert result').toBeTypeOf('object')
            expect(res.cas, 'insert cas').toBeTruthy()

            await collection.get(key)

            const tres = await collection.getAndTouch(key, 8)
            expect(tres, 'getAndTouch result').toBeTypeOf('object')
            expect(tres.cas, 'getAndTouch cas').toBeTruthy()
            expect(tres.value, 'getAndTouch value').toEqual({ foo: 14 })

            // Regression guard (JSCBC-784), as in `#get`.
            expect(tres.value, 'value is content').toBe(tres.content)

            await sleep(4000)

            await collection.get(key)

            await expectThrows(
              () => getUntilGone(collection, key, signal),
              DocumentNotFoundError,
              undefined,
              env.ctx({ op: 'get', key, extra: 'after touched expiry' })
            )
          }
        )
      })
    })

    group('#replicas', [ServerFeature.Replicas], () => {
      // Waited on until every copy reads back: the assertions are about the
      // replica read, not how fast the cluster replicated.
      const seedReplicaKey = (env: TestEnv, collection: Collection) =>
        seededKey(env, collection, 'replica', async (key) => {
          await collection.upsert(key, testObjVal)
          await waitUntilReplicated(
            env,
            collection,
            collection.scope.bucket.name,
            key
          )
        })

      test('should perform basic get all replicas', async ({
        collection,
        env,
        signal,
      }) => {
        const key = await seedReplicaKey(env, collection)
        const res = await tryNTimes(
          5,
          1000,
          () => collection.getAllReplicas(key),
          signal
        )

        expect(res, 'replicas').toBeInstanceOf(Array)
        expect(res.length, 'replica count').toBeGreaterThanOrEqual(1)
        expect(res[0], 'replica type').toBeInstanceOf(GetReplicaResult)
        expect(res[0].isReplica, 'isReplica').toBeTypeOf('boolean')
        expect(Object.keys(res[0].cas), 'replica cas').not.toHaveLength(0)
        expect(res[0].content, 'replica content').toEqual(testObjVal)
      })

      test('should perform basic get all replicas with callback', async ({
        collection,
        env,
        signal,
      }) => {
        const key = await seedReplicaKey(env, collection)
        const res = await tryNTimes(
          5,
          1000,
          () =>
            awaitCallback<GetReplicaResult[]>((cb) =>
              collection.getAllReplicas(key, cb)
            ),
          signal
        )

        expect(res, 'replicas').toBeInstanceOf(Array)
        expect(res.length, 'replica count').toBeGreaterThanOrEqual(1)
        expect(res[0], 'replica type').toBeInstanceOf(GetReplicaResult)
        expect(res[0].isReplica, 'isReplica').toBeTypeOf('boolean')
        expect(Object.keys(res[0].cas), 'replica cas').not.toHaveLength(0)
        expect(res[0].content, 'replica content').toEqual(testObjVal)
      })

      test('should perform basic get all replicas with options and callback', async ({
        collection,
        env,
        signal,
      }) => {
        const key = await seedReplicaKey(env, collection)
        const tc = new DefaultTranscoder()
        const res = await tryNTimes(
          5,
          1000,
          () =>
            awaitCallback<GetReplicaResult[]>((cb) =>
              collection.getAllReplicas(key, { transcoder: tc }, cb)
            ),
          signal
        )

        expect(res, 'replicas').toBeInstanceOf(Array)
        expect(res.length, 'replica count').toBeGreaterThanOrEqual(1)
        expect(res[0], 'replica type').toBeInstanceOf(GetReplicaResult)
        expect(res[0].isReplica, 'isReplica').toBeTypeOf('boolean')
        expect(Object.keys(res[0].cas), 'replica cas').not.toHaveLength(0)
        expect(res[0].content, 'replica content').toEqual(testObjVal)
      })

      test('should perform basic get any replica', async ({
        collection,
        env,
      }) => {
        const key = await seedReplicaKey(env, collection)
        const res = await collection.getAnyReplica(key)

        expect(res, 'replica type').toBeInstanceOf(GetReplicaResult)
        expect(Object.keys(res.cas), 'replica cas').not.toHaveLength(0)
        expect(res.content, 'replica content').toEqual(testObjVal)
      })

      test('should perform basic get any replica with callback', async ({
        collection,
        env,
      }) => {
        const key = await seedReplicaKey(env, collection)
        const res = await awaitCallback<GetReplicaResult>((cb) =>
          collection.getAnyReplica(key, cb)
        )

        expect(res, 'replica type').toBeInstanceOf(GetReplicaResult)
        expect(Object.keys(res.cas), 'replica cas').not.toHaveLength(0)
        expect(res.content, 'replica content').toEqual(testObjVal)
      })

      test('should perform basic get any replica with options and callback', async ({
        collection,
        env,
      }) => {
        const key = await seedReplicaKey(env, collection)
        const tc = new DefaultTranscoder()
        const res = await awaitCallback<GetReplicaResult>((cb) =>
          collection.getAnyReplica(key, { transcoder: tc }, cb)
        )

        expect(res, 'replica type').toBeInstanceOf(GetReplicaResult)
        expect(Object.keys(res.cas), 'replica cas').not.toHaveLength(0)
        expect(res.content, 'replica content').toEqual(testObjVal)
      })

      group('#server-groups', [ServerFeature.ServerGroups], () => {
        test('should raise DocumentUnretrievableError for getAnyReplica', async ({
          collection,
          env,
        }) => {
          // The cluster under test sets no preferred server group, so asking
          // for one has nowhere to read from.
          const key = await seedReplicaKey(env, collection)
          await expectThrows(
            () =>
              collection.getAnyReplica(key, {
                readPreference: ReadPreference.SelectedServerGroup,
              }),
            DocumentUnretrievableError,
            undefined,
            env.ctx({ op: 'getAnyReplica', key, extra: 'selected group' })
          )
        })

        test('should raise DocumentUnretrievableError for getAllReplicas', async ({
          collection,
          env,
        }) => {
          const key = await seedReplicaKey(env, collection)
          await expectThrows(
            () =>
              collection.getAllReplicas(key, {
                readPreference: ReadPreference.SelectedServerGroup,
              }),
            DocumentUnretrievableError,
            undefined,
            env.ctx({ op: 'getAllReplicas', key, extra: 'selected group' })
          )
        })
      })
    })

    describe('#binary', () => {
      const seedBinaryKey = (env: TestEnv, collection: Collection) =>
        seededKey(env, collection, 'binary', (key) =>
          collection.insert(key, 14)
        )

      describe('#bigint', () => {
        // Lightweight smoke test of the bigint plumbing; the FIT performer
        // covers the full 64-bit boundary and overflow cases against a real
        // server.
        test('should accept bigint deltas and expose an exact value64', async ({
          collection,
          env,
        }) => {
          const key = scratchKey(env, collection)
          await collection.insert(key, 100)

          const ires = await collection.binary().increment(key, 5n)
          expect(ires, 'increment result').toBeTypeOf('object')
          expect(ires.cas, 'increment cas').toBeTruthy()
          expect(typeof ires.value, 'value type').toBe('number')
          expect(typeof ires.value64, 'value64 type').toBe('bigint')
          expect(ires.value, 'value').toBe(105)
          expect(ires.value64, 'value64').toBe(105n)

          const dres = await collection.binary().decrement(key, 3n)
          expect(dres.value, 'value').toBe(102)
          expect(dres.value64, 'value64').toBe(102n)
        })
      })

      describe('#increment', () => {
        test('should increment successfully', async ({ collection, env }) => {
          const key = await seedBinaryKey(env, collection)
          const res = await collection.binary().increment(key, 3)
          expect(res, 'increment result').toBeTypeOf('object')
          expect(res.cas, 'increment cas').toBeTruthy()
          expect(res.value, 'incremented value').toEqual(17)
          validateMutationToken(res.token, env.ctx({ op: 'increment', key }))

          const gres = await collection.get(key)
          expect(gres.value, 'stored value').toEqual(17)
        })

        test('should increment successfully with callback', async ({
          collection,
          env,
        }) => {
          const key = await seedBinaryKey(env, collection)
          const res = await awaitCallback<CounterResult>((cb) =>
            collection.binary().increment(key, 3, cb)
          )
          expect(res, 'increment result').toBeTypeOf('object')
          expect(res.cas, 'increment cas').toBeTruthy()
          expect(res.value, 'incremented value').toEqual(20)
          validateMutationToken(res.token, env.ctx({ op: 'increment', key }))

          const gres = await awaitCallback<GetResult>((cb) =>
            collection.get(key, cb)
          )
          expect(gres.value, 'stored value').toEqual(20)
        })

        test('should increment successfully with options and callback', async ({
          collection,
          env,
        }) => {
          const key = await seedBinaryKey(env, collection)
          const res = await awaitCallback<CounterResult>((cb) =>
            collection.binary().increment(key, 3, { timeout: 2000 }, cb)
          )
          expect(res, 'increment result').toBeTypeOf('object')
          expect(res.cas, 'increment cas').toBeTruthy()
          expect(res.value, 'incremented value').toEqual(23)
          validateMutationToken(res.token, env.ctx({ op: 'increment', key }))

          const gres = await awaitCallback<GetResult>((cb) =>
            collection.get(key, cb)
          )
          expect(gres.value, 'stored value').toEqual(23)
        })
      })

      describe('#decrement', () => {
        test('should decrement successfully', async ({ collection, env }) => {
          const key = await seedBinaryKey(env, collection)
          const res = await collection.binary().decrement(key, 4)
          expect(res, 'decrement result').toBeTypeOf('object')
          expect(res.cas, 'decrement cas').toBeTruthy()
          expect(res.value, 'decremented value').toEqual(19)
          validateMutationToken(res.token, env.ctx({ op: 'decrement', key }))

          const gres = await collection.get(key)
          expect(gres.value, 'stored value').toEqual(19)
        })

        test('should decrement successfully with callback', async ({
          collection,
          env,
        }) => {
          const key = await seedBinaryKey(env, collection)
          const res = await awaitCallback<CounterResult>((cb) =>
            collection.binary().decrement(key, 3, cb)
          )
          expect(res, 'decrement result').toBeTypeOf('object')
          expect(res.cas, 'decrement cas').toBeTruthy()
          expect(res.value, 'decremented value').toEqual(16)
          validateMutationToken(res.token, env.ctx({ op: 'decrement', key }))

          const gres = await awaitCallback<GetResult>((cb) =>
            collection.get(key, cb)
          )
          expect(gres.value, 'stored value').toEqual(16)
        })

        test('should decrement successfully with options and callback', async ({
          collection,
          env,
        }) => {
          const key = await seedBinaryKey(env, collection)
          const res = await awaitCallback<CounterResult>((cb) =>
            collection.binary().decrement(key, 3, { timeout: 2000 }, cb)
          )
          expect(res, 'decrement result').toBeTypeOf('object')
          expect(res.cas, 'decrement cas').toBeTruthy()
          expect(res.value, 'decremented value').toEqual(13)
          validateMutationToken(res.token, env.ctx({ op: 'decrement', key }))

          const gres = await awaitCallback<GetResult>((cb) =>
            collection.get(key, cb)
          )
          expect(gres.value, 'stored value').toEqual(13)
        })
      })

      describe('#append', () => {
        test('should append successfully', async ({ collection, env }) => {
          const key = await seedBinaryKey(env, collection)
          const res = await collection.binary().append(key, 'world')
          expect(res, 'append result').toBeTypeOf('object')
          expect(res.cas, 'append cas').toBeTruthy()
          validateMutationToken(res.token, env.ctx({ op: 'append', key }))

          const gres = await collection.get(key)
          expect(Buffer.isBuffer(gres.value), 'value is a Buffer').toBe(true)
          expect(gres.value.toString(), 'appended value').toEqual('13world')
        })

        test('should append successfully with callback', async ({
          collection,
          env,
        }) => {
          const key = await seedBinaryKey(env, collection)
          const appended = await settleCallback<MutationResult>((cb) =>
            collection.binary().append(key, '!', cb)
          )
          expect(appended.err, 'append error').toBeNull()
          const res = appended.res
          if (res === null) {
            throw new Error('append reported neither an error nor a result')
          }
          expect(res, 'append result').toBeTypeOf('object')
          expect(res.cas, 'append cas').toBeTruthy()
          validateMutationToken(res.token, env.ctx({ op: 'append', key }))

          const gres = await awaitCallback<GetResult>((cb) =>
            collection.get(key, cb)
          )
          expect(Buffer.isBuffer(gres.value), 'value is a Buffer').toBe(true)
          expect(gres.value.toString(), 'appended value').toEqual('13world!')
        })

        // Regression guard (JSCBC-1456): passes options, so the four argument
        // form is exercised.
        test('should append successfully with options and callback', async ({
          collection,
          env,
        }) => {
          const key = await seedBinaryKey(env, collection)
          const appended = await settleCallback<MutationResult>((cb) =>
            collection.binary().append(key, '!', { timeout: 2000 }, cb)
          )
          expect(appended.err, 'append error').toBeNull()
          const res = appended.res
          if (res === null) {
            throw new Error('append reported neither an error nor a result')
          }
          expect(res, 'append result').toBeTypeOf('object')
          expect(res.cas, 'append cas').toBeTruthy()
          validateMutationToken(res.token, env.ctx({ op: 'append', key }))

          const gres = await awaitCallback<GetResult>((cb) =>
            collection.get(key, cb)
          )
          expect(Buffer.isBuffer(gres.value), 'value is a Buffer').toBe(true)
          expect(gres.value.toString(), 'appended value').toEqual('13world!!')
        })
      })

      describe('#prepend', () => {
        test('should prepend successfully', async ({ collection, env }) => {
          const key = await seedBinaryKey(env, collection)
          const res = await collection.binary().prepend(key, 'big')
          expect(res, 'prepend result').toBeTypeOf('object')
          expect(res.cas, 'prepend cas').toBeTruthy()
          validateMutationToken(res.token, env.ctx({ op: 'prepend', key }))

          const gres = await collection.get(key)
          expect(Buffer.isBuffer(gres.value), 'value is a Buffer').toBe(true)
          expect(gres.value.toString(), 'prepended value').toEqual(
            'big13world!!'
          )
        })

        test('should prepend successfully with callback', async ({
          collection,
          env,
        }) => {
          const key = await seedBinaryKey(env, collection)
          const prepended = await settleCallback<MutationResult>((cb) =>
            collection.binary().prepend(key, 'hello', cb)
          )
          expect(prepended.err, 'prepend error').toBeNull()
          const res = prepended.res
          if (res === null) {
            throw new Error('prepend reported neither an error nor a result')
          }
          expect(res, 'prepend result').toBeTypeOf('object')
          expect(res.cas, 'prepend cas').toBeTruthy()
          validateMutationToken(res.token, env.ctx({ op: 'prepend', key }))

          const gres = await awaitCallback<GetResult>((cb) =>
            collection.get(key, cb)
          )
          expect(Buffer.isBuffer(gres.value), 'value is a Buffer').toBe(true)
          expect(gres.value.toString(), 'prepended value').toEqual(
            'hellobig13world!!'
          )
        })

        test('should prepend successfully with options and callback', async ({
          collection,
          env,
        }) => {
          const key = await seedBinaryKey(env, collection)
          const prepended = await settleCallback<MutationResult>((cb) =>
            collection.binary().prepend(key, 'the', { timeout: 2000 }, cb)
          )
          expect(prepended.err, 'prepend error').toBeNull()
          const res = prepended.res
          if (res === null) {
            throw new Error('prepend reported neither an error nor a result')
          }
          expect(res, 'prepend result').toBeTypeOf('object')
          expect(res.cas, 'prepend cas').toBeTruthy()
          validateMutationToken(res.token, env.ctx({ op: 'prepend', key }))

          const gres = await awaitCallback<GetResult>((cb) =>
            collection.get(key, cb)
          )
          expect(Buffer.isBuffer(gres.value), 'value is a Buffer').toBe(true)
          expect(gres.value.toString(), 'prepended value').toEqual(
            'thehellobig13world!!'
          )
        })
      })

      group('#serverDurability', [ServerFeature.ServerDurability], () => {
        const seedDurabilityKey = (env: TestEnv, collection: Collection) =>
          seededKey(env, collection, 'binary-srvdur', (key) =>
            collection.insert(key, 14)
          )

        // Passed explicitly: unlike other mutations, the binary operations do
        // not apply `kvDurableTimeout` when a durability level is set, and a
        // persist to majority on a loaded cluster can outlast `kvTimeout`.
        const durable = {
          durabilityLevel: DurabilityLevel.PersistToMajority,
          timeout: 10_000,
        }

        test('should increment successfully w/ server durability', async ({
          collection,
          env,
        }) => {
          const key = await seedDurabilityKey(env, collection)
          const res = await collection.binary().increment(key, 3, durable)
          expect(res, 'increment result').toBeTypeOf('object')
          expect(res.cas, 'increment cas').toBeTruthy()
          expect(res.value, 'incremented value').toEqual(17)

          const gres = await collection.get(key)
          expect(gres.value, 'stored value').toEqual(17)
        })

        test('should decrement successfully w/ server durability', async ({
          collection,
          env,
        }) => {
          const key = await seedDurabilityKey(env, collection)
          const res = await collection.binary().decrement(key, 4, durable)
          expect(res, 'decrement result').toBeTypeOf('object')
          expect(res.cas, 'decrement cas').toBeTruthy()
          expect(res.value, 'decremented value').toEqual(13)

          const gres = await collection.get(key)
          expect(gres.value, 'stored value').toEqual(13)
        })

        test('should append successfuly w/ server durability', async ({
          collection,
          env,
        }) => {
          const key = await seedDurabilityKey(env, collection)
          const res = await collection.binary().append(key, 'world', durable)
          expect(res, 'append result').toBeTypeOf('object')
          expect(res.cas, 'append cas').toBeTruthy()

          const gres = await collection.get(key)
          expect(Buffer.isBuffer(gres.value), 'value is a Buffer').toBe(true)
          expect(gres.value.toString(), 'appended value').toEqual('13world')
        })

        test('should prepend successfuly w/ server durability', async ({
          collection,
          env,
        }) => {
          const key = await seedDurabilityKey(env, collection)
          const res = await collection.binary().prepend(key, 'hello', durable)
          expect(res, 'prepend result').toBeTypeOf('object')
          expect(res.cas, 'prepend cas').toBeTruthy()

          const gres = await collection.get(key)
          expect(Buffer.isBuffer(gres.value), 'value is a Buffer').toBe(true)
          expect(gres.value.toString(), 'prepended value').toEqual(
            'hello13world'
          )
        })
      })

      group('#clientDurability', [ServerFeature.BucketManagement], () => {
        const seedDurabilityKey = (env: TestEnv, collection: Collection) =>
          seededKey(env, collection, 'binary-clidur', (key) =>
            collection.insert(key, 14)
          )

        test('should increment successfully w/ client durability', async ({
          collection,
          collectionLease,
          env,
        }) => {
          const key = await seedDurabilityKey(env, collection)
          const replicas = await numReplicasOf(env, collectionLease.bucketName)
          const res = await collection.binary().increment(key, 3, {
            durabilityPersistTo: 1,
            durabilityReplicateTo: replicas,
          })
          expect(res, 'increment result').toBeTypeOf('object')
          expect(res.cas, 'increment cas').toBeTruthy()
          expect(res.value, 'incremented value').toEqual(17)

          const gres = await collection.get(key)
          expect(gres.value, 'stored value').toEqual(17)
        })

        test('should decrement successfully w/ client durability', async ({
          collection,
          collectionLease,
          env,
        }) => {
          const key = await seedDurabilityKey(env, collection)
          const replicas = await numReplicasOf(env, collectionLease.bucketName)
          const res = await collection.binary().decrement(key, 4, {
            durabilityPersistTo: 1,
            durabilityReplicateTo: replicas,
          })
          expect(res, 'decrement result').toBeTypeOf('object')
          expect(res.cas, 'decrement cas').toBeTruthy()
          expect(res.value, 'decremented value').toEqual(13)

          const gres = await collection.get(key)
          expect(gres.value, 'stored value').toEqual(13)
        })

        test('should append successfuly w/ client durability', async ({
          collection,
          collectionLease,
          env,
        }) => {
          const key = await seedDurabilityKey(env, collection)
          const replicas = await numReplicasOf(env, collectionLease.bucketName)
          const res = await collection.binary().append(key, 'world', {
            durabilityPersistTo: 1,
            durabilityReplicateTo: replicas,
          })
          expect(res, 'append result').toBeTypeOf('object')
          expect(res.cas, 'append cas').toBeTruthy()

          const gres = await collection.get(key)
          expect(Buffer.isBuffer(gres.value), 'value is a Buffer').toBe(true)
          expect(gres.value.toString(), 'appended value').toEqual('13world')
        })

        test('should prepend successfuly w/ client durability', async ({
          collection,
          collectionLease,
          env,
        }) => {
          const key = await seedDurabilityKey(env, collection)
          const replicas = await numReplicasOf(env, collectionLease.bucketName)
          const res = await collection.binary().prepend(key, 'hello', {
            durabilityPersistTo: 1,
            durabilityReplicateTo: replicas,
          })
          expect(res, 'prepend result').toBeTypeOf('object')
          expect(res.cas, 'prepend cas').toBeTruthy()

          const gres = await collection.get(key)
          expect(Buffer.isBuffer(gres.value), 'value is a Buffer').toBe(true)
          expect(gres.value.toString(), 'prepended value').toEqual(
            'hello13world'
          )
        })
      })
    })

    describe('#locks', () => {
      const seedLockKey = (env: TestEnv, collection: Collection) =>
        seededKey(env, collection, 'lock', (key) =>
          collection.insert(key, { foo: 14 })
        )

      test.skipIf(belowTier('slow'))(
        'should lock successfully (slow)',
        async ({ collection, env }) => {
          const key = await seedLockKey(env, collection)

          const res = await collection.getAndLock(key, 2)
          expect(res, 'getAndLock result').toBeTypeOf('object')
          expect(res.cas, 'getAndLock cas').toBeTruthy()
          expect(res.value, 'locked value').toEqual({ foo: 14 })
          const prevCas = res.cas

          // The lock's own CAS still permits a write.
          await collection.replace(key, { foo: 9 }, { cas: prevCas })

          await collection.getAndLock(key, 3)

          // A write without the CAS blocks until the lock lapses.
          const stime = Date.now()
          try {
            await collection.upsert(key, { foo: 9 }, { timeout: 5000 })
          } catch {
            // Expected in some configurations; the elapsed time is the
            // assertion.
          }
          const etime = Date.now()
          expect(etime - stime, 'time blocked by the lock').toBeGreaterThan(
            1000
          )
        }
      )

      test('should unlock successfully w/ default CAS', async ({
        collection,
        env,
      }) => {
        const key = await seedLockKey(env, collection)
        const res = await collection.getAndLock(key, 1)

        await collection.unlock(key, res.cas)

        await collection.upsert(key, { foo: 14 })
      })

      test('should unlock successfully w/ CAS as string', async ({
        collection,
        env,
      }) => {
        const key = await seedLockKey(env, collection)
        const res = await collection.getAndLock(key, 1)

        await collection.unlock(key, res.cas.toString())

        await collection.upsert(key, { foo: 15 })
      })

      test('should unlock successfully w/ CAS as buffer', async ({
        collection,
        env,
      }) => {
        const key = await seedLockKey(env, collection)
        const res = await collection.getAndLock(key, 1)
        const casBuff = Buffer.allocUnsafe(8)
        casBuff.writeBigUInt64LE(BigInt(res.cas.toString()))

        await collection.unlock(key, casBuff)

        await collection.upsert(key, { foo: 16 })
      })

      test('should unlock successfully w/ CAS as object w/ raw buffer', async ({
        collection,
        env,
      }) => {
        const key = await seedLockKey(env, collection)
        const res = await collection.getAndLock(key, 1)
        const casObj = { raw: Buffer.allocUnsafe(8) }
        casObj.raw.writeBigUInt64LE(BigInt(res.cas.toString()))

        // @ts-expect-error `{ raw: Buffer }` is accepted at runtime, not typed
        await collection.unlock(key, casObj)

        await collection.upsert(key, { foo: 17 })
      })

      test.skipIf(lacking(ServerFeature.NotLockedKVStatus))(
        'should raise DocumentNotLockedError on unlock if document not locked',
        async ({ collection, env }) => {
          const key = await seedLockKey(env, collection)
          const res = await collection.getAndLock(key, 1)
          const prevCas = res.cas

          await collection.unlock(key, prevCas)

          await expectCouchbaseError(
            () => collection.unlock(key, prevCas),
            DocumentNotLockedError,
            env.ctx({ op: 'unlock', key, extra: 'already unlocked' })
          )
        }
      )
    })

    describe('#subdoc', () => {
      const seedSubdocKey = (env: TestEnv, collection: Collection) =>
        seededKey(env, collection, 'subdoc', (key) =>
          collection.insert(key, { ...subdocVal })
        )

      describe('#lookupIn', () => {
        test('should lookupIn successfully', async ({ collection, env }) => {
          const key = await seedSubdocKey(env, collection)
          const res = await collection.lookupIn(key, [
            LookupInSpec.get('baz'),
            LookupInSpec.get('bar'),
            LookupInSpec.exists('not-exists'),
          ])
          expect(res, 'lookupIn result').toBeTypeOf('object')
          expect(res.cas, 'lookupIn cas').toBeTruthy()
          expect(res.content, 'lookupIn content').toBeInstanceOf(Array)
          expect(res.content.length, 'lookupIn content length').toBe(3)
          expect(res.content[0].error, 'spec 0 error').toBeFalsy()
          expect(res.content[0].value, 'spec 0 value').toEqual('hello')
          expect(res.content[1].error, 'spec 1 error').toBeFalsy()
          expect(res.content[1].value, 'spec 1 value').toEqual(2)
          expect(res.content[2].error, 'spec 2 error').toBeFalsy()
          expect(res.content[2].value, 'spec 2 value').toEqual(false)

          // Regression guard (JSCBC-730): `results` and `content` must be the
          // same array, not merely equal ones.
          expect(res.results, 'results is content').toBe(res.content)
        })

        test('should raise InvalidArgument for empty specs lookupIn', async ({
          collection,
          env,
        }) => {
          const key = await seedSubdocKey(env, collection)
          await expectCouchbaseError(
            () => collection.lookupIn(key, []),
            InvalidArgumentError,
            env.ctx({ op: 'lookupIn', key, extra: 'empty specs' })
          )
        })

        test('should doc-not-found for missing lookupIn', async ({
          collection,
          env,
        }) => {
          await expectCouchbaseError(
            () =>
              collection.lookupIn('some-document-which-does-not-exist', [
                LookupInSpec.get('baz'),
              ]),
            DocumentNotFoundError,
            env.ctx({
              op: 'lookupIn',
              key: 'some-document-which-does-not-exist',
            })
          )
        })

        test.skipIf(lacking(ServerFeature.Xattr))(
          'should lookupIn with accessDeleted successfully',
          async ({ collection, env }) => {
            const key = scratchKey(env, collection)
            const upsertRes = await collection.upsert(key, testObjVal)
            expect(upsertRes.cas, 'upsert cas').toBeTruthy()

            const removeRes = await collection.remove(key)
            expect(removeRes.cas, 'remove cas').toBeTruthy()

            const res = await collection.lookupIn(
              key,
              [LookupInSpec.exists('$document.revid', { xattr: true })],
              { accessDeleted: true }
            )

            expect(res.content[0].error, 'spec 0 error').toBeNull()
            expect(res.content[0].value, 'spec 0 value').toBe(true)
          }
        )

        test('should use LookupInResult.exist() successfully', async ({
          collection,
          env,
        }) => {
          const key = await seedSubdocKey(env, collection)
          const res = await collection.lookupIn(key, [
            LookupInSpec.exists('bar'),
            LookupInSpec.exists('not-exists'),
          ])
          expect(res, 'lookupIn result').toBeTypeOf('object')
          expect(res.cas, 'lookupIn cas').toBeTruthy()
          expect(res.content, 'lookupIn content').toBeInstanceOf(Array)
          expect(res.content.length, 'lookupIn content length').toBe(2)
          expect(res.exists(0), 'exists(0)').toBe(true)
          expect(res.content[0].value, 'spec 0 value').toBe(true)
          expect(res.exists(1), 'exists(1)').toBe(false)
          expect(res.content[1].value, 'spec 1 value').toBe(false)
        })

        group('#macros', [ServerFeature.Xattr], () => {
          const macros = [
            LookupInMacro.Cas,
            LookupInMacro.Document,
            LookupInMacro.Expiry,
            LookupInMacro.IsDeleted,
            LookupInMacro.LastModified,
            LookupInMacro.RevId,
            LookupInMacro.SeqNo,
            LookupInMacro.ValueSizeBytes,
          ]

          for (const macro of macros) {
            test(`correctly executes ${macro._value} lookup-in macro`, async ({
              collection,
              env,
            }) => {
              const key = await seedSubdocKey(env, collection)
              const res = await collection.lookupIn(key, [
                LookupInSpec.get(macro, { xattr: true }),
              ])
              const documentRes = (
                await collection.lookupIn(key, [
                  LookupInSpec.get(LookupInMacro.Document, { xattr: true }),
                ])
              ).content[0].value
              const macroKey = macro._value.replace('$document.', '')
              const macroRes = res.content[0].value

              if (macroKey === '$document') {
                expect(macroRes, 'whole document macro').toEqual(documentRes)
              } else {
                expect(macroRes, `${macroKey} macro`).toBe(
                  documentRes[macroKey]
                )
                if (
                  ['CAS', 'seqno', 'vbucket_uuid', 'value_crc32c'].includes(
                    macroKey
                  )
                ) {
                  expect(
                    macroRes.startsWith('0x'),
                    `${macroKey} is hex-encoded`
                  ).toBe(true)
                }
              }
            })
          }
        })
      })

      describe('#mutateIn', () => {
        test('should mutateIn successfully', async ({ collection, env }) => {
          const key = await seedSubdocKey(env, collection)
          const res = await collection.mutateIn(key, [
            MutateInSpec.increment('bar', 3),
            MutateInSpec.decrement('bar', 2),
            MutateInSpec.upsert('baz', 'world'),
            MutateInSpec.arrayAppend('arr', 4),
            MutateInSpec.arrayAppend('arr', [5, 6], { multi: true }),
          ])
          expect(res, 'mutateIn result').toBeTypeOf('object')
          expect(res.cas, 'mutateIn cas').toBeTruthy()
          validateMutationToken(res.token, env.ctx({ op: 'mutateIn', key }))

          // Regression guard (JSCBC-1457): a failed spec makes `mutateIn`
          // throw, so what is left to check is that each slot holds an entry.
          expect(res.content[0], 'spec 0').toBeInstanceOf(MutateInResultEntry)
          expect(res.content[0].value, 'spec 0 value').toBe(5)
          expect(res.content[1], 'spec 1').toBeInstanceOf(MutateInResultEntry)
          expect(res.content[1].value, 'spec 1 value').toBe(3)

          const gres = await collection.get(key)
          expect(gres.value, 'document').toBeTruthy()
          expect(gres.value.bar, 'bar').toBe(3)
          expect(gres.value.baz, 'baz').toBe('world')
          expect(gres.value.arr, 'arr').toEqual([1, 2, 3, 4, 5, 6])
        })

        test('should raise InvalidArgument for empty specs mutateIn', async ({
          collection,
          env,
        }) => {
          const key = await seedSubdocKey(env, collection)
          await expectCouchbaseError(
            () => collection.mutateIn(key, []),
            InvalidArgumentError,
            env.ctx({ op: 'mutateIn', key, extra: 'empty specs' })
          )
        })

        test('should cas mismatch when mutatein with wrong cas', async ({
          collection,
          env,
        }) => {
          const key = await seedSubdocKey(env, collection)
          const getRes = await collection.get(key)

          await collection.replace(key, { bar: 1 })

          await expectCouchbaseError(
            () =>
              collection.mutateIn(key, [MutateInSpec.increment('bar', 3)], {
                cas: getRes.cas,
              }),
            CasMismatchError,
            env.ctx({ op: 'mutateIn', key, extra: 'stale cas' })
          )
        })

        group('#macros', MUTATE_IN_MACROS, () => {
          const xattrPath = 'xattr-macro'
          const macros = [
            MutateInMacro.Cas,
            MutateInMacro.SeqNo,
            MutateInMacro.ValueCrc32c,
          ]

          test('correctly executes arrayaddunique mutate-in macros', async ({
            collection,
            env,
          }) => {
            const key = (await macroDocsFor(env, collection)).next()
            // Regression guard (JSCBC-1235): the server rejects a mutate-in
            // macro used with arrayAddUnique. Tighten this if the server-side
            // issue is ever addressed.
            await expectCouchbaseError(
              () =>
                collection.mutateIn(key, [
                  MutateInSpec.upsert(xattrPath, [], { xattr: true }),
                  MutateInSpec.arrayAddUnique(xattrPath, MutateInMacro.Cas),
                  MutateInSpec.arrayAddUnique(xattrPath, MutateInMacro.SeqNo),
                  MutateInSpec.arrayAddUnique(
                    xattrPath,
                    MutateInMacro.ValueCrc32c
                  ),
                ]),
              InvalidArgumentError,
              env.ctx({ op: 'mutateIn', key, extra: 'arrayAddUnique macro' })
            )
          })

          test('correctly executes arrayappend mutate-in macros', async ({
            collection,
            env,
          }) => {
            const key = (await macroDocsFor(env, collection)).next()
            const mutateInRes = await collection.mutateIn(key, [
              MutateInSpec.arrayAppend(xattrPath, MutateInMacro.Cas, {
                createPath: true,
              }),
              MutateInSpec.arrayAppend(xattrPath, MutateInMacro.SeqNo),
              MutateInSpec.arrayAppend(xattrPath, MutateInMacro.ValueCrc32c),
            ])
            const res: string[] = (
              await collection.lookupIn(key, [
                LookupInSpec.get(xattrPath, { xattr: true }),
              ])
            ).content[0].value
            expect(
              BigInt(SdUtils.convertMacroCasToCas(res[0])),
              'macro cas matches mutation cas'
            ).toEqual(BigInt(mutateInRes.cas.toString()))
            expect(res[0], 'entry 0').toBeTypeOf('string')
            expect(res[1], 'entry 1').toBeTypeOf('string')
            expect(res[2], 'entry 2').toBeTypeOf('string')
            expect(res[0].startsWith('0x'), 'entry 0 is hex').toBe(true)
            expect(res[1].startsWith('0x'), 'entry 1 is hex').toBe(true)
            expect(res[2].startsWith('0x'), 'entry 2 is hex').toBe(true)
          })

          test('correctly executes arrayinsert mutate-in macros', async ({
            collection,
            env,
          }) => {
            const key = (await macroDocsFor(env, collection)).next()
            const mutateInRes = await collection.mutateIn(key, [
              MutateInSpec.upsert(xattrPath, [], { xattr: true }),
              MutateInSpec.arrayInsert(`${xattrPath}[0]`, MutateInMacro.Cas),
              MutateInSpec.arrayInsert(`${xattrPath}[1]`, MutateInMacro.SeqNo),
              MutateInSpec.arrayInsert(
                `${xattrPath}[2]`,
                MutateInMacro.ValueCrc32c
              ),
            ])
            const res: string[] = (
              await collection.lookupIn(key, [
                LookupInSpec.get(xattrPath, { xattr: true }),
              ])
            ).content[0].value
            expect(
              BigInt(SdUtils.convertMacroCasToCas(res[0])),
              'macro cas matches mutation cas'
            ).toEqual(BigInt(mutateInRes.cas.toString()))
            expect(res[0], 'entry 0').toBeTypeOf('string')
            expect(res[1], 'entry 1').toBeTypeOf('string')
            expect(res[2], 'entry 2').toBeTypeOf('string')
            expect(res[0].startsWith('0x'), 'entry 0 is hex').toBe(true)
            expect(res[1].startsWith('0x'), 'entry 1 is hex').toBe(true)
            expect(res[2].startsWith('0x'), 'entry 2 is hex').toBe(true)
          })

          test('correctly executes arrayprepend mutate-in macros', async ({
            collection,
            env,
          }) => {
            const key = (await macroDocsFor(env, collection)).next()
            const mutateInRes = await collection.mutateIn(key, [
              MutateInSpec.arrayPrepend(xattrPath, MutateInMacro.Cas, {
                createPath: true,
              }),
              MutateInSpec.arrayPrepend(xattrPath, MutateInMacro.SeqNo),
              MutateInSpec.arrayPrepend(xattrPath, MutateInMacro.ValueCrc32c),
            ])
            const res: string[] = (
              await collection.lookupIn(key, [
                LookupInSpec.get(xattrPath, { xattr: true }),
              ])
            ).content[0].value
            expect(
              BigInt(SdUtils.convertMacroCasToCas(res[2])),
              'macro cas matches mutation cas'
            ).toEqual(BigInt(mutateInRes.cas.toString()))
            expect(res[0], 'entry 0').toBeTypeOf('string')
            expect(res[1], 'entry 1').toBeTypeOf('string')
            expect(res[2], 'entry 2').toBeTypeOf('string')
            expect(res[0].startsWith('0x'), 'entry 0 is hex').toBe(true)
            expect(res[1].startsWith('0x'), 'entry 1 is hex').toBe(true)
            expect(res[2].startsWith('0x'), 'entry 2 is hex').toBe(true)
          })

          for (const macro of macros) {
            test(`correctly executes ${macro._value} mutate-in macro`, async ({
              collection,
              env,
            }) => {
              const key = (await macroDocsFor(env, collection)).next()
              const readBack = async (): Promise<string> =>
                (
                  await collection.lookupIn(key, [
                    LookupInSpec.get(xattrPath, { xattr: true }),
                  ])
                ).content[0].value

              let mutateInRes = await collection.mutateIn(key, [
                MutateInSpec.insert(xattrPath, macro),
              ])
              let res = await readBack()

              expect(res, 'inserted macro').toBeTypeOf('string')
              expect(res.startsWith('0x'), 'inserted macro is hex').toBe(true)
              if (macro._value.includes('CAS')) {
                expect(
                  BigInt(SdUtils.convertMacroCasToCas(res)),
                  'inserted macro cas'
                ).toEqual(BigInt(mutateInRes.cas.toString()))
              }

              mutateInRes = await collection.mutateIn(key, [
                MutateInSpec.upsert(xattrPath, macro),
              ])
              res = await readBack()

              expect(res, 'upserted macro').toBeTypeOf('string')
              expect(res.startsWith('0x'), 'upserted macro is hex').toBe(true)
              if (macro._value.includes('CAS')) {
                expect(
                  BigInt(SdUtils.convertMacroCasToCas(res)),
                  'upserted macro cas'
                ).toEqual(BigInt(mutateInRes.cas.toString()))
              }

              mutateInRes = await collection.mutateIn(key, [
                MutateInSpec.replace(xattrPath, macro),
              ])
              res = await readBack()

              expect(res, 'replaced macro').toBeTypeOf('string')
              expect(res.startsWith('0x'), 'replaced macro is hex').toBe(true)
              if (macro._value.includes('CAS')) {
                expect(
                  BigInt(SdUtils.convertMacroCasToCas(res)),
                  'replaced macro cas'
                ).toEqual(BigInt(mutateInRes.cas.toString()))
              }
            })
          }
        })
      })

      group(
        '#replicas',
        [ServerFeature.SubdocReadReplica, ServerFeature.Replicas],
        () => {
          // Waited on as the plain replica key is: durable to a majority is
          // not every replica holding it.
          const seedReplicaKey = (env: TestEnv, collection: Collection) =>
            seededKey(env, collection, 'subdoc-replica', async (key) => {
              await collection.insert(
                key,
                { ...subdocVal },
                {
                  durabilityLevel: DurabilityLevel.MajorityAndPersistOnMaster,
                }
              )
              await waitUntilReplicated(
                env,
                collection,
                collection.scope.bucket.name,
                key
              )
            })

          test('should lookupInAnyReplica successfully', async ({
            collection,
            env,
          }) => {
            const key = await seedReplicaKey(env, collection)
            const res = await collection.lookupInAnyReplica(key, [
              LookupInSpec.get('baz'),
              LookupInSpec.get('bar'),
              LookupInSpec.exists('not-exists'),
            ])
            expect(res, 'result type').toBeInstanceOf(LookupInReplicaResult)
            expect(res.cas, 'cas').toBeTruthy()
            expect(res.isReplica, 'isReplica').toBeTypeOf('boolean')
            expect(res.content, 'content').toBeInstanceOf(Array)
            expect(res.content.length, 'content length').toBe(3)
            expect(res.content[0].error, 'spec 0 error').toBeFalsy()
            expect(res.content[0].value, 'spec 0 value').toEqual('hello')
            expect(res.content[1].error, 'spec 1 error').toBeFalsy()
            expect(res.content[1].value, 'spec 1 value').toEqual(2)
            expect(res.content[2].error, 'spec 2 error').toBeFalsy()
            expect(res.content[2].value, 'spec 2 value').toEqual(false)
          })

          test('should lookupInAllReplicas successfully', async ({
            collection,
            env,
          }) => {
            const key = await seedReplicaKey(env, collection)
            const res = await collection.lookupInAllReplicas(key, [
              LookupInSpec.get('baz'),
              LookupInSpec.get('bar'),
              LookupInSpec.exists('not-exists'),
            ])
            expect(res, 'replicas').toBeInstanceOf(Array)
            let activeCount = 0
            res.forEach((replica) => {
              if (!replica.isReplica) {
                activeCount++
              }
              expect(replica, 'replica type').toBeInstanceOf(
                LookupInReplicaResult
              )
              expect(replica.cas, 'replica cas').toBeTruthy()
              expect(replica.content, 'replica content').toBeInstanceOf(Array)
              expect(replica.content.length, 'content length').toBe(3)
              expect(replica.content[0].error, 'spec 0 error').toBeFalsy()
              expect(replica.content[0].value, 'spec 0 value').toEqual('hello')
              expect(replica.content[1].error, 'spec 1 error').toBeFalsy()
              expect(replica.content[1].value, 'spec 1 value').toEqual(2)
              expect(replica.content[2].error, 'spec 2 error').toBeFalsy()
              expect(replica.content[2].value, 'spec 2 value').toEqual(false)
            })
            expect(activeCount, 'active replica count').toBe(1)
          })

          test('should stream lookupInAllReplicas correctly', async ({
            collection,
            env,
          }) => {
            const key = await seedReplicaKey(env, collection)
            const streamLookupInReplica = (
              id: string,
              specs: LookupInSpec[]
            ): Promise<{ results: LookupInReplicaResult[] }> =>
              new Promise((resolve, reject) => {
                const resultsOut: LookupInReplicaResult[] = []
                // `lookupInAllReplicas` returns a `StreamableReplicasPromise`
                // but is declared as a plain `Promise`, hiding its streaming
                // API from a TypeScript caller (@FINDING(JSCBC-1463)).
                ;(
                  collection.lookupInAllReplicas(
                    id,
                    specs
                  ) as StreamableReplicasPromise<
                    LookupInReplicaResult[],
                    LookupInReplicaResult
                  >
                )
                  .on('replica', (res: LookupInReplicaResult) => {
                    resultsOut.push(res)
                  })
                  .on('end', () => {
                    resolve({ results: resultsOut })
                  })
                  .on('error', (err: Error) => {
                    reject(err)
                  })
              })

            const specs = [
              LookupInSpec.get('baz'),
              LookupInSpec.get('bar'),
              LookupInSpec.exists('not-exists'),
            ]
            const res = await streamLookupInReplica(key, specs)
            expect(res.results, 'streamed replicas').toBeInstanceOf(Array)
            let activeCount = 0
            res.results.forEach((replica) => {
              if (!replica.isReplica) {
                activeCount++
              }
              expect(replica, 'replica type').toBeInstanceOf(
                LookupInReplicaResult
              )
              expect(replica.cas, 'replica cas').toBeTruthy()
              expect(replica.content, 'replica content').toBeInstanceOf(Array)
              expect(replica.content.length, 'content length').toBe(3)
              expect(replica.content[0].error, 'spec 0 error').toBeFalsy()
              expect(replica.content[0].value, 'spec 0 value').toEqual('hello')
              expect(replica.content[1].error, 'spec 1 error').toBeFalsy()
              expect(replica.content[1].value, 'spec 1 value').toEqual(2)
              expect(replica.content[2].error, 'spec 2 error').toBeFalsy()
              expect(replica.content[2].value, 'spec 2 value').toEqual(false)
            })
            expect(activeCount, 'active replica count').toBe(1)
          })

          test('should successfully run lookupInAllReplicas with a callback', async ({
            collection,
            env,
          }) => {
            const key = await seedReplicaKey(env, collection)
            const res = await awaitCallback<LookupInReplicaResult[]>((cb) =>
              collection.lookupInAllReplicas(key, [LookupInSpec.get('baz')], cb)
            )
            expect(res.length, 'replica count').toBeGreaterThanOrEqual(1)
            expect(res[0], 'replica type').toBeInstanceOf(LookupInReplicaResult)
            expect(res[0].isReplica, 'isReplica').toBeTypeOf('boolean')
            expect(Object.keys(res[0].cas), 'replica cas').not.toHaveLength(0)
            expect(res[0].content[0].value, 'spec 0 value').toEqual('hello')
          })

          test('should successfully run lookupInAnyReplica with a callback', async ({
            collection,
            env,
          }) => {
            const key = await seedReplicaKey(env, collection)
            const res = await awaitCallback<LookupInReplicaResult>((cb) =>
              collection.lookupInAnyReplica(key, [LookupInSpec.get('baz')], cb)
            )
            expect(res, 'replica type').toBeInstanceOf(LookupInReplicaResult)
            expect(Object.keys(res.cas), 'replica cas').not.toHaveLength(0)
            expect(res.isReplica, 'isReplica').toBeTypeOf('boolean')
            expect(res.content[0].value, 'spec 0 value').toEqual('hello')
          })

          test('should doc-not-found for missing doc lookupInAllReplicas', async ({
            collection,
            env,
          }) => {
            // Seeded although the key read is missing: a replica that has not
            // learned a new collection yet answers with a timeout rather than
            // "not found", and the seed's wait is what rules that out.
            await seedReplicaKey(env, collection)
            await expectCouchbaseError(
              () =>
                collection.lookupInAllReplicas(
                  'some-document-which-does-not-exist',
                  [LookupInSpec.get('baz')]
                ),
              DocumentNotFoundError,
              env.ctx({
                op: 'lookupInAllReplicas',
                key: 'some-document-which-does-not-exist',
              })
            )
          })

          test('should raise InvalidArgument for empty specs lookupInAllReplicas', async ({
            collection,
            env,
          }) => {
            const key = await seedReplicaKey(env, collection)
            await expectCouchbaseError(
              () => collection.lookupInAllReplicas(key, []),
              InvalidArgumentError,
              env.ctx({ op: 'lookupInAllReplicas', key, extra: 'empty specs' })
            )
          })

          test('should doc-irretrievable for missing doc lookupInAnyReplica', async ({
            collection,
            env,
          }) => {
            // Seeded for the reason given in the lookupInAllReplicas case.
            await seedReplicaKey(env, collection)
            await expectCouchbaseError(
              () =>
                collection.lookupInAnyReplica(
                  'some-document-which-does-not-exist',
                  [LookupInSpec.get('baz')]
                ),
              DocumentUnretrievableError,
              env.ctx({
                op: 'lookupInAnyReplica',
                key: 'some-document-which-does-not-exist',
              })
            )
          })

          test('should raise InvalidArgument for empty specs lookupInAnyReplica', async ({
            collection,
            env,
          }) => {
            const key = await seedReplicaKey(env, collection)
            await expectCouchbaseError(
              () => collection.lookupInAnyReplica(key, []),
              InvalidArgumentError,
              env.ctx({ op: 'lookupInAnyReplica', key, extra: 'empty specs' })
            )
          })

          group('#server-groups', [ServerFeature.ServerGroups], () => {
            test('should raise DocumentUnretrievableError for lookupInAnyReplica', async ({
              collection,
              env,
            }) => {
              // The cluster under test sets no preferred server group, so
              // asking for one has nowhere to read from.
              const key = await seedReplicaKey(env, collection)
              await expectThrows(
                () =>
                  collection.lookupInAnyReplica(
                    key,
                    [
                      LookupInSpec.get('baz'),
                      LookupInSpec.get('bar'),
                      LookupInSpec.exists('not-exists'),
                    ],
                    { readPreference: ReadPreference.SelectedServerGroup }
                  ),
                DocumentUnretrievableError,
                undefined,
                env.ctx({
                  op: 'lookupInAnyReplica',
                  key,
                  extra: 'selected group',
                })
              )
            })

            test('should raise DocumentUnretrievableError for lookupInAllReplicas', async ({
              collection,
              env,
            }) => {
              const key = await seedReplicaKey(env, collection)
              await expectThrows(
                () =>
                  collection.lookupInAllReplicas(
                    key,
                    [
                      LookupInSpec.get('baz'),
                      LookupInSpec.get('bar'),
                      LookupInSpec.exists('not-exists'),
                    ],
                    { readPreference: ReadPreference.SelectedServerGroup }
                  ),
                DocumentUnretrievableError,
                undefined,
                env.ctx({
                  op: 'lookupInAllReplicas',
                  key,
                  extra: 'selected group',
                })
              )
            })
          })
        }
      )

      group('#serverDurability', [ServerFeature.ServerDurability], () => {
        test('should mutateIn successfully w/ server durability', async ({
          collection,
          env,
        }) => {
          const key = await seededKey(env, collection, 'subdoc-srvdur', (k) =>
            collection.insert(k, { ...subdocVal })
          )
          const res = await collection.mutateIn(
            key,
            [
              MutateInSpec.increment('bar', 3),
              MutateInSpec.upsert('baz', 'world'),
              MutateInSpec.arrayAppend('arr', 4),
              MutateInSpec.arrayAppend('arr', [5, 6], { multi: true }),
            ],
            { durabilityLevel: DurabilityLevel.PersistToMajority }
          )
          expect(res, 'mutateIn result').toBeTypeOf('object')
          expect(res.cas, 'mutateIn cas').toBeTruthy()
          validateMutationToken(res.token, env.ctx({ op: 'mutateIn', key }))

          // Regression guard (JSCBC-1457), as above.
          expect(res.content[0], 'spec 0').toBeInstanceOf(MutateInResultEntry)
          expect(res.content[0].value, 'spec 0 value').toBe(5)

          const gres = await collection.get(key)
          expect(gres.value, 'document').toBeTruthy()
          expect(gres.value.bar, 'bar').toBe(5)
          expect(gres.value.baz, 'baz').toBe('world')
          expect(gres.value.arr, 'arr').toEqual([1, 2, 3, 4, 5, 6])
        })
      })

      group('#clientDurability', [ServerFeature.BucketManagement], () => {
        test('should mutateIn successfully w/ client durability', async ({
          collection,
          collectionLease,
          env,
        }) => {
          const key = await seededKey(env, collection, 'subdoc-clidur', (k) =>
            collection.insert(k, { ...subdocVal })
          )
          const replicas = await numReplicasOf(env, collectionLease.bucketName)
          const res = await collection.mutateIn(
            key,
            [
              MutateInSpec.increment('bar', 3),
              MutateInSpec.upsert('baz', 'world'),
              MutateInSpec.arrayAppend('arr', 4),
              MutateInSpec.arrayAppend('arr', [5, 6], { multi: true }),
            ],
            { durabilityPersistTo: 1, durabilityReplicateTo: replicas }
          )
          expect(res, 'mutateIn result').toBeTypeOf('object')
          expect(res.cas, 'mutateIn cas').toBeTruthy()
          validateMutationToken(res.token, env.ctx({ op: 'mutateIn', key }))

          // Regression guard (JSCBC-1457), as above.
          expect(res.content[0], 'spec 0').toBeInstanceOf(MutateInResultEntry)
          expect(res.content[0].value, 'spec 0 value').toBe(5)

          const gres = await collection.get(key)
          expect(gres.value, 'document').toBeTruthy()
          expect(gres.value.bar, 'bar').toBe(5)
          expect(gres.value.baz, 'baz').toBe('world')
          expect(gres.value.arr, 'arr').toEqual([1, 2, 3, 4, 5, 6])
        })
      })
    })

    describe('#CAS', () => {
      // `Cas` is a native object wrapper, so `!=` compares references. Every
      // comparison here is on the string form.
      test('should allow default CAS', async ({ collection, env }) => {
        const key = scratchKey(env, collection)
        const upRes = await collection.upsert(key, {
          id: key,
          foo: 'bar',
          type: 'upsert',
        })
        expect(upRes, 'upsert result').toBeTypeOf('object')
        expect(upRes.cas, 'upsert cas').toBeTruthy()

        const repRes = await collection.replace(
          key,
          { id: key, foo: 'baz', type: 'replace' },
          { cas: upRes.cas }
        )
        expect(repRes, 'replace result').toBeTypeOf('object')
        expect(repRes.cas, 'replace cas').toBeTruthy()
        expect(upRes.cas.toString(), 'cas changed by replace').not.toEqual(
          repRes.cas.toString()
        )

        const mutRes = await collection.mutateIn(
          key,
          [MutateInSpec.replace('type', 'mutate-in')],
          { cas: repRes.cas }
        )
        expect(mutRes, 'mutateIn result').toBeTypeOf('object')
        expect(mutRes.cas, 'mutateIn cas').toBeTruthy()
        expect(repRes.cas.toString(), 'cas changed by mutateIn').not.toEqual(
          mutRes.cas.toString()
        )

        const remRes = await collection.remove(key, { cas: mutRes.cas })
        expect(remRes, 'remove result').toBeTypeOf('object')
        expect(remRes.cas, 'remove cas').toBeTruthy()
        expect(mutRes.cas.toString(), 'cas changed by remove').not.toEqual(
          remRes.cas.toString()
        )
      })

      test('should allow CAS as string', async ({ collection, env }) => {
        const key = scratchKey(env, collection)
        const upRes = await collection.upsert(key, {
          id: key,
          foo: 'bar',
          type: 'upsert',
        })
        expect(upRes, 'upsert result').toBeTypeOf('object')
        expect(upRes.cas, 'upsert cas').toBeTruthy()

        const repRes = await collection.replace(
          key,
          { id: key, foo: 'baz', type: 'replace' },
          { cas: upRes.cas.toString() }
        )
        expect(repRes, 'replace result').toBeTypeOf('object')
        expect(repRes.cas, 'replace cas').toBeTruthy()
        expect(upRes.cas.toString(), 'cas changed by replace').not.toEqual(
          repRes.cas.toString()
        )

        const mutRes = await collection.mutateIn(
          key,
          [MutateInSpec.replace('type', 'mutate-in')],
          { cas: repRes.cas.toString() }
        )
        expect(mutRes, 'mutateIn result').toBeTypeOf('object')
        expect(mutRes.cas, 'mutateIn cas').toBeTruthy()
        expect(repRes.cas.toString(), 'cas changed by mutateIn').not.toEqual(
          mutRes.cas.toString()
        )

        const remRes = await collection.remove(key, {
          cas: mutRes.cas.toString(),
        })
        expect(remRes, 'remove result').toBeTypeOf('object')
        expect(remRes.cas, 'remove cas').toBeTruthy()
        expect(mutRes.cas.toString(), 'cas changed by remove').not.toEqual(
          remRes.cas.toString()
        )
      })

      test('should allow CAS as Buffer', async ({ collection, env }) => {
        const key = scratchKey(env, collection)
        const upRes = await collection.upsert(key, {
          id: key,
          foo: 'bar',
          type: 'upsert',
        })
        expect(upRes, 'upsert result').toBeTypeOf('object')
        expect(upRes.cas, 'upsert cas').toBeTruthy()
        const casBuff = Buffer.allocUnsafe(8)
        casBuff.writeBigUInt64LE(BigInt(upRes.cas.toString()))

        const repRes = await collection.replace(
          key,
          { id: key, foo: 'baz', type: 'replace' },
          { cas: casBuff }
        )
        expect(repRes, 'replace result').toBeTypeOf('object')
        expect(repRes.cas, 'replace cas').toBeTruthy()
        expect(upRes.cas.toString(), 'cas changed by replace').not.toEqual(
          repRes.cas.toString()
        )
        casBuff.fill('Ȣ')
        casBuff.writeBigUInt64LE(BigInt(repRes.cas.toString()))

        const mutRes = await collection.mutateIn(
          key,
          [MutateInSpec.replace('type', 'mutate-in')],
          { cas: casBuff }
        )
        expect(mutRes, 'mutateIn result').toBeTypeOf('object')
        expect(mutRes.cas, 'mutateIn cas').toBeTruthy()
        expect(repRes.cas.toString(), 'cas changed by mutateIn').not.toEqual(
          mutRes.cas.toString()
        )
        casBuff.fill('Ȣ')
        casBuff.writeBigUInt64LE(BigInt(mutRes.cas.toString()))

        const remRes = await collection.remove(key, { cas: casBuff })
        expect(remRes, 'remove result').toBeTypeOf('object')
        expect(remRes.cas, 'remove cas').toBeTruthy()
        expect(mutRes.cas.toString(), 'cas changed by remove').not.toEqual(
          remRes.cas.toString()
        )
      })
    })
  }
)

// What a KV error context does and does not carry.
defineSuite(
  'kv round trip',
  { features: [ServerFeature.KeyValue] },
  ({ test }) => {
    test('upserts and gets a document', async ({ collection, env }) => {
      const key = env.key()
      const value = { hello: 'world', n: 42 }
      const ctx = env.ctx({ key, collection: collection.name })

      assertMutationResult(await collection.upsert(key, value), {
        ...ctx,
        op: 'upsert',
      })
      assertDocEquals(await collection.get(key), value, { ...ctx, op: 'get' })

      await collection.remove(key)
    })

    test('reports a typed error with context for a missing key', async ({
      collection,
      env,
    }) => {
      const key = env.key()
      const err = await expectCouchbaseError(
        () => collection.get(key),
        DocumentNotFoundError,
        env.ctx({ op: 'get', key, collection: collection.name })
      )
      // A context of any other class reads as missing, and fails the
      // expectations below on the field it lacks.
      const ctx =
        err.context instanceof KeyValueErrorContext ? err.context : undefined

      // Regression guard (JSCBC-1446): a KV error context carries the bucket,
      // scope, collection and key.
      expectErrorContext(
        err,
        {
          key,
          bucket: collection.scope.bucket.name,
          scope: collection.scope.name,
          collection: collection.name,
        },
        env.ctx({ op: 'get', key, collection: collection.name })
      )

      // The server-supplied fields.
      expect(ctx?.status_code).toBeTypeOf('number')
      expect(ctx?.last_dispatched_to).toMatch(/:\d+$/)
      expect(ctx?.retry_attempts).toBeTypeOf('number')
    })
  }
)
