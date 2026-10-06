import { describe, expect, it } from 'vitest'

import binding from '../../../../lib/binding'
import * as couchbase from '../../../../lib/couchbase'

// Checks that the N-API addon survives Vite's transform pipeline. These
// assertions are about the *binding*, not the SDK surface: a partially
// initialized addon still exports a plausible looking module object, so check
// for something only the compiled code can provide.
describe('native binding', () => {
  it('loads the compiled addon', () => {
    expect(binding).toBeTypeOf('object')
    expect(binding.Connection).toBeTypeOf('function')
  })

  it('exposes enum tables built in C++', () => {
    // These tables are populated by the addon at init; an addon that resolved
    // but failed to initialize leaves them undefined.
    expect(binding.errc_common.request_canceled).toBeTypeOf('number')
    expect(binding.protocol_subdoc_opcode).toBeTypeOf('object')
  })

  it('reports a version string from the C++ core', () => {
    expect(binding.cbppVersion).toBeTypeOf('string')
    expect(binding.cbppVersion.length).toBeGreaterThan(0)
  })

  it('is reachable through the SDK entry point', () => {
    expect(couchbase.Cluster).toBeTypeOf('function')
    expect(couchbase.connect).toBeTypeOf('function')
  })
})
