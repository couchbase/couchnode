import { describe, expect, it } from 'vitest'

import binding from '../../../lib/binding'
import {
  lookupInSpecToCpp,
  mutateInSpecToCpp,
} from '../../../lib/bindingutilities'
import {
  LookupInMacro,
  LookupInSpec,
  MutateInMacro,
  MutateInSpec,
} from '../../../lib/sdspecs'

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

  // A spec stores the SDK's own operation and flags; the classic dispatch maps
  // them to the addon's values. Each row pins the opcode and path flags a
  // factory produced when it read the addon directly.
  describe('#classic mapping', () => {
    const op = binding.protocol_subdoc_opcode
    const lookupXattr =
      binding.protocol_lookup_in_request_body_lookup_in_specs_path_flag.xattr
    const mutateFlag =
      binding.protocol_mutate_in_request_body_mutate_in_specs_path_flag

    it.each([
      ['get', () => LookupInSpec.get('a'), op.get, 0],
      ['get, empty path', () => LookupInSpec.get(''), op.get_doc, 0],
      [
        'get, xattr',
        () => LookupInSpec.get('a', { xattr: true }),
        op.get,
        lookupXattr,
      ],
      [
        'get, macro',
        () => LookupInSpec.get(LookupInMacro.Cas),
        op.get,
        lookupXattr,
      ],
      ['exists', () => LookupInSpec.exists('a'), op.exists, 0],
      ['count', () => LookupInSpec.count('a'), op.get_count, 0],
    ])('maps lookup-in %s', (_name, build, opcode, flags) => {
      const cmd = lookupInSpecToCpp(build(), 3)
      expect(cmd.opcode_).toBe(opcode)
      expect(cmd.flags_).toBe(flags)
      expect(cmd.path_).toBe(build()._path)
      expect(cmd.original_index_).toBe(3)
    })

    it.each([
      [
        'insert, create path',
        () => MutateInSpec.insert('a', 1, { createPath: true }),
        op.dict_add,
        mutateFlag.create_parents,
      ],
      ['upsert', () => MutateInSpec.upsert('a', 1), op.dict_upsert, 0],
      ['upsert, empty path', () => MutateInSpec.upsert('', {}), op.set_doc, 0],
      ['replace', () => MutateInSpec.replace('a', 1), op.replace, 0],
      [
        'replace, empty path',
        () => MutateInSpec.replace('', {}),
        op.set_doc,
        0,
      ],
      [
        'remove, xattr',
        () => MutateInSpec.remove('a', { xattr: true }),
        op.remove,
        mutateFlag.xattr,
      ],
      ['remove, empty path', () => MutateInSpec.remove(''), op.remove_doc, 0],
      [
        'arrayAppend',
        () => MutateInSpec.arrayAppend('a', 1),
        op.array_push_last,
        0,
      ],
      [
        'arrayPrepend',
        () => MutateInSpec.arrayPrepend('a', 1),
        op.array_push_first,
        0,
      ],
      [
        'arrayInsert',
        () => MutateInSpec.arrayInsert('a.[0]', 1),
        op.array_insert,
        0,
      ],
      [
        'arrayAddUnique',
        () => MutateInSpec.arrayAddUnique('a', 1),
        op.array_add_unique,
        0,
      ],
      ['increment', () => MutateInSpec.increment('a', 1), op.counter, 0],
      ['decrement', () => MutateInSpec.decrement('a', 1), op.counter, 0],
      [
        'upsert, macro',
        () => MutateInSpec.upsert('a', MutateInMacro.Cas),
        op.dict_upsert,
        mutateFlag.expand_macros | mutateFlag.xattr,
      ],
      [
        'upsert, macro, create path',
        () => MutateInSpec.upsert('a', MutateInMacro.Cas, { createPath: true }),
        op.dict_upsert,
        mutateFlag.create_parents | mutateFlag.expand_macros | mutateFlag.xattr,
      ],
    ])('maps mutate-in %s', (_name, build, opcode, flags) => {
      const value = Buffer.from('1')
      const cmd = mutateInSpecToCpp(build(), value, 0)
      expect(cmd.opcode_).toBe(opcode)
      expect(cmd.flags_).toBe(flags)
      expect(cmd.path_).toBe(build()._path)
      expect(cmd.value_).toBe(value)
    })
  })
})
