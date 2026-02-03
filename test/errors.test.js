'use strict'

const assert = require('chai').assert
const H = require('./harness')

function genericTests(collFn) {
  it('should should return a context with crud operations', async function () {
    try {
      await collFn().get('some-missing-key')
    } catch (err) {
      assert.instanceOf(err, H.lib.DocumentNotFoundError)
      assert.instanceOf(err.context, H.lib.KeyValueErrorContext)
      return
    }
    assert(false, 'should never reach here')
  })
}

describe('#errors', function () {
  genericTests(() => H.dco)
})

describe('#collections-errors', function () {
  before(function () {
    H.skipIfMissingFeature(this, H.Features.Collections)
  })

  genericTests(() => H.co)
})
