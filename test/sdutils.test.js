'use strict'

const assert = require('assert')
const { SdUtils } = require('../lib/sdutils')

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
