// The fan reaches the whole keyspace, and the wait holds until all of it does.
//
// Checked without a cluster: the fixed probe key set spreads over every node's
// vbuckets, and a single refusal keeps the wait open, so a lease is never
// returned while one node is still short of the manifest. Whether this is the
// hash the server routes on is checked against a server in
// `readiness.integration.test.ts`.

import { crc32 } from 'zlib'

import { describe, expect, it } from 'vitest'

import type { Collection } from '../../lib/collection'
import { DocumentNotFoundError, ScopeNotFoundError } from '../../lib/errors'
import {
  PROBE_KEYS,
  PROBE_KEY_COUNT,
  PROBE_KEY_PREFIX,
  awaitKeyValueReady,
} from '../infra/leases/readiness'

const DEADLINE_MS = 500

/**
 * Where the server would route a key, per `core/utils/crc32.hxx` and
 * `configuration::map_key`: CRC-32/ISO-HDLC, the low fifteen bits of the high
 * half, then the vbucket count. `zlib.crc32` already applies the final
 * complement that the core's `~crc` is.
 *
 * `>>>` rather than `>>` is the one real trap: a checksum above 2^31 would be
 * coerced negative by a signed shift, so a hash written the other way works
 * for roughly half of all keys.
 */
function vbucketForKey(key: string, numVbuckets: number): number {
  return ((crc32(key) >>> 16) & 0x7fff) % numVbuckets
}

/** Both counts a real server uses: Linux builds have 1024, macOS ones 64. */
const COUNTS = [1024, 64]

describe('the probe key set', () => {
  it('is a fixed enumeration of the declared width', () => {
    expect(PROBE_KEYS).toHaveLength(PROBE_KEY_COUNT)
    expect(new Set(PROBE_KEYS).size).toBe(PROBE_KEY_COUNT)
    for (const key of PROBE_KEYS) {
      expect(key.startsWith(PROBE_KEY_PREFIX)).toBe(true)
    }
  })

  it('spreads over the vbucket space at either count', () => {
    // Computed from the real hash, and exact on the low side so that narrowing
    // the fan fails here rather than in a lease. Sequential suffixes under a
    // linear checksum collide a little, which is why 128 keys reach 118
    // vbuckets rather than 128.
    const reached = COUNTS.map(
      (numVbuckets) =>
        new Set(PROBE_KEYS.map((key) => vbucketForKey(key, numVbuckets))).size
    )
    expect(reached).toEqual([118, 48])
  })

  it('lands in every partition of the space, however it is carved up', () => {
    // The claim the whole design rests on, stated without needing a real map:
    // a node owns some subset of the vbuckets, and the two shapes a subset
    // takes are a contiguous range and a stride. If every partition of either
    // shape holds a probe key, then no cluster of that many nodes has a node
    // the fan misses, whichever way the server laid the map out.
    for (const numVbuckets of COUNTS) {
      const vbuckets = PROBE_KEYS.map((key) => vbucketForKey(key, numVbuckets))
      for (const nodes of [1, 2, 4, 8, 16, 32]) {
        const width = numVbuckets / nodes
        const ranges = new Set(vbuckets.map((v) => Math.floor(v / width)))
        const strides = new Set(vbuckets.map((v) => v % nodes))
        expect(
          ranges.size,
          `${nodes} contiguous, ${numVbuckets} vbuckets`
        ).toBe(nodes)
        expect(strides.size, `${nodes} striped, ${numVbuckets} vbuckets`).toBe(
          nodes
        )
      }
    }
  })

  it('answers the same keys every time it is asked', () => {
    // What makes a poll's later attempts re-ask the same question rather than
    // a new key each time.
    expect([...PROBE_KEYS]).toEqual([...PROBE_KEYS])
  })
})

interface Stub {
  readonly collection: Collection
  /** Every key asked for, in order, so a re-probe is visible. */
  readonly gets: string[]
}

/**
 * A key-value stub that decides per key.
 *
 * `serves` is asked once per `get`, with the key and the number of times that
 * key has been asked before, so a test can make one key come good late or
 * flap back.
 */
function stubCollection(serves: (key: string, asked: number) => boolean): Stub {
  const gets: string[] = []
  const seen = new Map<string, number>()

  const collection = {
    get: async (key: string) => {
      gets.push(key)
      const asked = seen.get(key) ?? 0
      seen.set(key, asked + 1)
      if (!serves(key, asked)) {
        throw new ScopeNotFoundError()
      }
      // What a real answer looks like: the collection is there and the key is
      // not, which is the whole of what the probe is asking.
      throw new DocumentNotFoundError()
    },
  } as unknown as Collection

  return { collection, gets }
}

describe('key-value readiness', () => {
  it('returns on one clean pass, having asked the whole fan', async () => {
    const { collection, gets } = stubCollection(() => true)

    await expect(
      awaitKeyValueReady(collection, 'the collection', {
        deadlineMs: DEADLINE_MS,
      })
    ).resolves.toBeUndefined()

    expect(gets).toHaveLength(PROBE_KEY_COUNT)
    expect(new Set(gets)).toEqual(new Set(PROBE_KEYS))
  })

  it('counts a document that happens to exist as an answer', async () => {
    // Nothing writes these keys, but a previous run that died mid-probe could
    // have left one behind, and a value coming back is a stronger answer than
    // a miss: key-value found the collection and read from it.
    const collection = {
      get: async () => ({ content: { left: 'over' }, cas: '1' }),
    } as unknown as Collection

    await expect(
      awaitKeyValueReady(collection, 'the collection', {
        deadlineMs: DEADLINE_MS,
      })
    ).resolves.toBeUndefined()
  })

  it('waits on a single refusal, and says how far along it is', async () => {
    // 127 of 128 probes answering is not ready: it is one node short of the
    // manifest.
    const holdout = PROBE_KEYS[7]
    const { collection } = stubCollection((key) => key !== holdout)

    await expect(
      awaitKeyValueReady(collection, 'the collection', {
        deadlineMs: DEADLINE_MS,
      })
    ).rejects.toThrow(
      new RegExp(`${PROBE_KEY_COUNT - 1} of ${PROBE_KEY_COUNT} probes answered`)
    )
  })

  it('quotes what key-value actually said', async () => {
    const { collection } = stubCollection((key) => key !== PROBE_KEYS[0])

    await expect(
      awaitKeyValueReady(collection, 'the collection', {
        deadlineMs: DEADLINE_MS,
      })
    ).rejects.toThrow(/1 said scope not found/)
  })

  it('keeps asking the keys that refused', async () => {
    const { collection, gets } = stubCollection((key) => key !== PROBE_KEYS[0])

    await expect(
      awaitKeyValueReady(collection, 'the collection', {
        deadlineMs: DEADLINE_MS,
      })
    ).rejects.toThrow(/Timed out/)

    expect(gets.length).toBeGreaterThan(PROBE_KEY_COUNT)
  })

  it('returns once the last refusal clears', async () => {
    // A quarter of the fan refuses its first two questions and then serves.
    const late = new Set(PROBE_KEYS.slice(0, PROBE_KEY_COUNT / 4))
    const { collection } = stubCollection(
      (key, asked) => !late.has(key) || asked >= 2
    )

    await expect(
      awaitKeyValueReady(collection, 'the collection', { deadlineMs: 5_000 })
    ).resolves.toBeUndefined()
  })

  it('gives no credit for an answer that flapped back', async () => {
    // The pass has to be clean rather than cumulative. One key answers
    // and then refuses forever while another does the reverse, so every key
    // has answered at some point and no attempt is ever whole. Crediting keys
    // as they came good would call this ready.
    const flapper = PROBE_KEYS[0]
    const latecomer = PROBE_KEYS[1]
    const { collection } = stubCollection((key, asked) => {
      if (key === flapper) {
        return asked === 0
      }
      if (key === latecomer) {
        return asked > 0
      }
      return true
    })

    await expect(
      awaitKeyValueReady(collection, 'the collection', {
        deadlineMs: DEADLINE_MS,
      })
    ).rejects.toThrow(/probes answered/)
  })

  it('carries the description the caller gave into the timeout', async () => {
    const { collection } = stubCollection(() => false)

    await expect(
      awaitKeyValueReady(collection, 'scope s on bucket b', {
        deadlineMs: DEADLINE_MS,
      })
    ).rejects.toThrow(/scope s on bucket b/)
  })
})
