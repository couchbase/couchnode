'use strict'

const assert = require('assert')
const sdutils = require('../lib/sdutils')

describe('#sdutils', function () {
  it('should handle base properties', () => {
    var res = sdutils.sdInsertByPath(null, 'foo', 'test')
    assert.deepEqual(res, { foo: 'test' })
  })

  it('should handle nested properties', () => {
    var res = sdutils.sdInsertByPath(null, 'foo.bar', 'test')
    assert.deepEqual(res, { foo: { bar: 'test' } })
  })

  it('should handle arrays', () => {
    var res = sdutils.sdInsertByPath(null, 'foo[0]', 'test')
    assert.deepEqual(res, { foo: ['test'] })
  })
})
