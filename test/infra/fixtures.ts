// Every resource a test uses is acquired by a fixture and released by its
// teardown, which runs on the failure path too. A test that takes no cluster
// fixture provably needs no cluster.
//
// `env` is file-scoped, so a file connects once. `requirements` is test-scoped,
// because `defineSuite` overrides it per describe block and Vitest refuses to
// redefine a file-scoped fixture inside one; what derives from it is test-scoped
// too, and cheap, because the env memoises the resources behind it.
//
// There is no `signal` fixture: Vitest's test context already carries one.
// Pass it to `pollUntil` so an abandoned wait stops with its test.

import { inject, test as base } from 'vitest'

import { Cluster } from '../../lib/cluster'
import { Collection } from '../../lib/collection'
import { DocBatch } from './data/loader'
import { TestEnv } from './env'
import { CollectionLease } from './leases/collection-lease'
import { DEFAULT_REQUIREMENTS, ResolvedRequirements } from './requirements'
import { RunStateReady } from './runstate'

export interface InfraFixtures {
  /** Overridden per describe block by `defineSuite`. */
  requirements: ResolvedRequirements
  runState: RunStateReady
  env: TestEnv
  /** The file's shared connection. */
  cluster: Cluster
  /**
   * The lease behind `collection`, for a suite that needs the names as well as
   * the handle, such as a query against `scopeName`.`collectionName`.
   */
  collectionLease: CollectionLease
  collection: Collection
  /** The suite's document batch. Only loaded if the suite declared `docs`. */
  docs: DocBatch
}

export const test = base.extend<InfraFixtures>({
  requirements: DEFAULT_REQUIREMENTS,

  runState: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const state = inject('runState')
      if (!state) {
        throw new Error(
          'No run state was provided. A test that takes a cluster fixture ran ' +
            'without globalSetup, so there is nothing to connect to. This is ' +
            'an environment failure, not a skip.'
        )
      }
      if (state.kind !== 'ready') {
        throw new Error(
          `A test took a cluster fixture but ${state.reason} ` +
            'Suites needing a cluster must declare it so they are skipped ' +
            'rather than failed here.'
        )
      }
      await use(state)
    },
    { scope: 'file' },
  ],

  env: [
    async ({ runState }, use) => {
      const env = await TestEnv.open({
        config: runState.config,
        capabilities: runState.capabilities,
        connection: runState.connection,
        runId: runState.runId,
        runLog: runState.runLog,
      })
      try {
        await use(env)
      } finally {
        await env.close()
      }
    },
    { scope: 'file' },
  ],

  cluster: async ({ env }, use) => {
    await use(env.cluster)
  },

  collectionLease: async ({ env, cluster, requirements, signal }, use) => {
    // Not released here: the env owns it, so it survives between the tests
    // that share it and is still released on the failure path.
    await use(await env.collectionLeaseFor(requirements, { cluster, signal }))
  },

  collection: async ({ collectionLease }, use) => {
    await use(collectionLease.collection)
  },

  docs: async ({ env, requirements, collection, signal }, use) => {
    await use(
      await env.docsFor(requirements, collection, {
        ...requirements.docs,
        signal,
      })
    )
  },
})
