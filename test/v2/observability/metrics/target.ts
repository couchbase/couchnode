// Every metrics suite runs twice, once against a recording meter and once
// against a no-op one, and each needs its own connection carrying that meter.
//
// Nothing here calls `Cluster.connect`. The connection comes from
// `env.sharedCluster`, which the env owns and closes on failure, and is
// memoized per meter kind so a file connects twice rather than once per test.

import type { Cluster } from '../../../../lib/cluster'
import type { Collection } from '../../../../lib/collection'
import { TestEnv } from '../../infra/env'
import type { CollectionLease } from '../../infra/leases/collection-lease'
import { AnyTestMeter, NoOpTestMeter, TestMeter } from './metertypes'
import type { ClusterName } from '../tracing/validators'

export interface MeterKind {
  readonly suiteName: string
  /** Distinguishes this kind's connection and meter within one file. */
  readonly key: string
  readonly create: () => AnyTestMeter
}

export const BASIC_METRICS: MeterKind = {
  suiteName: '#basic metrics',
  key: 'metrics:basic',
  create: () => new TestMeter(),
}

export const NO_OP_METRICS: MeterKind = {
  suiteName: '#no-op metrics',
  key: 'metrics:no-op',
  create: () => new NoOpTestMeter(),
}

export const METER_KINDS: readonly MeterKind[] = [BASIC_METRICS, NO_OP_METRICS]

export interface MeteredTarget {
  readonly meter: AnyTestMeter
  /** Every operation under test runs on this connection. */
  readonly cluster: Cluster
  readonly clusterName: ClusterName
}

const metersByEnv = new WeakMap<TestEnv, Map<string, AnyTestMeter>>()

/**
 * Synchronous on purpose: the connection is memoized behind a promise, and two
 * async memos over the same thing can disagree; a meter created without
 * awaiting anything cannot.
 */
function meterFor(env: TestEnv, kind: MeterKind): AnyTestMeter {
  let byKind = metersByEnv.get(env)
  if (!byKind) {
    byKind = new Map()
    metersByEnv.set(env, byKind)
  }
  const existing = byKind.get(kind.key)
  if (existing) {
    return existing
  }
  const meter = kind.create()
  byKind.set(kind.key, meter)
  return meter
}

export async function meteredTarget(
  env: TestEnv,
  kind: MeterKind
): Promise<MeteredTarget> {
  const meter = meterFor(env, kind)
  const cluster = await env.sharedCluster(kind.key, {
    metricsConfig: { enableMetrics: true },
    meter,
  })
  return { meter, cluster, clusterName: await env.clusterName() }
}

/**
 * The leased collection, re-addressed over the metered connection. The lease's
 * own handle is on the env's connection, so data operations through it would
 * not reach the meter.
 */
export function meteredCollection(
  target: MeteredTarget,
  lease: CollectionLease
): Collection {
  return target.cluster
    .bucket(lease.bucketName)
    .scope(lease.scopeName)
    .collection(lease.collectionName)
}
