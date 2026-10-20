import { TransactionOperationFailedError } from '../../../lib/errors'
import { TransactionAttemptContext } from '../../../lib/transactions'
import { expectCouchbaseError } from '../../asserts/errors'
import { ServerFeature, TestProtocol } from '../../infra/capabilities'
import { CollectionStrategy } from '../../infra/requirements'
import { defineSuite } from '../../infra/suite'

// The core throws, rather than calling the handler, when an operation cannot
// start at all, as with no attempt in progress. The entry point reports that
// through the operation's callback, so the caller gets the same typed error as
// any other transaction failure. Before it did, the exception escaped the
// entry point and aborted the process, so on the old code this file ends its
// own test process.

defineSuite(
  '#transactions native exceptions',
  {
    features: [ServerFeature.Transactions],
    collection: CollectionStrategy.Named,
    // The throw belongs to the native core; couchbase2 has none.
    protocols: [TestProtocol.Classic],
  },
  ({ test }) => {
    test('should reject an operation made before any attempt', async ({
      cluster,
      collection,
      env,
    }) => {
      // `_newAttempt` is never called, so the core has no attempt to run on.
      const attempt = new TransactionAttemptContext(cluster.transactions())
      const key = env.key()

      await expectCouchbaseError(
        () => attempt.insert(collection, key, { foo: 'bar' }),
        TransactionOperationFailedError,
        env.ctx({ op: 'insert', key })
      )
      await expectCouchbaseError(
        () => attempt._rollback(),
        TransactionOperationFailedError,
        env.ctx({ op: 'rollback' })
      )
    })
  }
)
