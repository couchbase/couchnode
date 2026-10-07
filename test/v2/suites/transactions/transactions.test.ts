import { describe, expect } from 'vitest'

import type { Collection } from '../../../../lib/collection'
import {
  BucketNotFoundError,
  DocumentExistsError,
  DocumentNotFoundError,
  DocumentUnretrievableError,
  FeatureNotAvailableError,
  ParsingFailureError,
  TransactionExpiredError,
  TransactionFailedError,
  TransactionOperationFailedError,
} from '../../../../lib/errors'
import {
  KeyValueErrorContext,
  QueryErrorContext,
} from '../../../../lib/errorcontexts'
import { RawBinaryTranscoder } from '../../../../lib/transcoders'
import {
  TransactionGetMultiMode,
  TransactionGetMultiReplicasFromPreferredServerGroupMode,
  TransactionGetMultiReplicasFromPreferredServerGroupResult,
  TransactionGetMultiReplicasFromPreferredServerGroupSpec,
  TransactionGetMultiResult,
  TransactionGetMultiSpec,
} from '../../../../lib/transactions'
import { AssertCtx, withCtx } from '../../asserts/ctx'
import {
  expectCouchbaseError,
  expectErrorContext,
  expectThrows,
} from '../../asserts/errors'
import { ServerFeature } from '../../infra/capabilities'
import { TestEnv } from '../../infra/env'
import { CollectionLease } from '../../infra/leases/collection-lease'
import { CollectionStrategy } from '../../infra/requirements'
import { defineSuite } from '../../infra/suite'

// `CollectionStrategy.Named` gives the file its own new, empty scope and
// collection, dropped by the lease. Nothing indexes it, so the queries name
// their documents with `USE KEYS`: before 7.6 a `WHERE META().id` filter on a
// keyspace with no index is refused.
//
// `Transactions.run` rethrows anything the lambda throws as
// `TransactionFailedError`, so an `AssertionError` inside a lambda arrives as
// its `cause` and passes an assertion on the outer class alone. Hence
// `expectSentinelFailure` checks the cause, and assertions that need not run
// inside a lambda are hoisted out.
//
// The two `getMulti` blocks are not factored: two parallel APIs with distinct
// spec, result and mode types would need a cast at every call.

/**
 * Round-trips `undefined`, which the default transcoder cannot encode: the
 * string `'undefined'` decodes as absent.
 */
class AllowUndefinedTranscoder {
  encode(value: unknown): [Buffer, number] {
    if (typeof value === 'undefined') {
      return [Buffer.from('undefined'), (0x04 << 24) | 0x04]
    }
    if (typeof value === 'string') {
      return [Buffer.from(value), (0x04 << 24) | 0x04]
    }

    throw new Error('Only string data supported.')
  }

  decode(bytes: Buffer): unknown {
    // Ignores flags.
    const result = bytes.toString('utf8')
    if (result === 'undefined') {
      return undefined
    }
    return result
  }
}

const testBinVal = Buffer.from(
  '00092bc691fb824300a6871ceddf7090d7092bc691fb824300a6871ceddf7090d7',
  'hex'
)
const newBinVal = Buffer.from('666f6f62617262617a', 'hex')

const BINARY_UNSUPPORTED =
  'Possibly attempting a binary transaction operation with a server version < 7.6.2'

/** Generated scope and collection names need no quoting. */
function keyspaceOf(lease: CollectionLease): string {
  return `${lease.bucketName}.${lease.scopeName}.${lease.collectionName}`
}

/** Many keys here are never written, or are rolled back. */
async function removeIfPresent(
  collection: Collection,
  key: string
): Promise<void> {
  try {
    await collection.remove(key)
  } catch (err) {
    if (!(err instanceof DocumentNotFoundError)) {
      throw err
    }
  }
}

function scratchKey(env: TestEnv, collection: Collection): string {
  const key = env.key()
  env.registerCleanup(() => removeIfPresent(collection, key))
  return key
}

/**
 * Asserts a transaction failed carrying the sentinel its lambda threw. The
 * cause's message is what tells it apart from a failed assertion.
 */
async function expectSentinelFailure(
  fn: () => Promise<unknown>,
  sentinel: string,
  c: AssertCtx = {}
): Promise<TransactionFailedError> {
  const err = await expectCouchbaseError(fn, TransactionFailedError, c)
  expect(
    err.cause?.message,
    withCtx(
      `transaction should have failed with '${sentinel}' and not with an ` +
        `assertion from inside the lambda`,
      c
    )
  ).toBe(sentinel)
  return err
}

interface TestDoc {
  readonly id: string
  readonly testDoc: { readonly id: string }
}

const multiDocs = new Map<string, Promise<readonly TestDoc[]>>()

/** Memoizes the promise, so two tests starting together seed once. */
function multiDocsFor(
  env: TestEnv,
  collection: Collection,
  block: string
): Promise<readonly TestDoc[]> {
  const id = `${collection.name}:${block}`
  const existing = multiDocs.get(id)
  if (existing) {
    return existing
  }
  const pending = (async () => {
    const testUid = env.key()
    const docs = await Promise.all(
      Array.from({ length: 5 }, async (_unused, i) => {
        const testDocKey = `${testUid}::${i}`
        const testDoc = { id: testDocKey }
        await collection.upsert(testDocKey, testDoc)
        return { id: testDocKey, testDoc }
      })
    )
    env.registerCleanup(async () => {
      await Promise.all(docs.map((doc) => removeIfPresent(collection, doc.id)))
    })
    return docs
  })().catch((err) => {
    // Not cached on failure, or the next test inherits the rejection.
    multiDocs.delete(id)
    throw err
  })
  multiDocs.set(id, pending)
  return pending
}

defineSuite(
  '#transactions',
  {
    features: [ServerFeature.Transactions],
    collection: CollectionStrategy.Named,
  },
  ({ test, group, lacking, having, limited }) => {
    // Functions rather than booleans because calling `limited` records the
    // skip.
    const queryTxn = () => limited('gocaves-query-transactions')
    const binaryTxn = () => limited('gocaves-binary-transaction-errors')

    test('should work with a simple transaction', async ({
      cluster,
      collection,
      env,
    }) => {
      const testDocIns = scratchKey(env, collection)
      const testDocRep = scratchKey(env, collection)
      const testDocRem = scratchKey(env, collection)

      await collection.insert(testDocRep, { foo: 'bar' })
      await collection.insert(testDocRem, { foo: 'bar' })

      await cluster.transactions().run(
        async (attempt) => {
          await attempt.insert(collection, testDocIns, { foo: 'baz' })

          const repDoc = await attempt.get(collection, testDocRep)
          await attempt.replace(repDoc, { foo: 'baz' })

          const remDoc = await attempt.get(collection, testDocRem)
          await attempt.remove(remDoc)

          const insRes = await attempt.get(collection, testDocIns)
          expect(
            insRes.content,
            withCtx('staged insert read back inside the transaction', {
              key: testDocIns,
            })
          ).toStrictEqual({ foo: 'baz' })

          const repRes = await attempt.get(collection, testDocRep)
          expect(
            repRes.content,
            withCtx('staged replace read back inside the transaction', {
              key: testDocRep,
            })
          ).toStrictEqual({ foo: 'baz' })

          await expectThrows(
            () => attempt.get(collection, testDocRem),
            Error,
            undefined,
            env.ctx({ op: 'transaction get', key: testDocRem })
          )
        },
        { timeout: 5000 }
      )

      const insRes = await collection.get(testDocIns)
      expect(
        insRes.content,
        withCtx('inserted document after commit', { key: testDocIns })
      ).toStrictEqual({ foo: 'baz' })

      const repRes = await collection.get(testDocRep)
      expect(
        repRes.content,
        withCtx('replaced document after commit', { key: testDocRep })
      ).toStrictEqual({ foo: 'baz' })

      await expectThrows(
        () => collection.get(testDocRem),
        Error,
        undefined,
        env.ctx({ op: 'get', key: testDocRem })
      )
    })

    test.skipIf(queryTxn())(
      'should work with query',
      async ({ cluster, collection, collectionLease, env }) => {
        const testKey = env.key()
        const testDoc1 = `${testKey}_1`
        const testDoc2 = `${testKey}_2`
        env.registerCleanup(async () => {
          await removeIfPresent(collection, testDoc1)
          await removeIfPresent(collection, testDoc2)
        })

        await collection.insert(testDoc1, { foo: 'bar' })

        await cluster.transactions().run(async (attempt) => {
          const insDoc = await attempt.insert(collection, testDoc2, {
            foo: 'baz',
          })

          const collQualifer = keyspaceOf(collectionLease)
          const queryRes = await attempt.query<{ foo: string }>(
            `SELECT foo FROM ${collQualifer} USE KEYS $1 ORDER BY META().id ASC`,
            {
              parameters: [[testDoc1, testDoc2]],
            }
          )
          expect(queryRes.rows, 'transaction query rows').toHaveLength(2)
          expect(queryRes.rows[0], 'row 0').toStrictEqual({ foo: 'bar' })
          expect(queryRes.rows[1], 'row 1').toStrictEqual({ foo: 'baz' })

          const getDoc = await attempt.get(collection, testDoc1)
          await attempt.replace(getDoc, { foo: 'bad' })

          await attempt.replace(insDoc, { foo: 'bag' })
        })

        const gres1 = await collection.get(testDoc1)
        expect(
          gres1.content,
          withCtx('replaced document after commit', { key: testDoc1 })
        ).toStrictEqual({ foo: 'bad' })

        const gres2 = await collection.get(testDoc2)
        expect(
          gres2.content,
          withCtx('inserted document after commit', { key: testDoc2 })
        ).toStrictEqual({ foo: 'bag' })
      }
    )

    test.skipIf(queryTxn())(
      'should insert in Query mode',
      async ({ cluster, collection, collectionLease, env }) => {
        const testKey = env.key()
        const testDoc1 = `${testKey}_1`
        const testDoc2 = `${testKey}_2`
        env.registerCleanup(async () => {
          await removeIfPresent(collection, testDoc1)
          await removeIfPresent(collection, testDoc2)
        })

        await collection.insert(testDoc1, { foo: 'bar', queryMode: false })

        await cluster.transactions().run(async (attempt) => {
          const collQualifer = keyspaceOf(collectionLease)
          const queryRes = await attempt.query<{
            foo: string
            queryMode: boolean
          }>(
            `SELECT foo, queryMode FROM ${collQualifer} USE KEYS $1 ORDER BY META().id ASC`,
            {
              parameters: [[testDoc1]],
            }
          )
          expect(queryRes.rows, 'transaction query rows').toHaveLength(1)
          expect(queryRes.rows[0], 'row 0').toStrictEqual({
            foo: 'bar',
            queryMode: false,
          })

          await attempt.insert(collection, testDoc2, {
            foo: 'baz',
            queryMode: true,
          })
        })

        const gres = await collection.get(testDoc2)
        expect(
          gres.content,
          withCtx('inserted document after commit', { key: testDoc2 })
        ).toStrictEqual({ foo: 'baz', queryMode: true })
      }
    )

    test.skipIf(queryTxn())(
      'should remove in Query mode',
      async ({ cluster, collection, collectionLease, env }) => {
        const testKey = env.key()
        const testDoc1 = `${testKey}_1`
        const testDoc2 = `${testKey}_2`
        env.registerCleanup(async () => {
          await removeIfPresent(collection, testDoc1)
          await removeIfPresent(collection, testDoc2)
        })

        await collection.insert(testDoc1, { foo: 'bar', queryMode: false })

        await cluster.transactions().run(async (attempt) => {
          await attempt.insert(collection, testDoc2, {
            foo: 'baz',
            queryMode: true,
          })

          const collQualifer = keyspaceOf(collectionLease)
          const queryRes = await attempt.query<{
            foo: string
            queryMode: boolean
          }>(
            `SELECT foo, queryMode FROM ${collQualifer} USE KEYS $1 ORDER BY META().id ASC`,
            {
              parameters: [[testDoc1, testDoc2]],
            }
          )
          expect(queryRes.rows, 'transaction query rows').toHaveLength(2)
          expect(queryRes.rows[0], 'row 0').toStrictEqual({
            foo: 'bar',
            queryMode: false,
          })
          // Read-your-own-write of the insert above: the point of the test.
          expect(queryRes.rows[1], 'row 1').toStrictEqual({
            foo: 'baz',
            queryMode: true,
          })

          const remDoc = await attempt.get(collection, testDoc1)
          await attempt.remove(remDoc)
        })

        await expectCouchbaseError(
          () => collection.get(testDoc1),
          DocumentNotFoundError,
          env.ctx({ op: 'get', key: testDoc1 })
        )
      }
    )

    test('should fail with application errors', async ({
      cluster,
      collection,
      env,
    }) => {
      const testDocIns = scratchKey(env, collection)
      const testDocRep = scratchKey(env, collection)
      const testDocRem = scratchKey(env, collection)

      await collection.insert(testDocRep, { foo: 'bar' })
      await collection.insert(testDocRem, { foo: 'bar' })

      let numAttempts = 0
      await expectSentinelFailure(
        () =>
          cluster.transactions().run(async (attempt) => {
            numAttempts++

            await attempt.insert(collection, testDocIns, { foo: 'baz' })

            const repDoc = await attempt.get(collection, testDocRep)
            await attempt.replace(repDoc, { foo: 'baz' })

            const remDoc = await attempt.get(collection, testDocRem)
            await attempt.remove(remDoc)

            throw new Error('application failure')
          }),
        'application failure',
        env.ctx({ op: 'transaction run' })
      )

      expect(numAttempts, 'attempts').toBe(1)

      await expectThrows(
        () => collection.get(testDocIns),
        Error,
        undefined,
        env.ctx({ op: 'get', key: testDocIns })
      )

      const repRes = await collection.get(testDocRep)
      expect(
        repRes.content,
        withCtx('replace rolled back', { key: testDocRep })
      ).toStrictEqual({ foo: 'bar' })

      // The staged remove this test exists to roll back.
      const remRes = await collection.get(testDocRem)
      expect(
        remRes.content,
        withCtx('remove rolled back', { key: testDocRem })
      ).toStrictEqual({ foo: 'bar' })
    })

    test.skipIf(queryTxn())(
      'should commit with query',
      async ({ cluster, collection, collectionLease, env }) => {
        const testDocIns = scratchKey(env, collection)
        const testDocRep = scratchKey(env, collection)
        const testDocRem = scratchKey(env, collection)

        await collection.insert(testDocRep, { foo: 'bar' })
        await collection.insert(testDocRem, { foo: 'bar' })

        await cluster.transactions().run(async (attempt) => {
          const coPath = keyspaceOf(collectionLease)

          await attempt.query(`INSERT INTO ${coPath} VALUES ($1, $2)`, {
            parameters: [testDocIns, { foo: 'baz' }],
          })

          await attempt.query(`UPDATE ${coPath} USE KEYS $1 SET foo="baz"`, {
            parameters: [testDocRep],
          })

          await attempt.query(`DELETE FROM ${coPath} USE KEYS $1`, {
            parameters: [testDocRem],
          })
        })

        const insRes = await collection.get(testDocIns)
        expect(
          insRes.content,
          withCtx('inserted document after commit', { key: testDocIns })
        ).toStrictEqual({ foo: 'baz' })

        const repRes = await collection.get(testDocRep)
        expect(
          repRes.content,
          withCtx('updated document after commit', { key: testDocRep })
        ).toStrictEqual({ foo: 'baz' })

        await expectThrows(
          () => collection.get(testDocRem),
          Error,
          undefined,
          env.ctx({ op: 'get', key: testDocRem })
        )
      }
    )

    test.skipIf(queryTxn())(
      'should rollback after query',
      async ({ cluster, collection, collectionLease, env }) => {
        const testDocIns = scratchKey(env, collection)
        const testDocRep = scratchKey(env, collection)
        const testDocRem = scratchKey(env, collection)

        await collection.insert(testDocRep, { foo: 'bar' })
        await collection.insert(testDocRem, { foo: 'bar' })

        let numAttempts = 0
        await expectSentinelFailure(
          () =>
            cluster.transactions().run(async (attempt) => {
              numAttempts++

              const coPath = keyspaceOf(collectionLease)

              await attempt.query(`INSERT INTO ${coPath} VALUES ($1, $2)`, {
                parameters: [testDocIns, { foo: 'baz' }],
              })

              await attempt.query(
                `UPDATE ${coPath} USE KEYS $1 SET foo="baz"`,
                {
                  parameters: [testDocRep],
                }
              )

              await attempt.query(`DELETE FROM ${coPath} USE KEYS $1`, {
                parameters: [testDocRem],
              })

              throw new Error('application failure')
            }),
          'application failure',
          env.ctx({ op: 'transaction run' })
        )

        expect(numAttempts, 'attempts').toBe(1)

        await expectThrows(
          () => collection.get(testDocIns),
          Error,
          undefined,
          env.ctx({ op: 'get', key: testDocIns })
        )

        const repRes = await collection.get(testDocRep)
        expect(
          repRes.content,
          withCtx('update rolled back', { key: testDocRep })
        ).toStrictEqual({ foo: 'bar' })

        // The staged remove, as above.
        const remRes = await collection.get(testDocRem)
        expect(
          remRes.content,
          withCtx('delete rolled back', { key: testDocRem })
        ).toStrictEqual({ foo: 'bar' })
      }
    )

    // `retry: 2`: the attempt count within the 2s timeout depends on how fast
    // the cluster answers.
    test(
      'should fail to replace with bad CAS',
      { retry: 2 },
      async ({ cluster, collection, env }) => {
        const testDocId = scratchKey(env, collection)

        await collection.upsert(testDocId, { foo: 'bar' })

        let numAttempts = 0
        const err = await expectCouchbaseError(
          () =>
            cluster.transactions().run(
              async (attempt) => {
                numAttempts++
                const repDoc = await attempt.get(collection, testDocId)
                await attempt.replace(repDoc, { foo: 'baz' })
                // The stale `repDoc` CAS makes this a mismatch.
                const opErr = await expectCouchbaseError(
                  () => attempt.replace(repDoc, { foo: 'qux' }),
                  TransactionOperationFailedError,
                  env.ctx({ op: 'transaction replace', key: testDocId })
                )
                expect(
                  opErr.cause?.message.includes('transaction expired') ||
                    opErr.cause?.message.includes('cas_mismatch'),
                  withCtx(
                    `staged replace cause should name the mismatch, got ` +
                      `'${opErr.cause?.message}'`,
                    { key: testDocId }
                  )
                ).toBe(true)
              },
              { timeout: 2000 }
            ),
          TransactionExpiredError,
          env.ctx({ op: 'transaction run', key: testDocId })
        )
        expect(
          err.cause?.message,
          withCtx('transaction expiry cause', { key: testDocId })
        ).toContain('transaction expired')
        expect(numAttempts, 'attempts').toBeGreaterThan(1)

        const repRes = await collection.get(testDocId)
        expect(
          repRes.content,
          withCtx('document after the failed transaction', { key: testDocId })
        ).toStrictEqual({ foo: 'bar' })
      }
    )

    test(
      'should fail to remove with bad CAS',
      { retry: 2 },
      async ({ cluster, collection, env }) => {
        const testDocId = scratchKey(env, collection)

        await collection.upsert(testDocId, { foo: 'bar' })

        let numAttempts = 0
        const err = await expectCouchbaseError(
          () =>
            cluster.transactions().run(
              async (attempt) => {
                numAttempts++
                const remDoc = await attempt.get(collection, testDocId)
                await attempt.replace(remDoc, { foo: 'baz' })
                // The stale CAS makes this a mismatch.
                const opErr = await expectCouchbaseError(
                  () => attempt.remove(remDoc),
                  TransactionOperationFailedError,
                  env.ctx({ op: 'transaction remove', key: testDocId })
                )
                expect(
                  opErr.cause?.message.includes('transaction expired') ||
                    opErr.cause?.message.includes('cas_mismatch'),
                  withCtx(
                    `staged remove cause should name the mismatch, got ` +
                      `'${opErr.cause?.message}'`,
                    { key: testDocId }
                  )
                ).toBe(true)
              },
              { timeout: 2000 }
            ),
          TransactionExpiredError,
          env.ctx({ op: 'transaction run', key: testDocId })
        )
        expect(
          err.cause?.message,
          withCtx('transaction expiry cause', { key: testDocId })
        ).toContain('transaction expired')
        expect(numAttempts, 'attempts').toBeGreaterThan(1)

        const remRes = await collection.get(testDocId)
        expect(
          remRes.content,
          withCtx('document after the failed transaction', { key: testDocId })
        ).toStrictEqual({ foo: 'bar' })
      }
    )

    test('should raise DocumentNotFoundError only in lambda', async ({
      cluster,
      collection,
      env,
    }) => {
      let numAttempts = 0
      await expectSentinelFailure(
        () =>
          cluster.transactions().run(
            async (attempt) => {
              numAttempts++
              const err = await expectCouchbaseError(
                () => attempt.get(collection, 'not-a-key'),
                DocumentNotFoundError,
                env.ctx({ op: 'transaction get', key: 'not-a-key' })
              )
              // `err.cause` is an `Error`, not a string. Comparing it to one
              // always fails, and `run` delivers that as the expected error.
              expect(
                err.cause?.message,
                withCtx('cause of the in-lambda error', { key: 'not-a-key' })
              ).toContain('document_not_found')

              throw new Error('success')
            },
            { timeout: 2000 }
          ),
        'success',
        env.ctx({ op: 'transaction run' })
      )
      expect(numAttempts, 'attempts').toBe(1)

      numAttempts = 0
      const err = await expectCouchbaseError(
        () =>
          cluster.transactions().run(
            async (attempt) => {
              numAttempts++
              await attempt.get(collection, 'not-a-key')
            },
            { timeout: 2000 }
          ),
        TransactionFailedError,
        env.ctx({ op: 'transaction run', key: 'not-a-key' })
      )
      expect(err.cause, 'transaction cause').toBeInstanceOf(
        DocumentNotFoundError
      )
      expect(err.cause?.message, 'transaction cause message').toContain(
        'document not found'
      )
      // Regression guard (JSCBC-1480): a KV error inside a transaction carries
      // its context. Only document fields: the core supplies no server fields.
      expect(err.context, 'transaction error context').toBeInstanceOf(
        KeyValueErrorContext
      )
      expectErrorContext(
        err,
        {
          key: 'not-a-key',
          bucket: collection.scope.bucket.name,
          scope: collection.scope.name,
          collection: collection.name,
        },
        env.ctx({ op: 'transaction run', key: 'not-a-key' })
      )
      expect(numAttempts, 'attempts').toBe(1)
    })

    test('should raise DocumentExistsError only in lambda', async ({
      cluster,
      collection,
      env,
    }) => {
      const testDocIns = scratchKey(env, collection)

      await collection.insert(testDocIns, { foo: 'bar' })

      let numAttempts = 0
      await expectSentinelFailure(
        () =>
          cluster.transactions().run(
            async (attempt) => {
              numAttempts++

              await expectCouchbaseError(
                () => attempt.insert(collection, testDocIns, { foo: 'baz' }),
                DocumentExistsError,
                env.ctx({ op: 'transaction insert', key: testDocIns })
              )

              throw new Error('success')
            },
            { timeout: 2000 }
          ),
        'success',
        env.ctx({ op: 'transaction run' })
      )
      expect(numAttempts, 'attempts').toBe(1)

      numAttempts = 0
      const err = await expectCouchbaseError(
        () =>
          cluster.transactions().run(
            async (attempt) => {
              numAttempts++
              await attempt.insert(collection, testDocIns, { foo: 'baz' })
            },
            { timeout: 2000 }
          ),
        TransactionFailedError,
        env.ctx({ op: 'transaction run', key: testDocIns })
      )
      expect(err.cause, 'transaction cause').toBeInstanceOf(DocumentExistsError)
      expect(err.cause?.message, 'transaction cause message').toContain(
        'document exists'
      )
      // Regression guard (JSCBC-1480): as above.
      expect(err.context, 'transaction error context').toBeInstanceOf(
        KeyValueErrorContext
      )
      expectErrorContext(
        err,
        {
          key: testDocIns,
          bucket: collection.scope.bucket.name,
          scope: collection.scope.name,
          collection: collection.name,
        },
        env.ctx({ op: 'transaction run', key: testDocIns })
      )
      expect(numAttempts, 'attempts').toBe(1)
    })

    test.skipIf(queryTxn())(
      'should raise ParsingFailureError only in lambda',
      async ({ cluster, env }) => {
        let numAttempts = 0
        await expectSentinelFailure(
          () =>
            cluster.transactions().run(
              async (attempt) => {
                numAttempts++
                await expectCouchbaseError(
                  () => attempt.query('This is not N1QL'),
                  ParsingFailureError,
                  env.ctx({
                    op: 'transaction query',
                    extra: 'This is not N1QL',
                  })
                )
                throw new Error('success')
              },
              { timeout: 2000 }
            ),
          'success',
          env.ctx({ op: 'transaction run' })
        )
        expect(numAttempts, 'attempts').toBe(1)

        numAttempts = 0
        const err = await expectCouchbaseError(
          () =>
            cluster.transactions().run(
              async (attempt) => {
                numAttempts++
                await attempt.query('This is not N1QL')
              },
              { timeout: 2000 }
            ),
          TransactionFailedError,
          env.ctx({ op: 'transaction run', extra: 'This is not N1QL' })
        )
        expect(err.cause, 'transaction cause').toBeInstanceOf(
          ParsingFailureError
        )
        expect(err.cause?.message, 'transaction cause message').toContain(
          'parsing failure'
        )
        // Regression guard (JSCBC-1480): a query error keeps its
        // QueryErrorContext out of `run()`.
        expect(err.context, 'transaction error context').toBeInstanceOf(
          QueryErrorContext
        )
        expect(numAttempts, 'attempts').toBe(1)
      }
    )

    test.skipIf(queryTxn())(
      'should raise BucketNotFound if metadata collection bucket does not exist',
      async ({ collectionLease, env }) => {
        const cluster = await env.openCluster(
          {},
          {
            transactions: {
              metadataCollection: {
                bucket: 'no-bucket',
                scope: '_default',
                collection: '_default',
              },
            },
          }
        )
        const coll = cluster
          .bucket(collectionLease.bucketName)
          .scope(collectionLease.scopeName)
          .collection(collectionLease.collectionName)

        await expectCouchbaseError(
          () =>
            cluster.transactions().run(
              async (attempt) => {
                // Never reached: creating the transactions object raises.
                await attempt.get(coll, 'not-a-key')
              },
              { timeout: 2000 }
            ),
          BucketNotFoundError,
          env.ctx({ op: 'transaction run', extra: 'metadata bucket=no-bucket' })
        )
      }
    )

    describe('#binary', () => {
      test.skipIf(binaryTxn())(
        'should not fail to parse binary doc w/in lambda',
        async ({ cluster, collection, env }) => {
          const testkey = scratchKey(env, collection)

          await collection.insert(testkey, testBinVal)

          await cluster.transactions().run(
            async (attempt) => {
              const getDoc = await attempt.get(collection, testkey)
              expect(
                getDoc.content,
                withCtx('binary document read inside the transaction', {
                  key: testkey,
                })
              ).toEqual(testBinVal)
            },
            { timeout: 5000 }
          )
        }
      )

      test.skipIf(lacking(ServerFeature.BinaryTransactions))(
        'should allow binary txns',
        async ({ cluster, collection, env }) => {
          const testkey = scratchKey(env, collection)
          await cluster.transactions().run(
            async (attempt) => {
              await attempt.insert(collection, testkey, testBinVal)
              const getRes = await attempt.get(collection, testkey)
              expect(
                getRes.content,
                withCtx('staged binary insert read back', { key: testkey })
              ).toEqual(testBinVal)
              const repRes = await attempt.replace(getRes, newBinVal)
              // Compared as strings: `!=` on two CAS objects checks identity,
              // which holds for any two reads.
              expect(
                repRes.cas.toString(),
                withCtx('replace should change the cas', { key: testkey })
              ).not.toBe(getRes.cas.toString())
            },
            { timeout: 5000 }
          )
        }
      )

      // Runs only on a cluster older than 7.6.2.
      test.skipIf(binaryTxn() || having(ServerFeature.BinaryTransactions))(
        'should have FeatureNotAvailableError cause if binary txns not supported',
        async ({ cluster, collection, env }) => {
          const testkey = scratchKey(env, collection)
          let numAttempts = 0
          const err = await expectCouchbaseError(
            () =>
              cluster.transactions().run(
                async (attempt) => {
                  numAttempts++
                  await attempt.insert(collection, testkey, testBinVal)
                },
                { timeout: 2000 }
              ),
            TransactionFailedError,
            env.ctx({ op: 'transaction insert', key: testkey })
          )
          expect(err.cause, 'transaction cause').toBeInstanceOf(
            FeatureNotAvailableError
          )
          const cause = err.cause
          if (!(cause instanceof FeatureNotAvailableError)) {
            throw new Error('unreachable: the cause is checked just above')
          }
          expect(cause.cause?.message, 'feature-not-available cause').toBe(
            BINARY_UNSUPPORTED
          )
          expect(numAttempts, 'attempts').toBe(1)
        }
      )

      describe('#rawbinarytranscoder', () => {
        test.skipIf(lacking(ServerFeature.BinaryTransactions))(
          'should allow binary txns using RawBinaryTranscoder',
          async ({ cluster, collection, env }) => {
            const testkey = scratchKey(env, collection)
            const tc = new RawBinaryTranscoder()
            await cluster.transactions().run(
              async (attempt) => {
                await attempt.insert(collection, testkey, testBinVal, {
                  transcoder: tc,
                })
                const getRes = await attempt.get(collection, testkey, {
                  transcoder: tc,
                })
                expect(
                  getRes.content,
                  withCtx('staged binary insert read back', { key: testkey })
                ).toEqual(testBinVal)
                const repRes = await attempt.replace(getRes, newBinVal)
                // Compared as strings, as above.
                expect(
                  repRes.cas.toString(),
                  withCtx('replace should change the cas', { key: testkey })
                ).not.toBe(getRes.cas.toString())
              },
              { timeout: 5000 }
            )
          }
        )

        test.skipIf(binaryTxn() || having(ServerFeature.BinaryTransactions))(
          'should have FeatureNotAvailableError cause if binary txns not supported using RawBinaryTranscoder',
          async ({ cluster, collection, env }) => {
            const testkey = scratchKey(env, collection)
            const tc = new RawBinaryTranscoder()
            let numAttempts = 0
            const err = await expectCouchbaseError(
              () =>
                cluster.transactions().run(
                  async (attempt) => {
                    numAttempts++
                    await attempt.insert(collection, testkey, testBinVal, {
                      transcoder: tc,
                    })
                  },
                  { timeout: 2000 }
                ),
              TransactionFailedError,
              env.ctx({ op: 'transaction insert', key: testkey })
            )
            expect(err.cause, 'transaction cause').toBeInstanceOf(
              FeatureNotAvailableError
            )
            const cause = err.cause
            if (!(cause instanceof FeatureNotAvailableError)) {
              throw new Error('unreachable: the cause is checked just above')
            }
            expect(cause.cause?.message, 'feature-not-available cause').toBe(
              BINARY_UNSUPPORTED
            )
            expect(numAttempts, 'attempts').toBe(1)
          }
        )
      })
    })

    group('#server-groups', [ServerFeature.ServerGroups], () => {
      test('should raise DocumentUnretrievableError only in lambda', async ({
        cluster,
        collection,
        env,
      }) => {
        // @FINDING(JSCBC-1481): the key does not exist, so the asserted error
        // arrives whatever the server group configuration, and nothing here
        // distinguishes this method from `get` on a missing key.
        const serverGroupKey = 'i-dont-exist'
        let numAttempts = 0
        await expectSentinelFailure(
          () =>
            cluster.transactions().run(
              async (attempt) => {
                numAttempts++
                await expectCouchbaseError(
                  () =>
                    attempt.getReplicaFromPreferredServerGroup(
                      collection,
                      serverGroupKey
                    ),
                  DocumentUnretrievableError,
                  env.ctx({
                    op: 'transaction getReplicaFromPreferredServerGroup',
                    key: serverGroupKey,
                  })
                )
                throw new Error('success')
              },
              { timeout: 2000 }
            ),
          'success',
          env.ctx({ op: 'transaction run' })
        )
        expect(numAttempts, 'attempts').toBe(1)

        numAttempts = 0
        const err = await expectCouchbaseError(
          () =>
            cluster.transactions().run(
              async (attempt) => {
                numAttempts++
                await attempt.getReplicaFromPreferredServerGroup(
                  collection,
                  serverGroupKey
                )
              },
              { timeout: 2000 }
            ),
          TransactionFailedError,
          env.ctx({ op: 'transaction run', key: serverGroupKey })
        )
        expect(err.cause, 'transaction cause').toBeInstanceOf(
          DocumentUnretrievableError
        )
        expect(numAttempts, 'attempts').toBe(1)
      })
    })

    describe('#getMulti', () => {
      test('should successfully execute getMulti operation', async ({
        cluster,
        collection,
        env,
      }) => {
        const testDocsAndIds = await multiDocsFor(env, collection, 'getMulti')
        await cluster.transactions().run(async (attempt) => {
          const specs = [
            new TransactionGetMultiSpec(collection, testDocsAndIds[0].id),
            new TransactionGetMultiSpec(collection, testDocsAndIds[1].id),
          ]
          const getRes = await attempt.getMulti(specs)
          expect(getRes, 'getMulti result').toBeInstanceOf(
            TransactionGetMultiResult
          )
          expect(getRes.exists(0), 'exists(0)').toBe(true)
          expect(getRes.contentAt(0), 'contentAt(0)').toEqual(
            testDocsAndIds[0].testDoc
          )
          expect(getRes.content[0].value, 'content[0].value').toEqual(
            testDocsAndIds[0].testDoc
          )
          expect(getRes.content[0].error, 'content[0].error').toBeNull()
          expect(getRes.exists(1), 'exists(1)').toBe(true)
          expect(getRes.contentAt(1), 'contentAt(1)').toEqual(
            testDocsAndIds[1].testDoc
          )
          expect(getRes.content[1].value, 'content[1].value').toEqual(
            testDocsAndIds[1].testDoc
          )
          expect(getRes.content[1].error, 'content[1].error').toBeNull()
        })
      })

      test.skipIf(lacking(ServerFeature.BinaryTransactions))(
        'should allow binary txn',
        async ({ cluster, collection, env }) => {
          const testDocsAndIds = await multiDocsFor(env, collection, 'getMulti')
          const testkey = scratchKey(env, collection)
          const tc = new RawBinaryTranscoder()
          await collection.insert(testkey, testBinVal, {
            transcoder: tc,
          })

          await cluster.transactions().run(async (attempt) => {
            const specs = [
              new TransactionGetMultiSpec(collection, testkey, tc),
              new TransactionGetMultiSpec(collection, testDocsAndIds[0].id),
            ]
            const getRes = await attempt.getMulti(specs)
            expect(getRes, 'getMulti result').toBeInstanceOf(
              TransactionGetMultiResult
            )
            expect(getRes.contentAt(0), 'contentAt(0)').toEqual(testBinVal)
            expect(getRes.contentAt(1), 'contentAt(1)').toEqual(
              testDocsAndIds[0].testDoc
            )
          })
        }
      )

      test('should allow custom undefined transcoder', async ({
        cluster,
        collection,
        env,
      }) => {
        const testkey1 = scratchKey(env, collection)
        const testkey2 = scratchKey(env, collection)
        const testVal1 = 'test-value'
        const testVal2 = undefined
        const tc = new AllowUndefinedTranscoder()
        await collection.insert(testkey1, testVal1, {
          transcoder: tc,
        })

        await collection.insert(testkey2, testVal2, {
          transcoder: tc,
        })

        await cluster.transactions().run(async (attempt) => {
          const specs = [
            new TransactionGetMultiSpec(collection, testkey1, tc),
            new TransactionGetMultiSpec(collection, testkey2, tc),
            new TransactionGetMultiSpec(collection, 'not-a-key'),
          ]
          const getRes = await attempt.getMulti(specs)
          expect(getRes, 'getMulti result').toBeInstanceOf(
            TransactionGetMultiResult
          )
          expect(getRes.exists(0), 'exists(0)').toBe(true)
          expect(getRes.contentAt(0), 'contentAt(0)').toEqual(testVal1)
          expect(getRes.exists(1), 'exists(1)').toBe(true)
          expect(getRes.contentAt(1), 'contentAt(1)').toEqual(testVal2)
          expect(getRes.exists(2), 'exists(2)').toBe(false)
          expect(getRes.content[2].error, 'content[2].error').toBeTruthy()
          expect(
            () => getRes.contentAt(2),
            withCtx('contentAt on a missing document', { key: 'not-a-key' })
          ).toThrow(DocumentNotFoundError)
        })
      })

      test('should allow handle missing document', async ({
        cluster,
        collection,
        env,
      }) => {
        const testDocsAndIds = await multiDocsFor(env, collection, 'getMulti')
        const testkey = 'i-dont-exist'
        await cluster.transactions().run(async (attempt) => {
          const specs = [
            new TransactionGetMultiSpec(collection, testDocsAndIds[0].id),
            new TransactionGetMultiSpec(collection, testDocsAndIds[1].id),
            new TransactionGetMultiSpec(collection, testkey),
          ]
          const getRes = await attempt.getMulti(specs)
          expect(getRes, 'getMulti result').toBeInstanceOf(
            TransactionGetMultiResult
          )
          expect(getRes.exists(0), 'exists(0)').toBe(true)
          expect(getRes.exists(1), 'exists(1)').toBe(true)
          expect(getRes.exists(2), 'exists(2)').toBe(false)
          expect(
            () => getRes.contentAt(2),
            withCtx('contentAt on a missing document', { key: testkey })
          ).toThrow(DocumentNotFoundError)
        })
      })

      test('should allow raise error if invalid index', async ({
        cluster,
        collection,
        env,
      }) => {
        const testDocsAndIds = await multiDocsFor(env, collection, 'getMulti')
        const idxOutOfBounds = 2
        await cluster.transactions().run(async (attempt) => {
          const specs = [
            new TransactionGetMultiSpec(collection, testDocsAndIds[0].id),
            new TransactionGetMultiSpec(collection, testDocsAndIds[1].id),
          ]
          const getRes = await attempt.getMulti(specs)
          expect(getRes, 'getMulti result').toBeInstanceOf(
            TransactionGetMultiResult
          )
          expect(getRes.exists(0), 'exists(0)').toBe(true)
          expect(getRes.exists(1), 'exists(1)').toBe(true)
          expect(
            () => getRes.exists(idxOutOfBounds),
            withCtx('exists past the end of the result', {
              extra: `index=${idxOutOfBounds}`,
            })
          ).toThrow(`Index (${idxOutOfBounds}) out of bounds.`)
        })
      })

      test('should allow different mode', async ({
        cluster,
        collection,
        env,
      }) => {
        const testDocsAndIds = await multiDocsFor(env, collection, 'getMulti')
        await cluster.transactions().run(async (attempt) => {
          const specs = [
            new TransactionGetMultiSpec(collection, testDocsAndIds[0].id),
            new TransactionGetMultiSpec(collection, testDocsAndIds[1].id),
          ]
          const getRes = await attempt.getMulti(specs, {
            mode: TransactionGetMultiMode.DisableReadSkewDetection,
          })
          expect(getRes, 'getMulti result').toBeInstanceOf(
            TransactionGetMultiResult
          )
          expect(getRes.exists(0), 'exists(0)').toBe(true)
          expect(getRes.contentAt(0), 'contentAt(0)').toEqual(
            testDocsAndIds[0].testDoc
          )
          expect(getRes.exists(1), 'exists(1)').toBe(true)
          expect(getRes.contentAt(1), 'contentAt(1)').toEqual(
            testDocsAndIds[1].testDoc
          )
        })
      })
    })

    group(
      '#getMultiReplicasFromPreferredServerGroup',
      [
        ServerFeature.SubdocReadReplica,
        ServerFeature.Replicas,
        ServerFeature.ServerGroups,
      ],
      () => {
        test('should successfully execute getMulti operation', async ({
          cluster,
          collection,
          env,
        }) => {
          const testDocsAndIds = await multiDocsFor(
            env,
            collection,
            'getMultiReplicas'
          )
          await cluster.transactions().run(async (attempt) => {
            const specs = [
              new TransactionGetMultiReplicasFromPreferredServerGroupSpec(
                collection,
                testDocsAndIds[0].id
              ),
              new TransactionGetMultiReplicasFromPreferredServerGroupSpec(
                collection,
                testDocsAndIds[1].id
              ),
            ]
            const getRes =
              await attempt.getMultiReplicasFromPreferredServerGroup(specs)
            expect(getRes, 'getMulti result').toBeInstanceOf(
              TransactionGetMultiReplicasFromPreferredServerGroupResult
            )
            expect(getRes.exists(0), 'exists(0)').toBe(true)
            expect(getRes.contentAt(0), 'contentAt(0)').toEqual(
              testDocsAndIds[0].testDoc
            )
            expect(getRes.content[0].value, 'content[0].value').toEqual(
              testDocsAndIds[0].testDoc
            )
            expect(getRes.content[0].error, 'content[0].error').toBeNull()
            expect(getRes.exists(1), 'exists(1)').toBe(true)
            expect(getRes.contentAt(1), 'contentAt(1)').toEqual(
              testDocsAndIds[1].testDoc
            )
            expect(getRes.content[1].value, 'content[1].value').toEqual(
              testDocsAndIds[1].testDoc
            )
            expect(getRes.content[1].error, 'content[1].error').toBeNull()
          })
        })

        test.skipIf(lacking(ServerFeature.BinaryTransactions))(
          'should allow binary txn',
          async ({ cluster, collection, env }) => {
            const testDocsAndIds = await multiDocsFor(
              env,
              collection,
              'getMultiReplicas'
            )
            const testkey = scratchKey(env, collection)
            const tc = new RawBinaryTranscoder()
            await collection.insert(testkey, testBinVal, {
              transcoder: tc,
            })

            await cluster.transactions().run(async (attempt) => {
              const specs = [
                new TransactionGetMultiReplicasFromPreferredServerGroupSpec(
                  collection,
                  testkey,
                  tc
                ),
                new TransactionGetMultiReplicasFromPreferredServerGroupSpec(
                  collection,
                  testDocsAndIds[0].id
                ),
              ]
              const getRes =
                await attempt.getMultiReplicasFromPreferredServerGroup(specs)
              expect(getRes, 'getMulti result').toBeInstanceOf(
                TransactionGetMultiReplicasFromPreferredServerGroupResult
              )
              expect(getRes.contentAt(0), 'contentAt(0)').toEqual(testBinVal)
              expect(getRes.contentAt(1), 'contentAt(1)').toEqual(
                testDocsAndIds[0].testDoc
              )
            })
          }
        )

        test('should allow custom undefined transcoder', async ({
          cluster,
          collection,
          env,
        }) => {
          const testkey1 = scratchKey(env, collection)
          const testkey2 = scratchKey(env, collection)
          const testVal1 = 'test-value'
          const testVal2 = undefined
          const tc = new AllowUndefinedTranscoder()
          await collection.insert(testkey1, testVal1, {
            transcoder: tc,
          })

          await collection.insert(testkey2, testVal2, {
            transcoder: tc,
          })

          await cluster.transactions().run(async (attempt) => {
            const specs = [
              new TransactionGetMultiReplicasFromPreferredServerGroupSpec(
                collection,
                testkey1,
                tc
              ),
              new TransactionGetMultiReplicasFromPreferredServerGroupSpec(
                collection,
                testkey2,
                tc
              ),
              new TransactionGetMultiReplicasFromPreferredServerGroupSpec(
                collection,
                'not-a-key'
              ),
            ]
            const getRes =
              await attempt.getMultiReplicasFromPreferredServerGroup(specs)
            expect(getRes, 'getMulti result').toBeInstanceOf(
              TransactionGetMultiReplicasFromPreferredServerGroupResult
            )
            expect(getRes.exists(0), 'exists(0)').toBe(true)
            expect(getRes.contentAt(0), 'contentAt(0)').toEqual(testVal1)
            expect(getRes.exists(1), 'exists(1)').toBe(true)
            expect(getRes.contentAt(1), 'contentAt(1)').toEqual(testVal2)
            expect(getRes.exists(2), 'exists(2)').toBe(false)
            expect(getRes.content[2].error, 'content[2].error').toBeTruthy()
            expect(
              () => getRes.contentAt(2),
              withCtx('contentAt on a missing document', { key: 'not-a-key' })
            ).toThrow(DocumentNotFoundError)
          })
        })

        test('should allow handle missing document', async ({
          cluster,
          collection,
          env,
        }) => {
          const testDocsAndIds = await multiDocsFor(
            env,
            collection,
            'getMultiReplicas'
          )
          const testkey = 'i-dont-exist'
          await cluster.transactions().run(async (attempt) => {
            const specs = [
              new TransactionGetMultiReplicasFromPreferredServerGroupSpec(
                collection,
                testDocsAndIds[0].id
              ),
              new TransactionGetMultiReplicasFromPreferredServerGroupSpec(
                collection,
                testDocsAndIds[1].id
              ),
              new TransactionGetMultiReplicasFromPreferredServerGroupSpec(
                collection,
                testkey
              ),
            ]
            const getRes =
              await attempt.getMultiReplicasFromPreferredServerGroup(specs)
            expect(getRes, 'getMulti result').toBeInstanceOf(
              TransactionGetMultiReplicasFromPreferredServerGroupResult
            )
            expect(getRes.exists(0), 'exists(0)').toBe(true)
            expect(getRes.exists(1), 'exists(1)').toBe(true)
            expect(getRes.exists(2), 'exists(2)').toBe(false)
            expect(
              () => getRes.contentAt(2),
              withCtx('contentAt on a missing document', { key: testkey })
            ).toThrow(DocumentNotFoundError)
          })
        })

        test('should allow raise error if invalid index', async ({
          cluster,
          collection,
          env,
        }) => {
          const testDocsAndIds = await multiDocsFor(
            env,
            collection,
            'getMultiReplicas'
          )
          const idxOutOfBounds = 2
          await cluster.transactions().run(async (attempt) => {
            const specs = [
              new TransactionGetMultiReplicasFromPreferredServerGroupSpec(
                collection,
                testDocsAndIds[0].id
              ),
              new TransactionGetMultiReplicasFromPreferredServerGroupSpec(
                collection,
                testDocsAndIds[1].id
              ),
            ]
            const getRes =
              await attempt.getMultiReplicasFromPreferredServerGroup(specs)
            expect(getRes, 'getMulti result').toBeInstanceOf(
              TransactionGetMultiReplicasFromPreferredServerGroupResult
            )
            expect(getRes.exists(0), 'exists(0)').toBe(true)
            expect(getRes.exists(1), 'exists(1)').toBe(true)
            expect(
              () => getRes.exists(idxOutOfBounds),
              withCtx('exists past the end of the result', {
                extra: `index=${idxOutOfBounds}`,
              })
            ).toThrow(`Index (${idxOutOfBounds}) out of bounds.`)
          })
        })

        test('should allow different mode', async ({
          cluster,
          collection,
          env,
        }) => {
          const testDocsAndIds = await multiDocsFor(
            env,
            collection,
            'getMultiReplicas'
          )
          await cluster.transactions().run(async (attempt) => {
            const specs = [
              new TransactionGetMultiReplicasFromPreferredServerGroupSpec(
                collection,
                testDocsAndIds[0].id
              ),
              new TransactionGetMultiReplicasFromPreferredServerGroupSpec(
                collection,
                testDocsAndIds[1].id
              ),
            ]
            const getRes =
              await attempt.getMultiReplicasFromPreferredServerGroup(specs, {
                mode: TransactionGetMultiReplicasFromPreferredServerGroupMode.DisableReadSkewDetection,
              })
            expect(getRes, 'getMulti result').toBeInstanceOf(
              TransactionGetMultiReplicasFromPreferredServerGroupResult
            )
            expect(getRes.exists(0), 'exists(0)').toBe(true)
            expect(getRes.contentAt(0), 'contentAt(0)').toEqual(
              testDocsAndIds[0].testDoc
            )
            expect(getRes.exists(1), 'exists(1)').toBe(true)
            expect(getRes.contentAt(1), 'contentAt(1)').toEqual(
              testDocsAndIds[1].testDoc
            )
          })
        })
      }
    )
  }
)
