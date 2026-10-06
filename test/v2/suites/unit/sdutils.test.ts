import { describe, expect, it } from 'vitest'

import binding from '../../../../lib/binding'
import { subdocumentStatusFromCpp } from '../../../../lib/bindingutilities'
import {
  LookupInReplicaResult,
  LookupInResult,
  LookupInResultEntry,
} from '../../../../lib/crudoptypes'
import {
  CouchbaseError,
  DocumentNotFoundError,
  PathMismatchError,
} from '../../../../lib/errors'
import { SdUtils, SubdocStatus } from '../../../../lib/sdutils'
import { Cas } from '../../../../lib/utilities'

// Path-to-object reconstruction, used to assemble a projection result from the
// individual subdoc paths the server returns.
describe('#sdutils', () => {
  it('should handle base properties', () => {
    expect(SdUtils.insertByPath(null, 'foo', 'test')).toEqual({ foo: 'test' })
  })

  it('should handle nested properties', () => {
    expect(SdUtils.insertByPath(null, 'foo.bar', 'test')).toEqual({
      foo: { bar: 'test' },
    })
  })

  it('should handle arrays', () => {
    expect(SdUtils.insertByPath(null, 'foo[0]', 'test')).toEqual({
      foo: ['test'],
    })
  })
})

describe('#subdocstatus', () => {
  const statusCodes = Object.entries(binding.key_value_status_code).filter(
    ([name]) => isNaN(Number(name))
  )

  it('should map every key value status code without throwing', () => {
    // subdocumentStatusFromCpp has to be total. It runs in an async function in
    // Collection._lookupInReplica() whose promise is discarded, so a throw
    // skips the emit('end') that settles the operation and surfaces as an
    // unhandled rejection.
    for (const [name, code] of statusCodes) {
      expect(
        typeof subdocumentStatusFromCpp(code),
        `${name} did not map to a status`
      ).toBe('string')
    }
  })

  it('should map a document level status to unknown', () => {
    // When one replica answers a replica lookup with a document level failure
    // and no field results, the core synthesizes a field per requested spec
    // and stamps the document level status on each, so these arrive in a field
    // slot.
    expect(
      subdocumentStatusFromCpp(binding.key_value_status_code.not_found)
    ).toBe('unknown')
    // The core falls back to this one when the failing replica reported no
    // status code at all, so it reaches a field just as readily.
    expect(
      subdocumentStatusFromCpp(binding.key_value_status_code.invalid)
    ).toBe('unknown')
  })

  it('should still map the sub-document statuses', () => {
    expect(
      subdocumentStatusFromCpp(
        binding.key_value_status_code.subdoc_path_not_found
      )
    ).toBe('path_not_found')
    expect(
      subdocumentStatusFromCpp(binding.key_value_status_code.success)
    ).toBe('success')
  })

  const cas: Cas = { toString: () => '0', toJSON: () => '0' }

  const entry = (status: SubdocStatus, error?: Error): LookupInResultEntry => ({
    error: error ?? null,
    value: undefined,
    status,
  })

  const results: [
    string,
    (content: LookupInResultEntry[]) => LookupInResult | LookupInReplicaResult,
  ][] = [
    ['LookupInResult', (content) => new LookupInResult({ content, cas })],
    [
      'LookupInReplicaResult',
      (content) => new LookupInReplicaResult({ content, cas, isReplica: true }),
    ],
  ]

  for (const [name, build] of results) {
    it(`should raise the entry error for a failing status on ${name}`, () => {
      // The core sends a per field error code alongside the status and the
      // entry already carries it mapped, so it is the thing worth raising. It
      // holds for a modelled status and for one this SDK does not model, where
      // the status says no more than that.
      const modelled = build([entry('path_mismatch', new PathMismatchError())])
      expect(() => modelled.exists(0)).toThrow(PathMismatchError)

      const unmodelled = build([entry('unknown', new DocumentNotFoundError())])
      expect(() => unmodelled.exists(0)).toThrow(DocumentNotFoundError)
    })

    it(`should fall back to the status with no entry error on ${name}`, () => {
      // With no per field error the status fallback still applies, and the
      // 'unknown' arm of parseSubdocStatus() is reachable.
      expect(() => build([entry('path_mismatch')]).exists(0)).toThrow(
        PathMismatchError
      )
      const unknown = build([entry('unknown')])
      expect(() => unknown.exists(0)).toThrow(CouchbaseError)
      expect(() => unknown.exists(0)).toThrow(
        /^Unknown subdocument status code$/
      )
    })
  }
})
