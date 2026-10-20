// Every tracing suite runs three times, against a recording tracer, a no-op
// one, and the shipped threshold tracer, and each needs its own connection
// carrying that tracer.
//
// Nothing here calls `Cluster.connect`. The connection comes from
// `env.sharedCluster`, which the env owns and closes on failure, and is
// memoized per tracer kind so a file connects three times rather than once per
// test.

import type { Cluster } from '../../../lib/cluster'
import type { Collection } from '../../../lib/collection'
import { isClassic } from '../../infra/capabilities'
import { TestEnv } from '../../infra/env'
import type { CollectionLease } from '../../infra/leases/collection-lease'
import {
  AnyTestTracer,
  NoOpTestTracer,
  TestTracer,
  ThresholdLoggingTestTracer,
} from './tracingtypes'
import type { ClusterName } from './validators'

export interface TracerKind {
  readonly suiteName: string
  /** Distinguishes this kind's connection and tracer within one file. */
  readonly key: string
  readonly create: () => AnyTestTracer
}

export const BASIC_TRACING: TracerKind = {
  suiteName: '#basic tracing',
  key: 'tracing:basic',
  create: () => new TestTracer(),
}

export const NO_OP_TRACING: TracerKind = {
  suiteName: '#no-op tracing',
  key: 'tracing:no-op',
  create: () => new NoOpTestTracer(),
}

export const THRESHOLD_TRACING: TracerKind = {
  suiteName: '#threshold tracing',
  key: 'tracing:threshold',
  create: () => new ThresholdLoggingTestTracer(),
}

export const TRACER_KINDS: readonly TracerKind[] = [
  BASIC_TRACING,
  NO_OP_TRACING,
  THRESHOLD_TRACING,
]

export interface TracedTarget {
  readonly tracer: AnyTestTracer
  /** Every operation under test runs on this connection. */
  readonly cluster: Cluster
  readonly clusterName: ClusterName
  readonly mockBackend: boolean
}

const tracersByEnv = new WeakMap<TestEnv, Map<string, AnyTestTracer>>()

/**
 * Synchronous on purpose: the connection is memoized behind a promise, and two
 * async memos over the same thing can disagree; a tracer created without
 * awaiting anything cannot.
 */
function tracerFor(env: TestEnv, kind: TracerKind): AnyTestTracer {
  let byKind = tracersByEnv.get(env)
  if (!byKind) {
    byKind = new Map()
    tracersByEnv.set(env, byKind)
  }
  const existing = byKind.get(kind.key)
  if (existing) {
    return existing
  }
  const tracer = kind.create()
  byKind.set(kind.key, tracer)
  return tracer
}

export async function tracedTarget(
  env: TestEnv,
  kind: TracerKind
): Promise<TracedTarget> {
  const tracer = tracerFor(env, kind)
  const cluster = await env.sharedCluster(kind.key, {
    tracingConfig: { enableTracing: true },
    tracer,
  })
  return {
    tracer,
    cluster,
    clusterName: await env.clusterName(),
    mockBackend:
      isClassic(env.capabilities) && env.capabilities.backend !== 'none',
  }
}

/**
 * The leased collection, re-addressed over the traced connection. The lease's
 * own handle is on the env's connection, so data operations through it would
 * not reach the tracer.
 */
export function tracedCollection(
  target: TracedTarget,
  lease: CollectionLease
): Collection {
  return target.cluster
    .bucket(lease.bucketName)
    .scope(lease.scopeName)
    .collection(lease.collectionName)
}
