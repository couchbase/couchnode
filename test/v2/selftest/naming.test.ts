import { describe, expect, it } from 'vitest'

import {
  MAX_RESOURCE_NAME,
  assertLegalName,
  keyPrefix,
  leaseStampMs,
  newFileToken,
  newLeaseNames,
  newRunId,
  resourceName,
  workerId,
} from '../infra/naming'

describe('resource names', () => {
  it('is short and legal for a pre-7.6 scope or collection', () => {
    // 30 characters and [A-Za-z0-9_%-] before 7.6, which is why these are a
    // hash rather than a readable concatenation.
    const name = resourceName('scope', 'some.rather.long.suite.name')
    expect(name.length).toBeLessThanOrEqual(30)
    expect(name).toMatch(/^s_[0-9a-f]{8}$/)
  })

  it('is deterministic per suite and worker', () => {
    const env = { VITEST_POOL_ID: '3' }
    expect(resourceName('coll', 'crud', env)).toBe(
      resourceName('coll', 'crud', env)
    )
  })

  it('differs across workers, so two workers cannot collide', () => {
    expect(resourceName('coll', 'crud', { VITEST_POOL_ID: '1' })).not.toBe(
      resourceName('coll', 'crud', { VITEST_POOL_ID: '2' })
    )
  })

  it('differs across kinds and suites', () => {
    const env = { VITEST_POOL_ID: '1' }
    expect(resourceName('scope', 'crud', env)).not.toBe(
      resourceName('coll', 'crud', env)
    )
    expect(resourceName('coll', 'crud', env)).not.toBe(
      resourceName('coll', 'expiry', env)
    )
  })
})

describe('lease names', () => {
  it('is never the same twice, for the same worker in the same minute', () => {
    // Reuse is the defect: a scope recreated under a name it had a moment ago
    // is listed before every node has finished with the old one.
    const env = { VITEST_POOL_ID: '1' }
    const now = Date.now()
    expect(newLeaseNames(env, now).scope).not.toBe(
      newLeaseNames(env, now).scope
    )
  })

  it('is legal before 7.6 and names the worker', () => {
    const { scope, collection } = newLeaseNames({ VITEST_POOL_ID: '12' })
    expect(scope).toMatch(/^s_[0-9a-z]+_12_[0-9a-f]{6}$/)
    expect(collection).toBe(scope.replace(/^s_/, 'c_'))
    expect(scope.length).toBeLessThanOrEqual(MAX_RESOURCE_NAME)
  })

  it('reads back the minute a scope was minted', () => {
    const minted = Date.UTC(2026, 9, 7, 12, 34, 56)
    const { scope } = newLeaseNames({}, minted)
    expect(leaseStampMs(scope)).toBe(Date.UTC(2026, 9, 7, 12, 34))
  })

  it('answers null for any scope it did not name', () => {
    // What keeps the stale sweep off scopes this tree did not create.
    for (const other of [
      '_default',
      'inventory',
      resourceName('scope', 'crud'),
      'c_abc_1_abcdef',
    ]) {
      expect(leaseStampMs(other)).toBeNull()
    }
  })
})

describe('the name rules themselves', () => {
  it('enforces the tighter pre-7.6 limit, not the 7.6 one', () => {
    // Enforced on every version, so a name cannot pass on 7.6 and fail to
    // provision on 7.0; the generated names never need the extra room.
    expect(MAX_RESOURCE_NAME).toBe(30)
    expect(() => assertLegalName('scope', 'a'.repeat(31))).toThrow(
      /31 characters; the limit is 30/
    )
    expect(assertLegalName('scope', 'a'.repeat(30))).toBe('a'.repeat(30))
  })

  it('refuses a leading underscore or percent, which the server reserves', () => {
    expect(() => assertLegalName('scope', '_mine')).toThrow(/not legal/)
    expect(() => assertLegalName('scope', '%mine')).toThrow(/not legal/)
    // Legal after the first character, which is why `s_a3f19c02` is fine.
    expect(assertLegalName('scope', 's_a-b%c')).toBe('s_a-b%c')
  })

  it('refuses characters the server does not accept at all', () => {
    for (const illegal of ['has space', 'has.dot', 'has/slash', '']) {
      expect(() => assertLegalName('coll', illegal)).toThrow()
    }
  })

  it('cannot return an illegal generated name', () => {
    // The check lives inside `resourceName`, so no lease has to re-validate
    // what it was handed.
    expect(() => resourceName('bucket', 'x'.repeat(500))).not.toThrow()
    expect(resourceName('bucket', 'x'.repeat(500))).toMatch(/^b_[0-9a-f]{8}$/)
  })
})

describe('key prefixes', () => {
  it('is unique per run and worker', () => {
    expect(keyPrefix('abcd1234', 'f00d01', { VITEST_POOL_ID: '1' })).toBe(
      'abcd1234_1_f00d01'
    )
    expect(keyPrefix('abcd1234', 'f00d01', { VITEST_POOL_ID: '2' })).not.toBe(
      keyPrefix('abcd1234', 'f00d01', { VITEST_POOL_ID: '1' })
    )
  })

  it('is unique per file within one worker', () => {
    // A slot runs file after file, each restarting its key counter, so the
    // file token is the only thing keeping two of them apart.
    const worker = { VITEST_POOL_ID: '1' }
    expect(keyPrefix('abcd1234', newFileToken(), worker)).not.toBe(
      keyPrefix('abcd1234', newFileToken(), worker)
    )
    expect(newFileToken()).toMatch(/^[0-9a-f]{6}$/)
  })

  it('falls back to worker 0 outside a worker', () => {
    expect(workerId({})).toBe('0')
  })

  it('mints a fresh run id each call', () => {
    expect(newRunId()).not.toBe(newRunId())
    expect(newRunId()).toMatch(/^[0-9a-f]{8}$/)
  })
})
