import { runInNewContext } from 'vm'
import { setFlagsFromString } from 'v8'

import { expect } from 'vitest'

import {
  TransactionAttemptContext,
  Transactions,
} from '../../../lib/transactions'
import { withCtx } from '../../asserts/ctx'
import { ServerFeature } from '../../infra/capabilities'
import { CollectionStrategy } from '../../infra/requirements'
import { defineSuite } from '../../infra/suite'

// A transaction keeps the core transactions object it was started from alive,
// so collecting the `Transactions` that made it frees nothing the transaction
// still uses. Before the transaction shared ownership, its core context held a
// bare reference to that object, which dangled once the wrapper was collected.

/** Sweeps before giving up on the wrapper being collected. */
const MAX_SWEEPS = 50

defineSuite(
  '#transactions ownership',
  {
    features: [ServerFeature.Transactions],
    collection: CollectionStrategy.Named,
  },
  ({ test }) => {
    test('should commit after its transactions object is collected', async ({
      collection,
      env,
    }) => {
      const cluster = await env.openCluster()
      const own = cluster
        .bucket(collection.scope.bucket.name)
        .scope(collection.scope.name)
        .collection(collection.name)

      let collected = false
      const registry = new FinalizationRegistry(() => {
        collected = true
      })

      // Built in a function of its own, so nothing on this frame keeps the
      // `Transactions` reachable once it returns. The attempt context holds
      // only the native transaction.
      const attempt = ((): TransactionAttemptContext => {
        const txns = new Transactions(cluster)
        registry.register(txns.impl, undefined)
        return new TransactionAttemptContext(txns)
      })()

      // `expose-gc` is inlined because the package ships no type
      // declarations.
      setFlagsFromString('--expose_gc')
      const gc = runInNewContext('gc') as () => void
      for (let sweep = 0; sweep < MAX_SWEEPS && !collected; sweep++) {
        gc()
        await new Promise((resolve) => setImmediate(resolve))
      }
      // A native finalizer may be deferred to the task after the sweep.
      await new Promise((resolve) => setImmediate(resolve))
      expect(
        collected,
        withCtx('transactions wrapper collected', { op: 'gc' })
      ).toBe(true)

      const key = env.key()
      await attempt._newAttempt()
      await attempt.insert(own, key, { foo: 'bar' })
      const result = await attempt._commit()
      env.registerCleanup(async () => {
        await collection.remove(key)
      })
      expect(
        result.unstagingComplete,
        withCtx('commit after collection', { op: 'commit', key })
      ).toBe(true)

      await cluster.close()
    })
  }
)
