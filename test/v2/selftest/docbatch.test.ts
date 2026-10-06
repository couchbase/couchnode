// `DocBatch` against a recording collection.
//
// The assertions are on the operations performed, not the documents that end
// up there: a batch written six times still reads back correctly, and a
// cleanup that did nothing shows up only as another suite's failure later.

import { describe, expect, it } from 'vitest'

import type { Collection } from '../../../lib/collection'
import { DocumentNotFoundError } from '../../../lib/errors'
import { gridDocCount, gridDocs } from '../infra/data/docs'
import { DocBatch } from '../infra/data/loader'

interface Recorder {
  readonly collection: Collection
  readonly upserts: { key: string; value: unknown }[]
  readonly removes: string[]
}

function recorder(
  behavior: {
    failUpsert?: (key: string, attempt: number) => Error | undefined
    failRemove?: (key: string) => Error | undefined
  } = {}
): Recorder {
  const upserts: { key: string; value: unknown }[] = []
  const removes: string[] = []
  const attempts = new Map<string, number>()

  const collection = {
    name: 'stub',
    upsert: async (key: string, value: unknown) => {
      const attempt = (attempts.get(key) ?? 0) + 1
      attempts.set(key, attempt)
      const err = behavior.failUpsert?.(key, attempt)
      if (err) {
        throw err
      }
      upserts.push({ key, value })
      return {}
    },
    remove: async (key: string) => {
      const err = behavior.failRemove?.(key)
      if (err) {
        throw err
      }
      removes.push(key)
      return {}
    },
  } as unknown as Collection

  return { collection, upserts, removes }
}

describe('loading a batch', () => {
  it('writes each document exactly once', async () => {
    // A retry loop with no break would write each document `retries` times.
    const rec = recorder()

    const batch = await DocBatch.load(rec.collection, { uid: 'u1' })

    expect(batch.size).toBe(gridDocCount())
    expect(rec.upserts).toHaveLength(gridDocCount())
    expect(new Set(rec.upserts.map((u) => u.key)).size).toBe(gridDocCount())
  })

  it('returns document ids, and only document ids', async () => {
    // Ids, because they are what the error-path cleanup removes by.
    const rec = recorder()
    const batch = await DocBatch.load(rec.collection, { uid: 'u2' })

    expect(batch.ids).toEqual(
      Array.from({ length: gridDocCount() }, (_, i) => `u2::${i}`)
    )
    await batch.purge()
    expect(rec.removes.sort()).toEqual([...batch.ids].sort())
  })

  it('stamps the uid on every document without touching the source', async () => {
    const rec = recorder()
    const batch = await DocBatch.load(rec.collection, { uid: 'u3' })

    expect(batch.doc(0)).toMatchObject({ ...gridDocs()[0], testUid: 'u3' })
    // Stamping in place would leak one batch's uid into every later caller.
    expect(gridDocs()[0]).not.toHaveProperty('testUid')
  })

  it('takes a document list of its own', async () => {
    const rec = recorder()
    const batch = await DocBatch.load(rec.collection, {
      uid: 'u4',
      docs: [{ a: 1 }, { a: 2 }],
    })

    expect(batch.size).toBe(2)
    expect(batch.doc(1)).toEqual({ a: 2, testUid: 'u4' })
  })

  it('retries a document that fails, then stops', async () => {
    const rec = recorder(
      // The first attempt at one document fails; nothing else does.
      {
        failUpsert: (key, attempt) =>
          key === 'u5::3' && attempt === 1 ? new Error('transient') : undefined,
      }
    )

    const batch = await DocBatch.load(rec.collection, { uid: 'u5' })

    expect(batch.size).toBe(gridDocCount())
    expect(rec.upserts).toHaveLength(gridDocCount())
  })

  it('rejects when a document could not be written, naming it', async () => {
    // A suite querying nine documents when eight landed would fail a long way
    // from the cause.
    const rec = recorder({
      failUpsert: (key) =>
        key === 'u6::2' ? new Error('no space left') : undefined,
    })

    // One attempt: the failure is permanent, and retrying it only spends time.
    await expect(
      DocBatch.load(rec.collection, { uid: 'u6', retries: 1 })
    ).rejects.toThrow(/1 of 9 document\(s\) in batch 'u6'/)
  })

  it('removes whatever landed before it gave up', async () => {
    // Otherwise a failed load leaves documents behind for the next suite.
    const rec = recorder({
      failUpsert: (key) => (key === 'u7::2' ? new Error('nope') : undefined),
    })

    await expect(
      DocBatch.load(rec.collection, { uid: 'u7', retries: 1 })
    ).rejects.toThrow()

    expect(rec.removes.sort()).toEqual(
      Array.from({ length: gridDocCount() }, (_, i) => `u7::${i}`).sort()
    )
  })
})

describe('purging a batch', () => {
  it('treats an already absent document as done', async () => {
    // A purge racing a suite's own cleanup is the normal case, not an error.
    const rec = recorder({ failRemove: () => new DocumentNotFoundError() })
    const batch = await DocBatch.load(rec.collection, { uid: 'u8' })

    await expect(batch.purge()).resolves.toBeUndefined()
  })

  it('can be called twice', async () => {
    const rec = recorder()
    const batch = await DocBatch.load(rec.collection, { uid: 'u9' })

    await batch.purge()
    await batch.purge()

    expect(rec.removes).toHaveLength(gridDocCount() * 2)
  })

  it('reports a document it could not remove', async () => {
    const rec = recorder({
      failRemove: (key) => (key === 'u10::0' ? new Error('locked') : undefined),
    })
    const batch = await DocBatch.load(rec.collection, { uid: 'u10' })

    await expect(batch.purge()).rejects.toThrow(
      /1 of 9 document\(s\) in batch 'u10' could not be removed/
    )
  })
})

describe('the grid documents', () => {
  it('is the nine documents the view and query suites assert against', () => {
    expect(gridDocCount()).toBe(9)
    expect(gridDocs().map((d) => d.name)).toEqual([
      'x0,y0',
      'x1,y0',
      'x2,y0',
      'x0,y1',
      'x1,y1',
      'x2,y1',
      'x0,y2',
      'x1,y2',
      'x2,y2',
    ])
  })

  it('cannot be mutated by whoever gets it', () => {
    expect(() => {
      ;(gridDocs()[0] as { x: number }).x = 99
    }).toThrow()
  })
})
