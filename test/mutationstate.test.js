'use strict'

const assert = require('assert')
const { MutationState } = require('../lib/mutationstate')

// Builds a fake mutation token shaped like the CppMutationToken that
// MutationState consumes (it only relies on toJSON()/toString()).
function fakeToken({ partitionId, seqno, uuid = '0xdead', bucket = 'default' }) {
  const data = {
    partition_id: partitionId,
    partition_uuid: uuid,
    sequence_number: seqno,
    bucket_name: bucket,
  }
  return {
    toString() {
      return `${bucket}:${partitionId}:${uuid}:${seqno}`
    },
    toJSON() {
      return data
    },
  }
}

function storedSeqno(state, bucket, vbId) {
  return parseInt(state._data[bucket][vbId].toJSON().sequence_number, 10)
}

describe('#mutationstate', function () {
  // Regression test: when two tokens land on the same vBucket the state must
  // retain the one with the *highest* seqno. A field-name typo previously made
  // the incumbent seqno parse to NaN, so the comparison was always false and
  // the first (lower) token won -- producing stale consistentWith snapshot
  // requirements and intermittent off-by-N range scan results.
  it('keeps the highest seqno when a higher token is added after a lower one', function () {
    const state = new MutationState()
    state.add(fakeToken({ partitionId: 10, seqno: 100 }))
    state.add(fakeToken({ partitionId: 10, seqno: 200 }))
    assert.strictEqual(storedSeqno(state, 'default', 10), 200)
  })

  it('keeps the highest seqno when a lower token is added after a higher one', function () {
    const state = new MutationState()
    state.add(fakeToken({ partitionId: 10, seqno: 200 }))
    state.add(fakeToken({ partitionId: 10, seqno: 100 }))
    assert.strictEqual(storedSeqno(state, 'default', 10), 200)
  })

  it('tracks vBuckets independently', function () {
    const state = new MutationState()
    state.add(fakeToken({ partitionId: 1, seqno: 5 }))
    state.add(fakeToken({ partitionId: 2, seqno: 9 }))
    state.add(fakeToken({ partitionId: 1, seqno: 7 }))
    assert.strictEqual(storedSeqno(state, 'default', 1), 7)
    assert.strictEqual(storedSeqno(state, 'default', 2), 9)
  })

  it('keeps states for different buckets separate', function () {
    const state = new MutationState()
    state.add(fakeToken({ partitionId: 1, seqno: 5, bucket: 'beer' }))
    state.add(fakeToken({ partitionId: 1, seqno: 8, bucket: 'travel' }))
    assert.strictEqual(storedSeqno(state, 'beer', 1), 5)
    assert.strictEqual(storedSeqno(state, 'travel', 1), 8)
  })
})
