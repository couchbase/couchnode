'use strict'

const assert = require('assert')
const { MutateInSpec } = require('../lib/sdspecs')

describe('#sdspecs', function () {
  // The FIT performer drives the full server round-trip for these; here we just
  // guard the client-side encoding that preserves 64-bit precision.  These are
  // pure unit tests and do not require a cluster.
  describe('#counter bigint', function () {
    it('should encode a bigint increment delta as an exact integer literal', function () {
      // A `number` delta of this magnitude rounds to "9223372036854776000";
      // the bigint path must carry it through exactly.
      const spec = MutateInSpec.increment('foo', 9223372036854775807n)
      assert.strictEqual(spec._data, '9223372036854775807')
    })

    it('should encode a bigint decrement delta as a negative literal', function () {
      const spec = MutateInSpec.decrement('foo', 9223372036854775807n)
      assert.strictEqual(spec._data, '-9223372036854775807')
    })

    it('should leave the number delta path unchanged', function () {
      assert.strictEqual(MutateInSpec.increment('foo', 5)._data, '5')
      assert.strictEqual(MutateInSpec.decrement('foo', 5)._data, '-5')
    })
  })

  // The increment/decrement `value` param is typed `number | bigint` (not
  // `| string`) on purpose: a string is silently coerced through `number`
  // (`+value`) and loses precision above 2^53, so the type steers callers to
  // `bigint` -- the only precision-safe path -- and flags the lossy string path
  // at compile time.  TypeScript blocks a string here, but a plain-JS caller can
  // still pass one; these tests pin down that runtime behavior so it can't
  // regress, and document why the type excludes `string`.
  describe('#counter string coercion (runtime)', function () {
    it('coerces a small numeric string, matching pre-bigint behavior', function () {
      assert.strictEqual(MutateInSpec.increment('foo', '5')._data, '5')
      assert.strictEqual(MutateInSpec.decrement('foo', '5')._data, '-5')
    })

    it('loses precision for a large numeric string (a bigint must be used)', function () {
      const big = '9223372036854775807'
      // coerced via +value -> rounded to the nearest double, NOT the exact value
      const spec = MutateInSpec.increment('foo', big)
      assert.notStrictEqual(spec._data, big)
      assert.strictEqual(spec._data, '9223372036854776000')
      // contrast: the same value as a bigint is carried through exactly
      assert.strictEqual(
        MutateInSpec.increment('foo', 9223372036854775807n)._data,
        big
      )
    })
  })
})
