'use strict'

const assert = require('chai').assert
const H = require('./harness')

function genericTests(collFn) {
  it('should should return a context with crud operations', async () => {
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

describe('#crud', () => {
  genericTests(() => H.dco)
})

describe('#collections-crud', () => {
  H.requireFeature(H.Features.Collections, () => {
    genericTests(() => H.co)
  })
})
