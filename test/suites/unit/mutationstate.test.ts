import { describe, expect, it } from 'vitest'

import { MutationState, MutationToken } from '../../../lib/mutationstate'

interface FakeToken {
  readonly partitionId: number
  readonly seqno: number
  readonly uuid?: string
  readonly bucket?: string
}

/**
 * A stand-in for the `CppMutationToken` the state consumes. It only relies on
 * `toJSON()`/`toString()`, which is the whole of the interface.
 */
function fakeToken({
  partitionId,
  seqno,
  uuid = '0xdead',
  bucket = 'default',
}: FakeToken): MutationToken {
  const data = {
    partition_id: partitionId,
    partition_uuid: uuid,
    sequence_number: seqno,
    bucket_name: bucket,
  }
  return {
    toString: () => `${bucket}:${partitionId}:${uuid}:${seqno}`,
    toJSON: () => data,
  }
}

function storedSeqno(
  state: MutationState,
  bucket: string,
  vbId: number
): number {
  return parseInt(state._data[bucket][vbId].toJSON().sequence_number, 10)
}

describe('#mutationstate', () => {
  // Regression guard (JSCBC-1404): of two tokens on the same vBucket, the
  // state keeps the one with the highest seqno.
  it('keeps the highest seqno when a higher token is added after a lower one', () => {
    const state = new MutationState()
    state.add(fakeToken({ partitionId: 10, seqno: 100 }))
    state.add(fakeToken({ partitionId: 10, seqno: 200 }))
    expect(storedSeqno(state, 'default', 10)).toBe(200)
  })

  it('keeps the highest seqno when a lower token is added after a higher one', () => {
    const state = new MutationState()
    state.add(fakeToken({ partitionId: 10, seqno: 200 }))
    state.add(fakeToken({ partitionId: 10, seqno: 100 }))
    expect(storedSeqno(state, 'default', 10)).toBe(200)
  })

  it('tracks vBuckets independently', () => {
    const state = new MutationState()
    state.add(fakeToken({ partitionId: 1, seqno: 5 }))
    state.add(fakeToken({ partitionId: 2, seqno: 9 }))
    state.add(fakeToken({ partitionId: 1, seqno: 7 }))
    expect(storedSeqno(state, 'default', 1)).toBe(7)
    expect(storedSeqno(state, 'default', 2)).toBe(9)
  })

  it('keeps states for different buckets separate', () => {
    const state = new MutationState()
    state.add(fakeToken({ partitionId: 1, seqno: 5, bucket: 'beer' }))
    state.add(fakeToken({ partitionId: 1, seqno: 8, bucket: 'travel' }))
    expect(storedSeqno(state, 'beer', 1)).toBe(5)
    expect(storedSeqno(state, 'travel', 1)).toBe(8)
  })
})
