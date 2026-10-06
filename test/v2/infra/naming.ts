// Scope and collection names are limited to 30 characters before server 7.6
// and to [A-Za-z0-9_%-], with no leading `_` or `%`. The 30 character limit is
// enforced on every version, so a name legal on 7.6 cannot fail provisioning
// on 7.0. Every generator here validates its output, so no lease re-checks.

import { createHash, randomBytes } from 'crypto'

export type ResourceKind = 'scope' | 'coll' | 'bucket'

export const MAX_RESOURCE_NAME = 30

/** The leading class excludes `_` and `%`, which the server reserves. */
const LEGAL_NAME = /^[A-Za-z0-9][A-Za-z0-9_%-]*$/

/** Returns `name` if the server will accept it, so the check can be inlined. */
export function assertLegalName(kind: ResourceKind, name: string): string {
  if (name.length > MAX_RESOURCE_NAME) {
    throw new Error(
      `${kind} name '${name}' is ${name.length} characters; the limit is ` +
        `${MAX_RESOURCE_NAME} on server versions before 7.6.`
    )
  }
  if (!LEGAL_NAME.test(name)) {
    throw new Error(
      `${kind} name '${name}' is not legal: names match ` +
        '[A-Za-z0-9][A-Za-z0-9_%-]*, because the server reserves a leading _ or %.'
    )
  }
  return name
}

const PREFIX: Readonly<Record<ResourceKind, string>> = {
  scope: 's_',
  coll: 'c_',
  bucket: 'b_',
}

/** The worker this process is, as Vitest labels it. `0` outside a worker. */
export function workerId(env = process.env): string {
  return env.VITEST_POOL_ID ?? '0'
}

/**
 * Deterministic per (kind, suite, worker), so two workers never collide and a
 * rerun in the same worker reuses the name. Used for buckets; scopes use
 * `newLeaseNames`.
 */
export function resourceName(
  kind: ResourceKind,
  suite: string,
  env = process.env
): string {
  const digest = createHash('sha1')
    .update(`${kind}:${suite}:${workerId(env)}`)
    .digest('hex')
    .slice(0, 8)
  return assertLegalName(kind, `${PREFIX[kind]}${digest}`)
}

/** A scope and the collection inside it, named for one lease. */
export interface LeaseNames {
  readonly scope: string
  readonly collection: string
}

/** Minutes, so the stamp stays short; nothing here needs finer than that. */
const STAMP_UNIT_MS = 60_000

const LEASE_SCOPE = /^s_([0-9a-z]+)_[0-9]+_[0-9a-f]{6}$/

/**
 * Never reused: a scope dropped and recreated under one name is listed before
 * every node has finished with the old one, so the first operation can fail
 * with an unknown scope. The name carries the minute (base 36) and the worker,
 * so a dead run's scope can be swept as stale (`leaseStampMs`); the random
 * part separates acquisitions in the same minute and worker.
 */
export function newLeaseNames(
  env = process.env,
  nowMs = Date.now()
): LeaseNames {
  const stamp = Math.floor(nowMs / STAMP_UNIT_MS).toString(36)
  const token = `${stamp}_${workerId(env)}_${randomBytes(3).toString('hex')}`
  return {
    scope: assertLegalName('scope', `s_${token}`),
    collection: assertLegalName('coll', `c_${token}`),
  }
}

/**
 * When a scope named by `newLeaseNames` was minted, to the minute, or null
 * for a scope it did not name. Null is what keeps a sweep off anything this
 * tree did not create.
 */
export function leaseStampMs(scopeName: string): number | null {
  const match = LEASE_SCOPE.exec(scopeName)
  return match ? parseInt(match[1], 36) * STAMP_UNIT_MS : null
}

/**
 * Unique per run, worker and file, which is how default collection suites are
 * isolated. The worker alone is not enough: `VITEST_POOL_ID` names a slot that
 * runs file after file, each restarting its key counter. `fileToken` separates
 * them; the worker stays so a key on a failure says which slot wrote it.
 */
export function keyPrefix(
  runId: string,
  fileToken: string,
  env = process.env
): string {
  return `${runId}_${workerId(env)}_${fileToken}`
}

export function newFileToken(): string {
  return randomBytes(3).toString('hex')
}

/** Stamped once in globalSetup and shared by every worker. */
export function newRunId(): string {
  return createHash('sha1')
    .update(`${process.pid}:${Date.now()}:${Math.random()}`)
    .digest('hex')
    .slice(0, 8)
}
