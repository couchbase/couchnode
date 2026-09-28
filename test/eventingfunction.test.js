'use strict'

const assert = require('chai').assert

const {
  EventingFunction,
  EventingFunctionConstantBinding,
  EventingFunctionKeyspace,
} = require('../lib/eventingfunctionmanager')

// These tests need no server.  They check what an upsert sends for a
// definition that leaves out the members a caller may omit.
describe('#eventing function definition', function () {
  const minimal = {
    name: 'fn',
    code: 'function OnUpdate(doc, meta) {}',
    metadataKeyspace: new EventingFunctionKeyspace({ bucket: 'meta' }),
    sourceKeyspace: new EventingFunctionKeyspace({ bucket: 'source' }),
  }

  it('sends empty bindings when none are given', function () {
    const cppData = EventingFunction._toCppData(minimal)

    assert.deepStrictEqual(cppData.bucket_bindings, [])
    assert.deepStrictEqual(cppData.url_bindings, [])
    assert.deepStrictEqual(cppData.constant_bindings, [])
  })

  it('sends default settings when none are given', function () {
    const cppData = EventingFunction._toCppData(minimal)

    assert.deepStrictEqual(cppData.settings, {
      handler_headers: [],
      handler_footers: [],
    })
  })

  it('still sends the bindings it is given', function () {
    const cppData = EventingFunction._toCppData({
      ...minimal,
      constantBindings: [
        new EventingFunctionConstantBinding({ alias: 'a', literal: '1' }),
      ],
    })

    assert.deepStrictEqual(cppData.constant_bindings, [
      { alias: 'a', literal: '1' },
    ])
    assert.deepStrictEqual(cppData.bucket_bindings, [])
    assert.deepStrictEqual(cppData.url_bindings, [])
  })
})
