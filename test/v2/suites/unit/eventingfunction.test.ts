import { describe, expect, it } from 'vitest'

import {
  EventingFunction,
  EventingFunctionConstantBinding,
  EventingFunctionKeyspace,
  IEventingFunction,
} from '../../../../lib/couchbase'

// These tests need no server. They check what an upsert sends for a definition
// that leaves out the members a caller may omit. `minimal` is typed as the
// interface rather than cast, so the omitted members are held optional at
// compile time as well as at run time.
describe('#eventing function definition', () => {
  const minimal: IEventingFunction = {
    name: 'fn',
    code: 'function OnUpdate(doc, meta) {}',
    metadataKeyspace: new EventingFunctionKeyspace({ bucket: 'meta' }),
    sourceKeyspace: new EventingFunctionKeyspace({ bucket: 'source' }),
  }

  it('sends empty bindings when none are given', () => {
    const cppData = EventingFunction._toCppData(minimal)

    expect(cppData.bucket_bindings).toStrictEqual([])
    expect(cppData.url_bindings).toStrictEqual([])
    expect(cppData.constant_bindings).toStrictEqual([])
  })

  it('sends default settings when none are given', () => {
    const cppData = EventingFunction._toCppData(minimal)

    expect(cppData.settings).toStrictEqual({
      handler_headers: [],
      handler_footers: [],
    })
  })

  it('still sends the bindings it is given', () => {
    const cppData = EventingFunction._toCppData({
      ...minimal,
      constantBindings: [
        new EventingFunctionConstantBinding({ alias: 'a', literal: '1' }),
      ],
    })

    expect(cppData.constant_bindings).toStrictEqual([
      { alias: 'a', literal: '1' },
    ])
    expect(cppData.bucket_bindings).toStrictEqual([])
    expect(cppData.url_bindings).toStrictEqual([])
  })
})
