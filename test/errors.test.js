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
  /* eslint-disable-next-line mocha/no-setup-in-describe */
  genericTests(() => H.dco)
})

describe('#collections-errors', function () {
  /* eslint-disable-next-line mocha/no-hooks-for-single-case */
  before(function () {
    H.skipIfMissingFeature(this, H.Features.Collections)
  })

  /* eslint-disable-next-line mocha/no-setup-in-describe */
  genericTests(() => H.co)
})
