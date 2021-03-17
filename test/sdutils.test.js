'use strict'

const assert = require('assert')
const { SdUtils } = require('../lib/sdutils')

describe('#sdutils', function () {
  it('should handle base properties', () => {
    var res = SdUtils.insertByPath(null, 'foo', 'test')
    assert.deepEqual(res, { foo: 'test' })
  })

  it('should handle nested properties', () => {
    var res = SdUtils.insertByPath(null, 'foo.bar', 'test')
    assert.deepEqual(res, { foo: { bar: 'test' } })
  })

  it('should handle arrays', () => {
    var res = SdUtils.insertByPath(null, 'foo[0]', 'test')
    assert.deepEqual(res, { foo: ['test'] })
  })
})
