import { describe, expect } from 'vitest'

import type { Cluster } from '../../../../lib/cluster'
import { EventingFunctionNotDeployedError } from '../../../../lib/errors'
import type {
  EventingFunctionManager,
  IEventingFunction,
} from '../../../../lib/eventingfunctionmanager'
import {
  EventingFunctionBucketAccess,
  EventingFunctionBucketBinding,
  EventingFunctionKeyspace,
  EventingFunctionStatus,
  EventingFunctionUrlAuthBasic,
  EventingFunctionUrlBinding,
} from '../../../../lib/eventingfunctionmanager'
import type { ScopeEventingFunctionManager } from '../../../../lib/scopeeventingfunctionmanager'
import { AssertCtx, withCtx } from '../../asserts/ctx'
import { ServerFeature } from '../../infra/capabilities'
import { TestEnv } from '../../infra/env'
import {
  awaitEventingState,
  ensureEventingFunctionDropped,
} from '../../infra/eventing'
import { DocBatch } from '../../infra/data/loader'
import { CollectionLease } from '../../infra/leases/collection-lease'
import {
  awaitEventingKeyspaces,
  awaitKeyValueReady,
} from '../../infra/leases/readiness'
import { CollectionStrategy } from '../../infra/requirements'
import { pollUntil } from '../../infra/retry'
import { defineSuite } from '../../infra/suite'

// The same tests run against the cluster's manager and a scope's, emitted from
// one function with the manager passed in.
//
// The lease provides the source collection; the metadata collection is created
// in the leased scope and goes with it.
//
// The bucket binding names a real collection. A keyspace without one does not
// fail: the binding silently covers the server's default instead.
//
// `getAllFunctions` can come back empty right after an upsert, and a function
// missing from the status listing means "not yet", hence the polls.
//
// `*.periodic.test.ts` keeps this expensive suite out of ordinary runs. It
// declares no tier: a second gate would make `make v2periodic` silently run
// nothing.

const META_COLLECTION = 'meta'

const STATE_DEADLINE_MS = 90_000
/** Above the poll deadline, so the poll's message is seen. */
const STATE_TIMEOUT_MS = 120_000
const LISTING_DEADLINE_MS = 15_000

const STATE_RETRIES = 3

const BOOTSTRAP_DEADLINE_MS = 15_000
const SETUP_TIMEOUT_MS = 60_000

const META_DEADLINE_MS = 60_000

const STATE_POLL_INTERVAL_MS = 500

/** It only has to be valid. */
const HANDLER_CODE = `
      function OnUpdate(doc, meta) {
        log('data:', doc, meta)
      }
      `

/** The two manager classes share no base; this is the part the tests use. */
type Manager = Pick<
  EventingFunctionManager | ScopeEventingFunctionManager,
  | 'upsertFunction'
  | 'dropFunction'
  | 'getAllFunctions'
  | 'functionsStatus'
  | 'deployFunction'
  | 'pauseFunction'
  | 'resumeFunction'
  | 'undeployFunction'
>

async function ensureDropped(manager: Manager, name: string): Promise<void> {
  try {
    await ensureEventingFunctionDropped(manager, name, STATE_DEADLINE_MS)
  } catch (err) {
    // Some servers answer a drop of a function already dropped this way, so
    // the listing decides whether it is gone.
    if (!(err instanceof EventingFunctionNotDeployedError)) {
      throw err
    }
    await pollUntil<true>(
      `eventing function ${name} to leave getAllFunctions`,
      async (ctx) => {
        const listed = (await manager.getAllFunctions()).map((f) => f.name)
        if (!listed.includes(name)) {
          return true
        }
        ctx.note('the function is still listed')
        return undefined
      },
      { deadlineMs: LISTING_DEADLINE_MS, intervalMs: STATE_POLL_INTERVAL_MS }
    )
  }
}

interface Fixture {
  readonly source: EventingFunctionKeyspace
  readonly metadata: EventingFunctionKeyspace
  readonly docs: DocBatch
}

/**
 * The leased scope's two collections, with documents in the source. Memoized
 * per suite on first use, since a lease does not provide the metadata
 * collection.
 */
async function fixtureFor(
  env: TestEnv,
  lease: CollectionLease,
  signal: AbortSignal,
  cache: { value?: Promise<Fixture> }
): Promise<Fixture> {
  if (!cache.value) {
    cache.value = build(env, lease, signal).catch((err) => {
      // Not cached on failure, or the next test inherits the rejection.
      cache.value = undefined
      throw err
    })
  }
  return cache.value
}

async function build(
  env: TestEnv,
  lease: CollectionLease,
  signal: AbortSignal
): Promise<Fixture> {
  const manager = env.cluster.bucket(lease.bucketName).collections()
  await manager.createCollection(META_COLLECTION, lease.scopeName)
  await env.protocol.waitUntilCollectionPresent(
    lease.bucketName,
    lease.scopeName,
    META_COLLECTION,
    { deadlineMs: META_DEADLINE_MS, signal }
  )
  // The eventing service refuses a metadata keyspace that key-value does not
  // yet serve.
  await awaitKeyValueReady(
    env.cluster
      .bucket(lease.bucketName)
      .scope(lease.scopeName)
      .collection(META_COLLECTION),
    `collection ${META_COLLECTION} to answer key-value requests`,
    { deadlineMs: META_DEADLINE_MS, signal }
  )

  const source = new EventingFunctionKeyspace({
    bucket: lease.bucketName,
    scope: lease.scopeName,
    collection: lease.collectionName,
  })
  const metadata = new EventingFunctionKeyspace({
    bucket: lease.bucketName,
    scope: lease.scopeName,
    collection: META_COLLECTION,
  })

  // The eventing service learns of both collections separately and later;
  // without this the first upsert races it.
  const eventing = env.cluster.eventingFunctions()
  const probe = env.key()
  env.registerCleanup(() => ensureDropped(eventing, probe))
  await awaitEventingKeyspaces(
    eventing,
    {
      name: probe,
      code: HANDLER_CODE,
      metadataKeyspace: metadata,
      sourceKeyspace: source,
    },
    `the eventing service to accept collection ${META_COLLECTION}`,
    { deadlineMs: META_DEADLINE_MS, signal }
  )

  // Not purged: the documents go with the leased scope.
  const docs = await DocBatch.load(lease.collection, { uid: env.key(), signal })

  return { source, metadata, docs }
}

/** A definition naming the leased keyspaces, plus the bindings under test. */
function definitionFor(
  name: string,
  fixture: Fixture,
  withBindings: boolean
): IEventingFunction {
  return {
    name,
    code: HANDLER_CODE,
    metadataKeyspace: fixture.metadata,
    sourceKeyspace: fixture.source,
    bucketBindings: [
      new EventingFunctionBucketBinding({
        name: fixture.source,
        alias: 'bucketbinding1',
        access: EventingFunctionBucketAccess.ReadWrite,
      }),
    ],
    urlBindings: withBindings
      ? [
          new EventingFunctionUrlBinding({
            hostname: 'http://127.0.0.1',
            alias: 'urlbinding1',
            auth: new EventingFunctionUrlAuthBasic({
              username: 'username',
              password: 'password',
            }),
            allowCookies: false,
            validateSslCertificate: false,
          }),
        ]
      : [],
    // The server compiles `const <alias> = <literal>;`, so a string literal
    // carries its own quotes.
    constantBindings: withBindings
      ? [{ alias: 'someconstant', literal: '"someliteral"' }]
      : [],
  }
}

async function awaitListed(
  what: string,
  names: () => Promise<readonly string[]>,
  name: string,
  signal: AbortSignal
): Promise<readonly string[]> {
  return pollUntil<readonly string[]>(
    `eventing function ${name} to appear in ${what}`,
    async (ctx) => {
      const listed = await names()
      if (listed.includes(name)) {
        return listed
      }
      ctx.note(
        listed.length ? `saw ${listed.join(', ')}` : 'the listing is empty'
      )
      return undefined
    },
    {
      deadlineMs: LISTING_DEADLINE_MS,
      intervalMs: STATE_POLL_INTERVAL_MS,
      signal,
    }
  )
}

function awaitState(
  manager: Manager,
  name: string,
  state: EventingFunctionStatus,
  signal: AbortSignal
): Promise<void> {
  return awaitEventingState(manager, name, state, {
    deadlineMs: STATE_DEADLINE_MS,
    signal,
  })
}

/**
 * `managerFor` takes the cluster rather than being a manager, because a manager
 * is reached through a connection and the connection is a fixture.
 */
function eventingTests(
  suiteName: string,
  features: readonly ServerFeature[],
  managerFor: (cluster: Cluster, lease: CollectionLease) => Manager
): void {
  defineSuite(
    suiteName,
    {
      collection: CollectionStrategy.Named,
      features: [
        ServerFeature.Collections,
        ServerFeature.Eventing,
        ...features,
      ],
    },
    ({ test }) => {
      // One cache per emitted block, so the two blocks build their own scope.
      const cache: { value?: Promise<Fixture> } = {}
      let functionName: string | undefined
      let innerFunctionName: string | undefined

      function nameFor(env: TestEnv): string {
        functionName = functionName ?? env.key()
        return functionName
      }

      function ctxFor(name: string, op: string): AssertCtx {
        return { op, extra: `function=${name}` }
      }

      test(
        'should upsert successfully',
        async ({ cluster, collectionLease, env, signal }) => {
          const fixture = await fixtureFor(env, collectionLease, signal, cache)
          const name = nameFor(env)
          const manager = managerFor(cluster, collectionLease)

          // Registered before the upsert, so a half-landed definition is
          // removed. Dropping the scope does not drop a function.
          env.registerCleanup(() => ensureDropped(manager, name))

          await manager.upsertFunction(definitionFor(name, fixture, true))
        },
        SETUP_TIMEOUT_MS
      )

      // Acquiring the lease can take half a minute, so each test needs more
      // than the default budget or the runner kills it before the wait reports.
      test(
        'should find the upserted function',
        { timeout: SETUP_TIMEOUT_MS },
        async ({ cluster, collectionLease, env, signal }) => {
          const name = nameFor(env)
          const c = env.ctx(ctxFor(name, 'getAllFunctions'))
          const manager = managerFor(cluster, collectionLease)
          const listed = await awaitListed(
            'getAllFunctions',
            async () => (await manager.getAllFunctions()).map((f) => f.name),
            name,
            signal
          )
          expect(
            listed,
            withCtx('the upserted function is listed', c)
          ).toContain(name)
        }
      )

      test(
        'should get function statuses',
        { timeout: SETUP_TIMEOUT_MS },
        async ({ cluster, collectionLease, env, signal }) => {
          const name = nameFor(env)
          const c = env.ctx(ctxFor(name, 'functionsStatus'))
          const manager = managerFor(cluster, collectionLease)
          const listed = await awaitListed(
            'functionsStatus',
            async () =>
              (await manager.functionsStatus()).functions.map((f) => f.name),
            name,
            signal
          )
          expect(
            listed,
            withCtx('the upserted function has a status', c)
          ).toContain(name)
        }
      )

      test(
        'should successfully wait for bootstrap',
        async ({ cluster, collectionLease, env, signal }) => {
          // A new function reaches undeployed once it finishes bootstrapping.
          await awaitEventingState(
            managerFor(cluster, collectionLease),
            nameFor(env),
            EventingFunctionStatus.Undeployed,
            { deadlineMs: BOOTSTRAP_DEADLINE_MS, signal }
          )
        },
        SETUP_TIMEOUT_MS
      )

      describe('#deploy-pause-resume-undeploy', () => {
        /** Shared by these tests, started by the first to run. */
        let innerUpserted: Promise<void> | undefined

        function innerNameFor(env: TestEnv): string {
          innerFunctionName = innerFunctionName ?? env.key()
          return innerFunctionName
        }

        /**
         * No url or constant bindings: those are the upsert test's subject,
         * and a deployed function should not depend on a host that does not
         * answer.
         */
        async function deployable(
          cluster: Cluster,
          lease: CollectionLease,
          env: TestEnv,
          signal: AbortSignal
        ): Promise<{ manager: Manager; name: string }> {
          const manager = managerFor(cluster, lease)
          const name = innerNameFor(env)
          if (!innerUpserted) {
            innerUpserted = (async () => {
              const fixture = await fixtureFor(env, lease, signal, cache)
              env.registerCleanup(() => ensureDropped(manager, name))
              await manager.upsertFunction(definitionFor(name, fixture, false))
            })().catch((err) => {
              innerUpserted = undefined
              throw err
            })
          }
          await innerUpserted
          return { manager, name }
        }

        test(
          'should successfully deploy the function',
          { retry: STATE_RETRIES, timeout: STATE_TIMEOUT_MS },
          async ({ cluster, collectionLease, env, signal }) => {
            const { manager, name } = await deployable(
              cluster,
              collectionLease,
              env,
              signal
            )
            await manager.deployFunction(name)
            await awaitState(
              manager,
              name,
              EventingFunctionStatus.Deployed,
              signal
            )
          }
        )

        test(
          'should successfully pause the function',
          { retry: STATE_RETRIES, timeout: STATE_TIMEOUT_MS },
          async ({ cluster, collectionLease, env, signal }) => {
            const { manager, name } = await deployable(
              cluster,
              collectionLease,
              env,
              signal
            )
            await manager.pauseFunction(name)
            await awaitState(
              manager,
              name,
              EventingFunctionStatus.Paused,
              signal
            )
          }
        )

        test(
          'should successfully resume the function',
          { retry: STATE_RETRIES, timeout: STATE_TIMEOUT_MS },
          async ({ cluster, collectionLease, env, signal }) => {
            const { manager, name } = await deployable(
              cluster,
              collectionLease,
              env,
              signal
            )
            await manager.resumeFunction(name)
            await awaitState(
              manager,
              name,
              EventingFunctionStatus.Deployed,
              signal
            )
          }
        )

        test(
          'should successfully undeploy the function',
          { retry: STATE_RETRIES, timeout: STATE_TIMEOUT_MS },
          async ({ cluster, collectionLease, env, signal }) => {
            const { manager, name } = await deployable(
              cluster,
              collectionLease,
              env,
              signal
            )
            await manager.undeployFunction(name)
            await awaitState(
              manager,
              name,
              EventingFunctionStatus.Undeployed,
              signal
            )
          }
        )
      })

      test(
        'should successfully drop the function',
        async ({ cluster, collectionLease, env }) => {
          await managerFor(cluster, collectionLease).dropFunction(nameFor(env))
        },
        SETUP_TIMEOUT_MS
      )
    }
  )
}

eventingTests('#eventing', [], (cluster) => cluster.eventingFunctions())

eventingTests(
  '#scopeeventing',
  [ServerFeature.ScopeEventingFunctionManagement],
  (cluster, lease) =>
    cluster.bucket(lease.bucketName).scope(lease.scopeName).eventingFunctions()
)
