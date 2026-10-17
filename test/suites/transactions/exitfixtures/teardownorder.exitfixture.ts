// Terminates a worker for each teardown case, and reports whether the worker's
// transactions removed their client record. `teardownorder.test.ts` reads
// the outcome.
//
// The record is only removed when the transactions are closed while the
// cluster is still open, so a record left behind means the teardown closed
// the cluster first.

import { join } from 'path'
import { Worker } from 'worker_threads'

import {
  connect,
  Cluster,
  Collection,
  DocumentNotFoundError,
  LookupInSpec,
} from '../../../../lib/couchbase'
import { EXIT_CHILD_ENV, runExitFixture } from '../../../infra/exitchild'
import {
  KEYSPACE_ENV,
  TEARDOWN_CASES,
  type CaseOutcome,
  type TeardownCase,
  type TeardownOrderOutcome,
} from '../teardownorder.cases'

const WORKER = join(__dirname, '..', 'teardownorder.worker.cjs')

const CLIENT_RECORD = '_txn:client-record'

/**
 * How long a registration or a removal may take to show in the record. Both
 * are a cluster round trip; the registration is made by a cleanup thread
 * shortly after the transactions object is created.
 */
const SETTLE_MS = 10_000
const POLL_MS = 100

interface WorkerMessage {
  stage: 'committed' | 'ready' | 'error'
  collected?: boolean
  error?: { message: string; stack?: string }
}

function progress(fields: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify({ progress: true, ...fields })}\n`)
}

function env(name: string): string {
  const value = process.env[name]
  if (value === undefined) {
    throw new Error(`${name} is not set`)
  }
  return value
}

async function clientIds(coll: Collection): Promise<string[]> {
  try {
    const res = await coll.lookupIn(CLIENT_RECORD, [
      LookupInSpec.get('records.clients', { xattr: true }),
    ])
    const clients = res.content[0].value as Record<string, unknown> | undefined
    return Object.keys(clients ?? {})
  } catch (e) {
    if (e instanceof DocumentNotFoundError) {
      return []
    }
    throw e
  }
}

/** Polls the record until `done` holds for its ids, or the wait runs out. */
async function settle(
  coll: Collection,
  done: (ids: string[]) => boolean
): Promise<string[]> {
  const deadline = performance.now() + SETTLE_MS
  let ids = await clientIds(coll)
  while (!done(ids) && performance.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
    ids = await clientIds(coll)
  }
  return ids
}

function nextMessage(work: Worker): Promise<WorkerMessage> {
  return new Promise<WorkerMessage>((resolve, reject) => {
    const onExit = (code: number) =>
      reject(new Error(`worker exited with code ${code} before reporting`))
    work.once('message', (msg: WorkerMessage) => {
      work.off('error', reject)
      work.off('exit', onExit)
      resolve(msg)
    })
    work.once('error', reject)
    work.once('exit', onExit)
  })
}

async function expectStage(
  work: Worker,
  stage: WorkerMessage['stage']
): Promise<WorkerMessage> {
  const msg = await nextMessage(work)
  if (msg.stage !== stage) {
    await work.terminate()
    throw new Error(
      `worker reported ${msg.stage} rather than ${stage}: ` +
        `${msg.error?.stack ?? msg.error?.message ?? ''}`
    )
  }
  return msg
}

async function runCase(
  mode: TeardownCase,
  coll: Collection,
  keyspace: { bucket: string; scope: string; collection: string }
): Promise<CaseOutcome> {
  const before = new Set(await clientIds(coll))
  const work = new Worker(WORKER, {
    workerData: {
      connStr: env(EXIT_CHILD_ENV.connectionString),
      connOpts: {
        username: process.env[EXIT_CHILD_ENV.username],
        password: process.env[EXIT_CHILD_ENV.password],
      },
      keyspace,
      key: `teardownorder-${process.pid}-${mode}`,
      mode,
    },
  })

  await expectStage(work, 'committed')
  const registered = (
    await settle(coll, (ids) => ids.some((id) => !before.has(id)))
  ).filter((id) => !before.has(id))
  progress({ mode, stage: 'committed', registered })

  work.postMessage('go')
  const { collected } = await expectStage(work, 'ready')
  progress({ mode, stage: 'ready, terminating', collected })
  await work.terminate()

  const remaining = (
    await settle(coll, (ids) => registered.every((id) => !ids.includes(id)))
  ).filter((id) => registered.includes(id))
  progress({ mode, stage: 'terminated', remaining })
  return { registered, remaining, collected }
}

runExitFixture(async () => {
  const keyspace = {
    bucket: env(KEYSPACE_ENV.bucket),
    scope: env(KEYSPACE_ENV.scope),
    collection: env(KEYSPACE_ENV.collection),
  }
  // This cluster never creates transactions, so it adds no client of its own
  // to the record.
  const cluster: Cluster = await connect(env(EXIT_CHILD_ENV.connectionString), {
    username: process.env[EXIT_CHILD_ENV.username],
    password: process.env[EXIT_CHILD_ENV.password],
  })
  try {
    const coll = cluster
      .bucket(keyspace.bucket)
      .scope(keyspace.scope)
      .collection(keyspace.collection)
    const cases = {} as Record<TeardownCase, CaseOutcome>
    for (const mode of TEARDOWN_CASES) {
      cases[mode] = await runCase(mode, coll, keyspace)
    }
    const outcome: TeardownOrderOutcome = { cases }
    return { ...outcome }
  } finally {
    await cluster.close()
  }
})
