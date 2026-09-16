'use strict'

const assert = require('assert')
const { SdUtils } = require('../lib/sdutils')
const binding = require('../lib/binding').default
const { subdocumentStatusFromCpp } = require('../lib/bindingutilities')
const { LookupInResult, LookupInReplicaResult } = require('../lib/crudoptypes')
const {
  CouchbaseError,
  DocumentNotFoundError,
  PathMismatchError,
} = require('../lib/errors')

describe('#sdutils', function () {
  it('should handle base properties', function () {
    var res = SdUtils.insertByPath(null, 'foo', 'test')
    assert.deepEqual(res, { foo: 'test' })
  })

  it('should handle nested properties', function () {
    var res = SdUtils.insertByPath(null, 'foo.bar', 'test')
    assert.deepEqual(res, { foo: { bar: 'test' } })
  })

  it('should handle arrays', function () {
    var res = SdUtils.insertByPath(null, 'foo[0]', 'test')
    assert.deepEqual(res, { foo: ['test'] })
  })
})

describe('#subdocstatus', function () {
  const statusCodes = Object.keys(binding.key_value_status_code).filter(
    (name) => isNaN(Number(name))
  )

  it('should map every key value status code without throwing', function () {
    // subdocumentStatusFromCpp has to be total. It runs inside an async
    // function in Collection._lookupInReplica() whose promise is discarded, so
    // a throw there never reaches the caller's await: it skips the emit('end')
    // that settles the operation and surfaces as an unhandled rejection. The
    // sub-document statuses are a small subset of this enum and the rest have
    // to land somewhere.
    for (const name of statusCodes) {
      const mapped = subdocumentStatusFromCpp(
        binding.key_value_status_code[name]
      )
      assert.strictEqual(
        typeof mapped,
        'string',
        `${name} did not map to a status`
      )
    }
  })

  it('should map a document level status to unknown', function () {
    // When one replica answers a replica lookup with a document level failure
    // and no field results, the core synthesizes a field per requested spec and
    // stamps the document level status on each, so these arrive in a field slot.
    assert.strictEqual(
      subdocumentStatusFromCpp(binding.key_value_status_code.not_found),
      'unknown'
    )
    // The core falls back to this one when the failing replica reported no
    // status code at all, so it reaches a field just as readily.
    assert.strictEqual(
      subdocumentStatusFromCpp(binding.key_value_status_code.invalid),
      'unknown'
    )
  })

  it('should still map the sub-document statuses', function () {
    assert.strictEqual(
      subdocumentStatusFromCpp(
        binding.key_value_status_code.subdoc_path_not_found
      ),
      'path_not_found'
    )
    assert.strictEqual(
      subdocumentStatusFromCpp(binding.key_value_status_code.success),
      'success'
    )
  })

  const entry = (status, error) => ({
    error: error || null,
    value: undefined,
    status,
  })

  const results = [
    ['LookupInResult', (content) => new LookupInResult({ content, cas: '0' })],
    [
      'LookupInReplicaResult',
      (content) =>
        new LookupInReplicaResult({ content, cas: '0', isReplica: true }),
    ],
  ]

  results.forEach(function ([name, build]) {
    it(`should raise the entry error for a failing status on ${name}`, function () {
      // The core sends a per field error code alongside the status and the
      // entry already carries it mapped, so it is the thing worth raising. It
      // holds for a modelled status and for one this SDK does not model, where
      // the status says no more than that.
      const modelled = build([entry('path_mismatch', new PathMismatchError())])
      assert.throws(() => modelled.exists(0), PathMismatchError)

      const unmodelled = build([entry('unknown', new DocumentNotFoundError())])
      assert.throws(() => unmodelled.exists(0), DocumentNotFoundError)
    })

    it(`should fall back to the status with no entry error on ${name}`, function () {
      // The entry error check is a new early return above a fallback that was
      // already here, so this pins that it did not shadow it, and that the new
      // 'unknown' arm of parseSubdocStatus() is reachable.
      assert.throws(
        () => build([entry('path_mismatch')]).exists(0),
        PathMismatchError
      )
      assert.throws(
        () => build([entry('unknown')]).exists(0),
        (err) =>
          err instanceof CouchbaseError &&
          err.message === 'Unknown subdocument status code'
      )
    })
  })
})
