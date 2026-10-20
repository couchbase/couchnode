// Waiting until a document has reached every replica.
//
// An acknowledged write says nothing about the replicas, and an early replica
// read fails quietly: `getAllReplicas` returns only the copies that answered,
// and `lookupInAllReplicas` returns an error on every field. So this polls on
// the `getAllReplicas` count.
//
// A replica vbucket can also go on refusing a new collection for seconds after
// the actives serve it; the core retries until the read times out, so a
// timeout here means "not yet".

import type { Collection } from '../../lib/collection'
import { TimeoutError } from '../../lib/errors'
import { TestEnv } from './env'
import { pollUntil } from './retry'

const REPLICATION_DEADLINE_MS = 20_000
const REPLICATION_INTERVAL_MS = 100

const replicaCounts = new Map<string, Promise<number>>()

/** The bucket's configured replica count, read once per bucket per file. */
export function numReplicasOf(
  env: TestEnv,
  bucketName: string
): Promise<number> {
  const existing = replicaCounts.get(bucketName)
  if (existing) {
    return existing
  }
  const pending = env.cluster
    .buckets()
    .getBucket(bucketName)
    .then((settings) => {
      if (settings.numReplicas === undefined) {
        throw new Error(`bucket ${bucketName} reports no replica count`)
      }
      return settings.numReplicas
    })
    .catch((err: unknown) => {
      // Evicted, so the next file asks again rather than inheriting a failure.
      replicaCounts.delete(bucketName)
      throw err
    })
  replicaCounts.set(bucketName, pending)
  return pending
}

/** The bucket's replica count, capped at the number of KV nodes minus one. */
export async function availableReplicasOf(
  env: TestEnv,
  bucketName: string
): Promise<number> {
  const configured = await numReplicasOf(env, bucketName)
  const kvNodes = Object.values(env.consistency.nodeServices).filter(
    (services) => services.includes('kv')
  ).length
  // A mock backend has no node list.
  return kvNodes === 0 ? configured : Math.min(configured, kvNodes - 1)
}

/**
 * Skips the test when no replica copy can exist. For reads of a specific
 * replica, which have no active copy to fall back on.
 */
export async function skipWithoutReplicas(
  env: TestEnv,
  bucketName: string,
  skip: (condition: boolean, note?: string) => void
): Promise<void> {
  const replicas = await availableReplicasOf(env, bucketName)
  skip(replicas === 0, `bucket ${bucketName} has no replica copies`)
}

export interface ReplicationWaitOptions {
  readonly signal?: AbortSignal
  readonly deadlineMs?: number
}

/**
 * Resolves once `getAllReplicas` reports every copy of `key`. A no-op on a
 * bucket with no replicas.
 */
export async function waitUntilReplicated(
  env: TestEnv,
  collection: Collection,
  bucketName: string,
  key: string,
  opts: ReplicationWaitOptions = {}
): Promise<void> {
  const replicas = await availableReplicasOf(env, bucketName)
  if (replicas === 0) {
    return
  }
  const wanted = replicas + 1

  await pollUntil(
    `all ${wanted} copies of '${key}' to be readable`,
    async (ctx) => {
      let copies
      try {
        copies = await collection.getAllReplicas(key)
      } catch (err) {
        if (!(err instanceof TimeoutError)) {
          throw err
        }
        ctx.note(`a copy did not answer in time: ${err.message}`)
        return undefined
      }
      ctx.note(`${copies.length} of ${wanted} copies answered`)
      return copies.length >= wanted ? true : undefined
    },
    {
      deadlineMs: opts.deadlineMs ?? REPLICATION_DEADLINE_MS,
      intervalMs: REPLICATION_INTERVAL_MS,
      signal: opts.signal,
    }
  )
}
