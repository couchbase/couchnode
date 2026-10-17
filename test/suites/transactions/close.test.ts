import { expect } from 'vitest'

import type { Cluster } from '../../../lib/cluster'
import type { Collection } from '../../../lib/collection'
import { withCtx } from '../../asserts/ctx'
import { ServerFeature } from '../../infra/capabilities'
import type { TestEnv } from '../../infra/env'
import { CollectionStrategy } from '../../infra/requirements'
import { defineSuite } from '../../infra/suite'

// Each test opens its own connection, because closing transactions is the
// subject. A transaction is run first so the client has a record to remove
// from the leased collection, which is the work the close waits on.

/**
 * Opens a connection and commits one transaction through it, on the leased
 * collection. The committed document is removed through the shared connection.
 */
async function openWithRecord(
  env: TestEnv,
  collection: Collection
): Promise<Cluster> {
  const cluster = await env.openCluster()
  const own = cluster
    .bucket(collection.scope.bucket.name)
    .scope(collection.scope.name)
    .collection(collection.name)
  const key = env.key()
  // A KV operation first, so a connection still opening fails here as a
  // plain timeout rather than inside the transaction.
  await own.exists(key)
  await cluster.transactions().run(async (attempt) => {
    await attempt.insert(own, key, { foo: 'bar' })
  })
  env.registerCleanup(async () => {
    await collection.remove(key)
  })
  return cluster
}

defineSuite(
  '#transactions close',
  {
    features: [ServerFeature.Transactions],
    collection: CollectionStrategy.Named,
  },
  ({ test }) => {
    test('should complete close after the call returns', async ({
      collection,
      env,
    }) => {
      const cluster = await openWithRecord(env, collection)

      // A close run on the calling thread would invoke the callback before
      // the call returned, holding the event loop for the whole of it.
      let returned = false
      const closed = new Promise<{ err: unknown; afterReturn: boolean }>(
        (resolve) => {
          cluster.transactions().impl.close((err) => {
            resolve({ err, afterReturn: returned })
          })
        }
      )
      returned = true

      const result = await closed
      expect(
        result,
        withCtx('transactions close callback', { op: 'close' })
      ).toStrictEqual({ err: null, afterReturn: true })

      // The second close, from the cluster, runs on transactions already
      // closed.
      await cluster.close()
    })

    test('should resolve both of two concurrent closes', async ({
      collection,
      env,
    }) => {
      const cluster = await openWithRecord(env, collection)
      const transactions = cluster.transactions()

      await Promise.all([transactions._close(), transactions._close()])
      await cluster.close()
    })
  }
)
