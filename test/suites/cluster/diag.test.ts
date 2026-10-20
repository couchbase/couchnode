import { describe, expect } from 'vitest'

import type { Bucket } from '../../../lib/bucket'
import type { Cluster } from '../../../lib/cluster'
import {
  ClusterState,
  DiagnosticsResult,
  PingResult,
} from '../../../lib/diagnosticstypes'
import { InvalidArgumentError } from '../../../lib/errors'
import { ServiceType } from '../../../lib/generaltypes'
import { AssertCtx, withCtx } from '../../asserts/ctx'
import { expectThrows } from '../../asserts/errors'
import { awaitCallback } from '../../infra/callbacks'
import { ServerFeature } from '../../infra/capabilities'
import { CollectionStrategy } from '../../infra/requirements'
import { pollUntil } from '../../infra/retry'
import { defineSuite } from '../../infra/suite'

// Connections come from `env.openCluster()`, which the environment closes, so
// a failing assertion cannot leak one.
//
// The cluster-level diagnostics test asserts on the server's answer. Do not
// `catch` and substitute an empty report: the assertions would then check the
// fabrication. Every supported server answers, so a failed call is a failure.

const READY_TIMEOUT_MS = 1500
const NEW_CONNECTION_READY_TIMEOUT_MS = 10_000
const WARN_DEADLINE_MS = 3000

function assertReportShape(
  res: DiagnosticsResult | PingResult,
  c: AssertCtx
): void {
  expect(res, withCtx('a report object', c)).toBeTypeOf('object')
  expect(res.id, withCtx('report id', c)).toBeTypeOf('string')
  expect(res.version, withCtx('report version', c)).toEqual(2)
  expect(res.sdk, withCtx('reporting sdk', c)).toBeTypeOf('string')
  expect(res.services, withCtx('per-service entries', c)).toBeTypeOf('object')
}

function assertReady(res: unknown, c: AssertCtx): void {
  expect(res, withCtx('waitUntilReady result', c)).toBeUndefined()
}

function pingKeyValue(target: Cluster | Bucket): Promise<PingResult> {
  return target.ping({ serviceTypes: [ServiceType.KeyValue] })
}

defineSuite(
  '#diagnostics',
  {
    collection: CollectionStrategy.DefaultCollection,
    features: [ServerFeature.KeyValue],
  },
  ({ test }) => {
    describe('#info', () => {
      test('should fetch diagnostics data on a cluster successfully', async ({
        env,
      }) => {
        const cluster = await env.openCluster()
        const res = await cluster.diagnostics()
        assertReportShape(res, env.ctx({ op: 'diagnostics', extra: 'cluster' }))
      })

      test('should fetch diagnostics data with a bucket open successfully', async ({
        cluster,
        env,
      }) => {
        const res = await cluster.diagnostics()
        assertReportShape(
          res,
          env.ctx({ op: 'diagnostics', extra: 'bucket open' })
        )
      })

      test('should ping a cluster successfully', async ({ cluster, env }) => {
        const res = await pingKeyValue(cluster)
        assertReportShape(res, env.ctx({ op: 'ping', extra: 'cluster' }))
      })

      test('should ping a bucket successfully', async ({ env }) => {
        const res = await pingKeyValue(env.bucket)
        assertReportShape(res, env.ctx({ op: 'ping', extra: 'bucket' }))
      })

      test('should ping a new cluster successfully', async ({ env }) => {
        const cluster = await env.openCluster()
        const res = await pingKeyValue(cluster)
        assertReportShape(res, env.ctx({ op: 'ping', extra: 'new cluster' }))
      })

      test('should ping a new bucket successfully', async ({ env }) => {
        const cluster = await env.openCluster()
        const res = await pingKeyValue(cluster.bucket(env.config.bucket))
        assertReportShape(res, env.ctx({ op: 'ping', extra: 'new bucket' }))
      })
    })

    describe('#waitUntilReady', () => {
      test('should wait until a cluster is ready', async ({ cluster, env }) => {
        const res = await cluster.waitUntilReady(READY_TIMEOUT_MS)
        assertReady(res, env.ctx({ op: 'waitUntilReady', extra: 'cluster' }))
      })

      test('should wait until a bucket is ready', async ({ env }) => {
        const res = await env.bucket.waitUntilReady(READY_TIMEOUT_MS)
        assertReady(res, env.ctx({ op: 'waitUntilReady', extra: 'bucket' }))
      })

      test('should wait until ready for a desired state of Online', async ({
        cluster,
        env,
      }) => {
        const res = await cluster.waitUntilReady(READY_TIMEOUT_MS, {
          desiredState: ClusterState.Online,
        })
        assertReady(res, env.ctx({ op: 'waitUntilReady', extra: 'Online' }))
      })

      test('should wait until ready for a desired state of Degraded', async ({
        cluster,
        env,
      }) => {
        const res = await cluster.waitUntilReady(READY_TIMEOUT_MS, {
          desiredState: ClusterState.Degraded,
        })
        assertReady(res, env.ctx({ op: 'waitUntilReady', extra: 'Degraded' }))
      })

      test('should wait for explicit bucket scoped KV', async ({ env }) => {
        const res = await env.bucket.waitUntilReady(READY_TIMEOUT_MS, {
          serviceTypes: [ServiceType.KeyValue],
        })
        assertReady(
          res,
          env.ctx({ op: 'waitUntilReady', extra: 'bucket, kv only' })
        )
      })

      test('should resolve immediately when only KV is requested at cluster scope', async ({
        cluster,
        env,
      }) => {
        const res = await cluster.waitUntilReady(READY_TIMEOUT_MS, {
          serviceTypes: [ServiceType.KeyValue],
        })
        assertReady(
          res,
          env.ctx({ op: 'waitUntilReady', extra: 'cluster, kv only' })
        )
      })

      test('should emit a warn when filtering services at cluster scope', async ({
        env,
        signal,
      }) => {
        const warnings: string[] = []
        const cluster = await env.openCluster(
          {},
          { logger: { warn: (message: string) => warnings.push(message) } }
        )

        await cluster.waitUntilReady(READY_TIMEOUT_MS, {
          serviceTypes: [ServiceType.KeyValue],
        })

        // The SDK logs without awaiting, so the warning can land after
        // `waitUntilReady` resolves. The poll only waits; the assertion below
        // is the check.
        const found = await pollUntil<readonly string[]>(
          'a warning that kv was ignored at cluster scope',
          async (ctx) => {
            const matching = warnings.filter(
              (m) =>
                m.includes('ignoring') &&
                m.includes('kv') &&
                m.includes('cluster scope')
            )
            if (matching.length > 0) {
              return matching
            }
            ctx.note(
              warnings.length
                ? `warnings so far: ${warnings.join(' | ')}`
                : 'no warnings logged'
            )
            return undefined
          },
          { deadlineMs: WARN_DEADLINE_MS, intervalMs: 50, signal }
        )

        expect(
          found.length,
          withCtx(
            'warnings about ignoring kv at cluster scope',
            env.ctx({ op: 'waitUntilReady', extra: 'cluster, kv only' })
          )
        ).toBeGreaterThanOrEqual(1)
      })

      test('should support node style callbacks', async ({ cluster, env }) => {
        const res = await awaitCallback<void>((cb) =>
          cluster.waitUntilReady(READY_TIMEOUT_MS, cb)
        )
        assertReady(res, env.ctx({ op: 'waitUntilReady', extra: 'callback' }))
      })

      test('should wait until a new cluster is ready', async ({ env }) => {
        const cluster = await env.openCluster()
        const res = await cluster.waitUntilReady(
          NEW_CONNECTION_READY_TIMEOUT_MS
        )
        assertReady(
          res,
          env.ctx({ op: 'waitUntilReady', extra: 'new cluster' })
        )
      })

      test('should raise InvalidArgument for a non positive timeout', async ({
        cluster,
        env,
      }) => {
        await expectThrows(
          () => cluster.waitUntilReady(-1),
          InvalidArgumentError,
          undefined,
          env.ctx({ op: 'waitUntilReady', extra: 'timeout=-1' })
        )
      })

      test('should raise InvalidArgument for an Offline desired state', async ({
        cluster,
        env,
      }) => {
        await expectThrows(
          () =>
            cluster.waitUntilReady(READY_TIMEOUT_MS, {
              desiredState: ClusterState.Offline,
            }),
          InvalidArgumentError,
          undefined,
          env.ctx({ op: 'waitUntilReady', extra: 'Offline' })
        )
      })

      test('should raise InvalidArgument for an invalid service type', async ({
        cluster,
        env,
      }) => {
        await expectThrows(
          () =>
            cluster.waitUntilReady(READY_TIMEOUT_MS, {
              // @ts-expect-error an unknown service type is the point
              serviceTypes: ['test-service'],
            }),
          InvalidArgumentError,
          undefined,
          env.ctx({ op: 'waitUntilReady', extra: 'serviceTypes=test-service' })
        )
      })
    })
  }
)
