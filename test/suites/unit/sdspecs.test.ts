import { describe, expect, it } from 'vitest'

import { MutateInSpec } from '../../../lib/sdspecs'

/** A string `value`, which only a plain JavaScript caller can pass. */
function incrementByString(value: string): MutateInSpec {
  // @ts-expect-error a string delta, as a plain JavaScript caller passes it
  return MutateInSpec.increment('foo', value)
}

function decrementByString(value: string): MutateInSpec {
  // @ts-expect-error a string delta, as a plain JavaScript caller passes it
  return MutateInSpec.decrement('foo', value)
}

describe('#sdspecs', () => {
  // Client side encoding only; the FIT performer covers the server round trip.
  describe('#counter bigint', () => {
    it('should encode a bigint increment delta as an exact integer literal', () => {
      // A `number` delta of this magnitude rounds to "9223372036854776000";
      // the bigint path must carry it through exactly.
      const spec = MutateInSpec.increment('foo', 9223372036854775807n)
      expect(spec._data).toBe('9223372036854775807')
    })

    it('should encode a bigint decrement delta as a negative literal', () => {
      const spec = MutateInSpec.decrement('foo', 9223372036854775807n)
      expect(spec._data).toBe('-9223372036854775807')
    })

    it('should leave the number delta path unchanged', () => {
      expect(MutateInSpec.increment('foo', 5)._data).toBe('5')
      expect(MutateInSpec.decrement('foo', 5)._data).toBe('-5')
    })
  })

  // `value` is typed `number | bigint`, not `string`: a string is coerced
  // through `+value` and loses precision above 2^53. A plain JavaScript caller
  // can still pass one, so these tests pin that runtime behavior.
  describe('#counter string coercion (runtime)', () => {
    it('coerces a small numeric string, matching pre-bigint behavior', () => {
      expect(incrementByString('5')._data).toBe('5')
      expect(decrementByString('5')._data).toBe('-5')
    })

    it('loses precision for a large numeric string (a bigint must be used)', () => {
      const big = '9223372036854775807'
      // Coerced via `+value`, so rounded to the nearest double.
      expect(incrementByString(big)._data).not.toBe(big)
      expect(incrementByString(big)._data).toBe('9223372036854776000')
      // The same value as a bigint is carried through exactly.
      expect(MutateInSpec.increment('foo', 9223372036854775807n)._data).toBe(
        big
      )
    })
  })
})
