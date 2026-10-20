import { describe, expect } from 'vitest'

import { Collection } from '../../../lib/collection'
import {
  RawBinaryTranscoder,
  RawJsonTranscoder,
  RawStringTranscoder,
} from '../../../lib/transcoders'
import { expectThrows } from '../../asserts/errors'
import {
  assertCasChanged,
  assertCasUnchanged,
  assertMutationResult,
} from '../../asserts/kv'
import { ServerFeature } from '../../infra/capabilities'
import { TestEnv } from '../../infra/env'
import { CollectionStrategy } from '../../infra/requirements'
import { defineSuite } from '../../infra/suite'

// Each block owns a disjoint key range, so a failed cleanup in one block
// cannot surface as a DocumentExistsError in the next block's insert test.
//
// Regression guard (JSCBC-1452): every transcoder runs against a named
// collection too. Two `defineSuite` calls rather than `CollectionStrategy.Both`
// so the default half keeps its `#default-collection` title.

interface RawCase {
  readonly contentType: string
  readonly content: unknown
}

/** One `#rawjson` round trip, keyed on `contentType` to its content type. */
interface RawJsonContent<C extends string, V> {
  readonly contentType: C
  readonly base: number
  readonly insertContent: V
  readonly upsertContent: V
  readonly replaceContent: V
}

type RawJsonCase =
  | RawJsonContent<'binary', Buffer>
  | RawJsonContent<'string', string>

const DOC_COUNT = 20

const BINARY_INSERT = Buffer.from('696e7365727420636f6e74656e74', 'hex')
const BINARY_UPSERT = Buffer.from('75707365727420636f6e74656e74', 'hex')
const BINARY_REPLACE = Buffer.from('7265706c61636520636f6e74656e74', 'hex')
const INVALID_BINARY = Buffer.from('696e76616c696420636f6e74656e74', 'hex')

const BINARY_INVALID: readonly RawCase[] = [
  { contentType: 'string', content: 'invalid content' },
  { contentType: 'object', content: { foo: 'bar' } },
  { contentType: 'array', content: ['invalid content'] },
  { contentType: 'number', content: 101 },
]

const STRING_INVALID: readonly RawCase[] = [
  { contentType: 'binary', content: INVALID_BINARY },
  { contentType: 'object', content: { foo: 'bar' } },
  { contentType: 'array', content: ['invalid content'] },
  { contentType: 'number', content: 101 },
]

const JSON_ENCODE_INVALID: readonly RawCase[] = [
  { contentType: 'object', content: { foo: 'bar' } },
  { contentType: 'array', content: ['invalid content'] },
  { contentType: 'number', content: 101 },
]

const JSON_DECODE_INVALID: readonly RawCase[] = [
  { contentType: 'string', content: 'invalid content' },
  { contentType: 'binary', content: INVALID_BINARY },
]

const OPS = ['insert', 'upsert', 'replace'] as const

const COLLECTION_AXES = [
  {
    name: 'default',
    strategy: CollectionStrategy.DefaultCollection,
    features: [],
  },
  {
    name: 'named',
    strategy: CollectionStrategy.Named,
    features: [ServerFeature.Collections],
  },
] as const

const sharedKeys = new Map<string, string[]>()

/**
 * A collection's key pool, allocated once per file. Purged by an env cleanup
 * rather than `afterAll`, so it runs on the failure path and reports its own
 * errors.
 */
function keyPool(env: TestEnv, collection: Collection): string[] {
  const id = `${collection.scope.name}.${collection.name}`
  let keys = sharedKeys.get(id)
  if (!keys) {
    const pool = Array.from({ length: DOC_COUNT }, () => env.key())
    keys = pool
    sharedKeys.set(id, pool)
    env.registerCleanup(async () => {
      await Promise.allSettled(pool.map((key) => collection.remove(key)))
    })
  }
  return keys
}

for (const axis of COLLECTION_AXES) {
  defineSuite(
    `#${axis.name}-collection`,
    {
      features: [ServerFeature.KeyValue, ...axis.features],
      collection: axis.strategy,
    },
    ({ test }) => {
      describe('#transcoders', () => {
        describe('#rawbinary', () => {
          const transcoder = new RawBinaryTranscoder()

          test('should insert using RawBinaryTranscoder', async ({
            collection,
            env,
          }) => {
            const key = keyPool(env, collection)[0]
            const res = await collection.insert(key, BINARY_INSERT, {
              transcoder,
            })
            assertMutationResult(res, env.ctx({ op: 'insert', key }))
          })

          test('should get inserted doc using RawBinaryTranscoder', async ({
            collection,
            env,
          }) => {
            const key = keyPool(env, collection)[0]
            const ctx = env.ctx({ op: 'get', key })
            const res = await collection.get(key, { transcoder })
            expect(res, `get returned no result. ${ctx.key}`).toBeTypeOf(
              'object'
            )
            expect(res.cas, 'get returned no cas').toBeTruthy()
            expect(res.content, 'inserted content').toStrictEqual(BINARY_INSERT)
          })

          test('should upsert using RawBinaryTranscoder', async ({
            collection,
            env,
          }) => {
            const key = keyPool(env, collection)[1]
            const res = await collection.upsert(key, BINARY_UPSERT, {
              transcoder,
            })
            assertMutationResult(res, env.ctx({ op: 'upsert', key }))
          })

          test('should get upserted doc using RawBinaryTranscoder', async ({
            collection,
            env,
          }) => {
            const key = keyPool(env, collection)[1]
            const res = await collection.get(key, { transcoder })
            expect(res, 'get returned no result').toBeTypeOf('object')
            expect(res.cas, 'get returned no cas').toBeTruthy()
            expect(res.content, 'upserted content').toStrictEqual(BINARY_UPSERT)
          })

          test('should replace using RawBinaryTranscoder', async ({
            collection,
            env,
          }) => {
            const key = keyPool(env, collection)[2]
            const ctx = env.ctx({ key })

            const insertRes = await collection.insert(key, BINARY_INSERT, {
              transcoder,
            })
            assertMutationResult(insertRes, { ...ctx, op: 'insert' })

            const replaceRes = await collection.replace(key, BINARY_REPLACE, {
              transcoder,
            })
            assertMutationResult(replaceRes, { ...ctx, op: 'replace' })
            assertCasChanged(insertRes.cas, replaceRes.cas, {
              ...ctx,
              op: 'replace',
            })

            const getRes = await collection.get(key, { transcoder })
            expect(getRes, 'get returned no result').toBeTypeOf('object')
            expect(getRes.cas, 'get returned no cas').toBeTruthy()
            // Regression guard (JSCBC-1453): a get does not change the CAS, so
            // the one read back is the replace's, compared by value.
            assertCasUnchanged(replaceRes.cas, getRes.cas, {
              ...ctx,
              op: 'get',
            })
            expect(getRes.content, 'replaced content').toStrictEqual(
              BINARY_REPLACE
            )
          })

          describe('#invalid-content', () => {
            describe('#encode', () => {
              for (const { contentType, content } of BINARY_INVALID) {
                for (const op of OPS) {
                  test(`should fail to ${op} invalid content (${contentType}) with RawBinaryTranscoder`, async ({
                    collection,
                    env,
                  }) => {
                    const key = env.key()
                    await expectThrows(
                      () => collection[op](key, content, { transcoder }),
                      Error,
                      'Only binary data supported by RawBinaryTranscoder.',
                      env.ctx({ op, key, extra: contentType })
                    )
                  })
                }
              }
            })

            describe('#decode', () => {
              for (const { contentType, content } of BINARY_INVALID) {
                test(`should fail to get invalid content (${contentType}) with RawBinaryTranscoder`, async ({
                  collection,
                  env,
                }) => {
                  // Seeded here because fixtures are not available to
                  // `beforeAll`. The default transcoder is what makes the
                  // stored flags wrong for `transcoder` below.
                  const key = env.key()
                  await collection.upsert(key, content)
                  env.registerCleanup(async () => {
                    await collection.remove(key).catch(() => undefined)
                  })

                  await expectThrows(
                    () => collection.get(key, { transcoder }),
                    Error,
                    /.*format not supported by RawBinaryTranscoder/,
                    env.ctx({ op: 'get', key, extra: contentType })
                  )
                })
              }
            })
          })
        })

        describe('#rawstring', () => {
          const transcoder = new RawStringTranscoder()

          test('should insert using RawStringTranscoder', async ({
            collection,
            env,
          }) => {
            const key = keyPool(env, collection)[3]
            const res = await collection.insert(key, 'insert content', {
              transcoder,
            })
            assertMutationResult(res, env.ctx({ op: 'insert', key }))
          })

          test('should get inserted doc using RawStringTranscoder', async ({
            collection,
            env,
          }) => {
            const key = keyPool(env, collection)[3]
            const res = await collection.get(key, { transcoder })
            expect(res, 'get returned no result').toBeTypeOf('object')
            expect(res.cas, 'get returned no cas').toBeTruthy()
            expect(res.content, 'inserted content').toStrictEqual(
              'insert content'
            )
          })

          test('should upsert using RawStringTranscoder', async ({
            collection,
            env,
          }) => {
            const key = keyPool(env, collection)[4]
            const res = await collection.upsert(key, 'upsert content', {
              transcoder,
            })
            assertMutationResult(res, env.ctx({ op: 'upsert', key }))
          })

          test('should get upserted doc using RawStringTranscoder', async ({
            collection,
            env,
          }) => {
            const key = keyPool(env, collection)[4]
            const res = await collection.get(key, { transcoder })
            expect(res, 'get returned no result').toBeTypeOf('object')
            expect(res.cas, 'get returned no cas').toBeTruthy()
            expect(res.content, 'upserted content').toStrictEqual(
              'upsert content'
            )
          })

          test('should replace using RawStringTranscoder', async ({
            collection,
            env,
          }) => {
            const key = keyPool(env, collection)[5]
            const ctx = env.ctx({ key })

            const insertRes = await collection.insert(key, 'insert content', {
              transcoder,
            })
            assertMutationResult(insertRes, { ...ctx, op: 'insert' })

            const replaceRes = await collection.replace(
              key,
              'replace content',
              {
                transcoder,
              }
            )
            assertMutationResult(replaceRes, { ...ctx, op: 'replace' })
            assertCasChanged(insertRes.cas, replaceRes.cas, {
              ...ctx,
              op: 'replace',
            })

            const getRes = await collection.get(key, { transcoder })
            expect(getRes, 'get returned no result').toBeTypeOf('object')
            expect(getRes.cas, 'get returned no cas').toBeTruthy()
            assertCasUnchanged(replaceRes.cas, getRes.cas, {
              ...ctx,
              op: 'get',
            })
            expect(getRes.content, 'replaced content').toStrictEqual(
              'replace content'
            )
          })

          describe('#invalid-content', () => {
            describe('#encode', () => {
              for (const { contentType, content } of STRING_INVALID) {
                for (const op of OPS) {
                  test(`should fail to ${op} invalid content (${contentType}) with RawStringTranscoder`, async ({
                    collection,
                    env,
                  }) => {
                    const key = env.key()
                    await expectThrows(
                      () => collection[op](key, content, { transcoder }),
                      Error,
                      'Only string data supported by RawStringTranscoder.',
                      env.ctx({ op, key, extra: contentType })
                    )
                  })
                }
              }
            })

            describe('#decode', () => {
              for (const { contentType, content } of STRING_INVALID) {
                test(`should fail to get invalid content (${contentType}) with RawStringTranscoder`, async ({
                  collection,
                  env,
                }) => {
                  const key = env.key()
                  await collection.upsert(key, content)
                  env.registerCleanup(async () => {
                    await collection.remove(key).catch(() => undefined)
                  })

                  await expectThrows(
                    () => collection.get(key, { transcoder }),
                    Error,
                    /.*format not supported by RawStringTranscoder/,
                    env.ctx({ op: 'get', key, extra: contentType })
                  )
                })
              }
            })
          })
        })

        describe('#rawjson', () => {
          const transcoder = new RawJsonTranscoder()
          // RawJsonTranscoder always decodes to a Buffer, so a string round
          // trip comes back as bytes and is compared through `toString('utf8')`.
          const cases: readonly RawJsonCase[] = [
            {
              contentType: 'binary',
              base: 6,
              insertContent: BINARY_INSERT,
              upsertContent: BINARY_UPSERT,
              replaceContent: BINARY_REPLACE,
            },
            {
              contentType: 'string',
              base: 9,
              insertContent: 'insert content',
              upsertContent: 'upsert content',
              replaceContent: 'replace content',
            },
          ]

          for (const c of cases) {
            test(`should insert ${c.contentType} using RawJsonTranscoder`, async ({
              collection,
              env,
            }) => {
              const key = keyPool(env, collection)[c.base]
              const res = await collection.insert(key, c.insertContent, {
                transcoder,
              })
              assertMutationResult(res, env.ctx({ op: 'insert', key }))
            })

            test(`should get inserted ${c.contentType} doc using RawJsonTranscoder`, async ({
              collection,
              env,
            }) => {
              const key = keyPool(env, collection)[c.base]
              const res = await collection.get(key, { transcoder })
              expect(res, 'get returned no result').toBeTypeOf('object')
              expect(res.cas, 'get returned no cas').toBeTruthy()
              if (c.contentType === 'string') {
                expect(
                  (res.content as Buffer).toString('utf8'),
                  'inserted content'
                ).toStrictEqual(c.insertContent)
              } else {
                expect(res.content, 'inserted content').toStrictEqual(
                  c.insertContent
                )
              }
            })

            test(`should upsert ${c.contentType} using RawJsonTranscoder`, async ({
              collection,
              env,
            }) => {
              const key = keyPool(env, collection)[c.base + 1]
              const res = await collection.upsert(key, c.upsertContent, {
                transcoder,
              })
              assertMutationResult(res, env.ctx({ op: 'upsert', key }))
            })

            test(`should get upserted ${c.contentType} doc using RawJsonTranscoder`, async ({
              collection,
              env,
            }) => {
              const key = keyPool(env, collection)[c.base + 1]
              const res = await collection.get(key, { transcoder })
              expect(res, 'get returned no result').toBeTypeOf('object')
              expect(res.cas, 'get returned no cas').toBeTruthy()
              if (c.contentType === 'string') {
                expect(
                  (res.content as Buffer).toString('utf8'),
                  'upserted content'
                ).toStrictEqual(c.upsertContent)
              } else {
                expect(res.content, 'upserted content').toStrictEqual(
                  c.upsertContent
                )
              }
            })

            test(`should replace ${c.contentType} using RawJsonTranscoder`, async ({
              collection,
              env,
            }) => {
              const key = keyPool(env, collection)[c.base + 2]
              const ctx = env.ctx({ key })

              const insertRes = await collection.insert(key, c.insertContent, {
                transcoder,
              })
              assertMutationResult(insertRes, { ...ctx, op: 'insert' })

              const replaceRes = await collection.replace(
                key,
                c.replaceContent,
                {
                  transcoder,
                }
              )
              assertMutationResult(replaceRes, { ...ctx, op: 'replace' })
              assertCasChanged(insertRes.cas, replaceRes.cas, {
                ...ctx,
                op: 'replace',
              })

              const getRes = await collection.get(key, { transcoder })
              expect(getRes, 'get returned no result').toBeTypeOf('object')
              expect(getRes.cas, 'get returned no cas').toBeTruthy()
              assertCasUnchanged(replaceRes.cas, getRes.cas, {
                ...ctx,
                op: 'get',
              })
              if (c.contentType === 'string') {
                expect(
                  (getRes.content as Buffer).toString('utf8'),
                  'replaced content'
                ).toStrictEqual(c.replaceContent)
              } else {
                expect(getRes.content, 'replaced content').toStrictEqual(
                  c.replaceContent
                )
              }
            })
          }

          test('RawJsonTranscoder should allow JSON bytes to passthrough', async ({
            collection,
            env,
          }) => {
            const key = keyPool(env, collection)[12]
            const value = { foo: 'bar', baz: 'quz' }
            const jsonBytes = Buffer.from(JSON.stringify(value))

            const upsertRes = await collection.upsert(key, jsonBytes, {
              transcoder,
            })
            assertMutationResult(upsertRes, env.ctx({ op: 'upsert', key }))

            const getRes = await collection.get(key, { transcoder })
            expect(getRes, 'get returned no result').toBeTypeOf('object')
            expect(getRes.cas, 'get returned no cas').toBeTruthy()
            expect(
              getRes.content,
              'bytes did not decode to the object'
            ).not.toEqual(value)
            expect(getRes.content, 'raw bytes').toStrictEqual(jsonBytes)
            expect(
              JSON.parse((getRes.content as Buffer).toString('utf8')),
              'bytes parse back to the object'
            ).toStrictEqual(value)
          })

          describe('#invalid-content', () => {
            describe('#encode', () => {
              for (const { contentType, content } of JSON_ENCODE_INVALID) {
                for (const op of OPS) {
                  test(`should fail to ${op} invalid content (${contentType}) with RawJsonTranscoder`, async ({
                    collection,
                    env,
                  }) => {
                    const key = env.key()
                    await expectThrows(
                      () => collection[op](key, content, { transcoder }),
                      Error,
                      'Only binary and string data supported by RawJsonTranscoder.',
                      env.ctx({ op, key, extra: contentType })
                    )
                  })
                }
              }
            })

            describe('#decode', () => {
              for (const { contentType, content } of JSON_DECODE_INVALID) {
                test(`should fail to get invalid content (${contentType}) with RawJsonTranscoder`, async ({
                  collection,
                  env,
                }) => {
                  const key = env.key()
                  await collection.upsert(key, content)
                  env.registerCleanup(async () => {
                    await collection.remove(key).catch(() => undefined)
                  })

                  await expectThrows(
                    () => collection.get(key, { transcoder }),
                    Error,
                    /.*format not supported by RawJsonTranscoder/,
                    env.ctx({ op: 'get', key, extra: contentType })
                  )
                })
              }
            })
          })
        })
      })
    }
  )
}
