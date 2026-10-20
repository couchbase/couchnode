import { describe, expect } from 'vitest'

import { CollectionExistsError } from '../../../lib/errors'
import {
  EventingFunctionKeyspace,
  EventingFunctionManager,
  EventingFunctionStatus,
  IEventingFunction,
} from '../../../lib/eventingfunctionmanager'
import { EventingFunctionMgmtOp } from '../../../lib/observabilitytypes'
import { ServerFeature } from '../../infra/capabilities'
import { TestEnv } from '../../infra/env'
import {
  awaitEventingFunctionDropped,
  awaitEventingState,
  ensureEventingFunctionDropped,
} from '../../infra/eventing'
import type { CollectionLease } from '../../infra/leases/collection-lease'
import {
  awaitEventingKeyspaces,
  awaitKeyValueReady,
} from '../../infra/leases/readiness'
import { CollectionStrategy } from '../../infra/requirements'
import { defineSuite } from '../../infra/suite'
import {
  MODES,
  failingStep,
  step,
  targetFor,
} from '../../observability/tracing/mgmtwalk'
import { TRACER_KINDS } from '../../observability/tracing/target'

// The eventing function lifecycle walk. Nearly all of its time is spent
// waiting for the eventing service to reach a state, and few applications use
// the API, so it is `*.periodic.test.ts` (run by `make periodictest`) rather than
// on every nightly run. It declares no tier: the project is the gate, and a
// second gate would let a run that asks for eventing silently get nothing.
//
// `tracingmgmt.exclusive.test.ts` still asserts the `getAllFunctions` span on
// every merge, since a listing costs nothing.

const META_COLLECTION = 'meta'
const META_DEADLINE_MS = 60_000
const STATE_DEADLINE_MS = 90_000
/** Above the deadlines, so the poll's message is the one that is seen. */
const EVENTING_TIMEOUT_MS = 180_000
const STATE_RETRIES = 3
/** It only has to be valid. */
const HANDLER_CODE = `
      function OnUpdate(doc, meta) {
        log('data:', doc, meta)
      }
      `

interface EventingFixture {
  readonly source: EventingFunctionKeyspace
  readonly metadata: EventingFunctionKeyspace
}

/**
 * The leased scope's two collections, created once per suite over the env's
 * connection rather than the traced one, so provisioning records no spans.
 */
async function eventingFixture(
  env: TestEnv,
  lease: CollectionLease,
  signal: AbortSignal,
  cache: { value?: Promise<EventingFixture> }
): Promise<EventingFixture> {
  if (!cache.value) {
    cache.value = buildEventingFixture(env, lease, signal).catch((err) => {
      // A failed build must not be cached, or the next test would inherit the
      // rejection and be blamed for it.
      cache.value = undefined
      throw err
    })
  }
  return cache.value
}

async function buildEventingFixture(
  env: TestEnv,
  lease: CollectionLease,
  signal: AbortSignal
): Promise<EventingFixture> {
  const scope = env.cluster.bucket(lease.bucketName).scope(lease.scopeName)
  try {
    await env.cluster
      .bucket(lease.bucketName)
      .collections()
      .createCollection(META_COLLECTION, lease.scopeName)
  } catch (err) {
    // The leased scope is new, so an exists error can only be this create's
    // own retry answering.
    if (!(err instanceof CollectionExistsError)) {
      throw err
    }
  }
  await env.protocol.waitUntilCollectionPresent(
    lease.bucketName,
    lease.scopeName,
    META_COLLECTION,
    { deadlineMs: META_DEADLINE_MS, signal }
  )
  // The eventing service accepts a metadata keyspace only once key-value
  // serves it.
  await awaitKeyValueReady(
    scope.collection(META_COLLECTION),
    `collection ${META_COLLECTION} to answer key-value requests`,
    { deadlineMs: META_DEADLINE_MS, signal }
  )

  const keyspace = (collection: string): EventingFunctionKeyspace =>
    new EventingFunctionKeyspace({
      bucket: lease.bucketName,
      scope: lease.scopeName,
      collection,
    })

  const fixture: EventingFixture = {
    source: keyspace(lease.collectionName),
    metadata: keyspace(META_COLLECTION),
  }

  // The eventing service learns of both collections separately and later. The
  // walk's upsert is traced and cannot be polled without a span per attempt,
  // so the wait happens here, untraced.
  const eventing = env.cluster.eventingFunctions()
  const probe = env.key()
  env.registerCleanup(() =>
    ensureEventingFunctionDropped(eventing, probe, STATE_DEADLINE_MS)
  )
  await awaitEventingKeyspaces(
    eventing,
    definitionFor(probe, fixture),
    `the eventing service to accept collection ${META_COLLECTION}`,
    { deadlineMs: META_DEADLINE_MS, signal }
  )

  return fixture
}

/**
 * No bucket bindings: a binding with write access to the watched collection
 * makes the function self-recursive, and the eventing service then refuses a
 * second such function over the same keyspace (`ERR_INTER_FUNCTION_RECURSION`).
 * Both walks share the leased collection, so the second would fail whenever a
 * failed first left its function deployed.
 */
function definitionFor(
  name: string,
  fixture: EventingFixture
): IEventingFunction {
  return {
    name,
    code: HANDLER_CODE,
    metadataKeyspace: fixture.metadata,
    sourceKeyspace: fixture.source,
    bucketBindings: [],
    urlBindings: [],
    constantBindings: [],
  }
}

/**
 * Waits between transitions: a deploy returns long before the function is
 * deployed, and the next transition is refused until it is. Not asserted on.
 */
function awaitState(
  manager: EventingFunctionManager,
  name: string,
  state: EventingFunctionStatus,
  signal: AbortSignal
): Promise<void> {
  return awaitEventingState(manager, name, state, {
    deadlineMs: STATE_DEADLINE_MS,
    signal,
  })
}

for (const kind of TRACER_KINDS) {
  defineSuite(
    kind.suiteName,
    { collection: CollectionStrategy.Named },
    ({ group, test }) => {
      // One cache per suite: a shared one would outlive the lease its
      // keyspaces name.
      const eventingCache: { value?: Promise<EventingFixture> } = {}

      describe('#Management Operations', () => {
        group(
          '#Eventing Function Management Operations',
          [ServerFeature.Eventing],
          () => {
            for (const mode of MODES) {
              // The retry is for the transitions (a deploy that never takes
              // effect), not the assertions: each attempt uses a function of
              // its own, and a wrong span assertion fails every attempt.
              test(
                `should successfully perform eventing function lifecycle mgmt operations${mode.suffix}`,
                { retry: STATE_RETRIES, timeout: EVENTING_TIMEOUT_MS },
                async ({ collectionLease, env, signal }) => {
                  const target = await targetFor(env, kind)
                  const emgr = target.cluster.eventingFunctions()
                  const fixture = await eventingFixture(
                    env,
                    collectionLease,
                    signal,
                    eventingCache
                  )
                  const name = env.key()
                  const definition = definitionFor(name, fixture)

                  // Registered before the upsert, so a half-landed definition
                  // is removed. Dropping the leased scope does not drop a
                  // function that names it.
                  env.registerCleanup(() =>
                    ensureEventingFunctionDropped(emgr, name, STATE_DEADLINE_MS)
                  )

                  await step(
                    target,
                    mode,
                    EventingFunctionMgmtOp.EventingUpsertFunction,
                    (o) => emgr.upsertFunction(definition, o)
                  )

                  // A newly upserted function is undeployed once it has
                  // finished bootstrapping, and the eventing service refuses a
                  // deploy until then.
                  await awaitState(
                    emgr,
                    name,
                    EventingFunctionStatus.Undeployed,
                    signal
                  )

                  const fetched = await step(
                    target,
                    mode,
                    EventingFunctionMgmtOp.EventingGetFunction,
                    (o) => emgr.getFunction(name, o)
                  )
                  expect(fetched.name, 'fetched function name').toBe(name)

                  const listed = await step(
                    target,
                    mode,
                    EventingFunctionMgmtOp.EventingGetAllFunctions,
                    (o) => emgr.getAllFunctions(o)
                  )
                  expect(
                    listed.map((f) => f.name),
                    'the upserted function is listed'
                  ).toContain(name)

                  const statuses = await step(
                    target,
                    mode,
                    EventingFunctionMgmtOp.EventingGetStatus,
                    (o) => emgr.functionsStatus(o)
                  )
                  expect(
                    statuses.functions.map((f) => f.name),
                    'the upserted function has a status'
                  ).toContain(name)

                  await step(
                    target,
                    mode,
                    EventingFunctionMgmtOp.EventingDeployFunction,
                    (o) => emgr.deployFunction(name, o)
                  )
                  await awaitState(
                    emgr,
                    name,
                    EventingFunctionStatus.Deployed,
                    signal
                  )

                  await step(
                    target,
                    mode,
                    EventingFunctionMgmtOp.EventingPauseFunction,
                    (o) => emgr.pauseFunction(name, o)
                  )
                  await awaitState(
                    emgr,
                    name,
                    EventingFunctionStatus.Paused,
                    signal
                  )

                  await step(
                    target,
                    mode,
                    EventingFunctionMgmtOp.EventingResumeFunction,
                    (o) => emgr.resumeFunction(name, o)
                  )
                  await awaitState(
                    emgr,
                    name,
                    EventingFunctionStatus.Deployed,
                    signal
                  )

                  await step(
                    target,
                    mode,
                    EventingFunctionMgmtOp.EventingUndeployFunction,
                    (o) => emgr.undeployFunction(name, o)
                  )
                  await awaitState(
                    emgr,
                    name,
                    EventingFunctionStatus.Undeployed,
                    signal
                  )

                  await step(
                    target,
                    mode,
                    EventingFunctionMgmtOp.EventingDropFunction,
                    (o) => emgr.dropFunction(name, o)
                  )

                  // The drop returns before the service forgets the function,
                  // and until then the get below still finds it.
                  await awaitEventingFunctionDropped(emgr, name, {
                    deadlineMs: STATE_DEADLINE_MS,
                    signal,
                  })

                  await failingStep(
                    target,
                    mode,
                    EventingFunctionMgmtOp.EventingGetFunction,
                    (o) => emgr.getFunction(name, o),
                    env.ctx({ op: 'getFunction', extra: 'already dropped' })
                  )
                }
              )
            }
          }
        )
      })
    }
  )
}
