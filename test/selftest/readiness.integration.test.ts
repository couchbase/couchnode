// Does the probe fan really spread? Only a server can say.
//
// `readiness.test.ts` pins the spread against this tree's own routing hash,
// which cannot catch a wrong algorithm. A mutation token carries the
// `partition_id` the write landed in, so upserting each probe key asks the
// server directly. A fan narrower than it should be reports readiness it never
// established, and nothing else would show it.

import { expect } from 'vitest'

import type { CppMutationToken } from '../../lib/binding'
import type { MutationToken } from '../../lib/mutationstate'
import { ServerFeature } from '../infra/capabilities'
import { PROBE_KEYS, PROBE_KEY_COUNT } from '../infra/leases/readiness'
import { CollectionStrategy } from '../infra/requirements'
import { defineSuite } from '../infra/suite'

/** The vbucket the server says it used. `MutationState` reads the same field. */
function partitionOf(token: MutationToken | undefined): number {
  expect(token).toBeDefined()
  return parseInt((token as CppMutationToken).toJSON().partition_id, 10)
}

defineSuite(
  'infra: key-value readiness',
  {
    collection: CollectionStrategy.Named,
    features: [ServerFeature.Collections, ServerFeature.KeyValue],
  },
  ({ test }) => {
    test('fans out across the vbuckets the server actually uses', async ({
      collection,
    }) => {
      // Writing is the only way to ask; each is removed again for tidiness.
      const partitions: number[] = []
      for (const key of PROBE_KEYS) {
        const result = await collection.upsert(key, { probe: true })
        partitions.push(partitionOf(result.token))
        await collection.remove(key)
      }

      expect(partitions).toHaveLength(PROBE_KEY_COUNT)

      // 1024 vbuckets on a Linux server build and 64 on a macOS one, the only
      // two counts a server ships, so the highest partition seen tells them
      // apart.
      const numVbuckets = Math.max(...partitions) < 64 ? 64 : 1024

      // A threshold; the unit test owns the exact figures.
      expect(new Set(partitions).size).toBeGreaterThanOrEqual(40)

      // A spread, not a band: every thirty-second of the space is hit.
      const width = numVbuckets / 32
      expect(new Set(partitions.map((p) => Math.floor(p / width))).size).toBe(
        32
      )
    })
  }
)
