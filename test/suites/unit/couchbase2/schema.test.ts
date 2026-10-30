import { existsSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

import { PROTO_FILES } from '../../../../lib/couchbase2/generated/loaderoptions'
import { loadSchema, PROTOS_DIR } from '../../../../lib/couchbase2/schema'

// The pinned protos parse with the options their declarations were generated
// with, and every service the backend reaches for is there. No server.
describe('#couchbase2 schema', () => {
  it('should find every listed proto in the protos directory', () => {
    const missing = PROTO_FILES.filter((f) => !existsSync(join(PROTOS_DIR, f)))
    expect(missing).toEqual([])
  })

  it('should load once and return the same schema after', () => {
    expect(loadSchema()).toBe(loadSchema())
  })

  it('should expose the services the backend uses', () => {
    const schema = loadSchema()
    expect(schema.couchbase.kv.v1.KvService.service.Get.path).toBe(
      '/couchbase.kv.v1.KvService/Get'
    )
    expect(schema.couchbase.query.v1.QueryService.service.Query.path).toBe(
      '/couchbase.query.v1.QueryService/Query'
    )
    expect(schema.grpc.health.v1.Health.service.Check.path).toBe(
      '/grpc.health.v1.Health/Check'
    )
  })

  it('should load google.rpc.Status and its error details', () => {
    const schema = loadSchema()
    expect(schema.google.rpc.Status.type).toBeDefined()
    expect(schema.google.rpc.ErrorInfo.type).toBeDefined()
    expect(schema.google.rpc.ResourceInfo.type).toBeDefined()
  })
})
