import { TimeoutError } from '../../../../lib/errors'
import { expectThrows } from '../../asserts/errors'
import { ServerFeature } from '../../infra/capabilities'
import { BucketLease } from '../../infra/leases/bucket-lease'
import { defineSuite } from '../../infra/suite'
import { sleep } from '../../infra/retry'

// A management operation given an unreachable deadline raises `TimeoutError`.
// `flushBucket` is the slowest management call, so a 1ms budget cannot be met
// by accident.
//
// The flush targets a bucket this suite owns: a client-side timeout does not
// recall the request, so the server may still flush, and on the shared bucket
// that would wipe other suites' documents at an unpredictable moment.
//
// `exclusive` because bucket lifecycle operations serialize cluster-wide.

const IMPOSSIBLE_TIMEOUT_MS = 1

/**
 * Lets an abandoned flush finish before the lease drops the bucket, so the
 * drop does not race it.
 */
const SETTLE_MS = 1000

/**
 * Creating a bucket and waiting for key-value is a minute's allowance alone,
 * and a runner timeout below the wait's would hide the wait's message.
 */
const BUCKET_TEST_TIMEOUT_MS = 120_000

defineSuite(
  '#management-apis',
  {
    features: [ServerFeature.BucketManagement, ServerFeature.KeyValue],
    tier: 'slow',
  },
  ({ test, limited }) => {
    test.skipIf(limited('gocaves-flush-ignores-timeout'))(
      'should successfully timeout operations (slow)',
      async ({ cluster, env, signal }) => {
        // Without `flushEnabled` the flush fails for that reason instead, and
        // the test passes without exercising a timeout.
        const lease = await BucketLease.acquire(env, '#management-apis', {
          flushEnabled: true,
          signal,
        })

        await expectThrows(
          () =>
            cluster.buckets().flushBucket(lease.bucketName, {
              timeout: IMPOSSIBLE_TIMEOUT_MS,
            }),
          TimeoutError,
          undefined,
          env.ctx({
            op: 'flushBucket',
            bucket: lease.bucketName,
            extra: `timeout=${IMPOSSIBLE_TIMEOUT_MS}ms`,
          })
        )

        await sleep(SETTLE_MS, signal)
      },
      BUCKET_TEST_TIMEOUT_MS
    )
  }
)
