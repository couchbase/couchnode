import { describe, expect, it } from 'vitest'

import { ServerFeature } from '../infra/capabilities'
import { TestConfigError, hasNoCluster, loadTestConfig } from '../infra/config'

describe('config defaults', () => {
  it('defaults everything the harness defaulted', () => {
    const config = loadTestConfig({})
    expect(config.connectionString).toBeUndefined()
    expect(config.bucket).toBe('default')
    expect(config.tier).toBe('fast')
    expect(config.featureOverrides).toEqual({})
  })

  it('defaults the backend to the one mock this tree has', () => {
    // An unset CNMOCK is what a developer running `npm test` has.
    expect(loadTestConfig({}).mockBackend).toBe('gocaves')
  })

  it('rejects the retired backend by name, rather than ignoring it', () => {
    // A stale CI job or alias carrying CNMOCK=jcbmock must fail loudly rather
    // than run against a backend the caller did not ask for.
    expect(() => loadTestConfig({ CNMOCK: 'jcbmock' })).toThrow(TestConfigError)
    expect(() => loadTestConfig({ CNMOCK: 'jcbmock' })).toThrow(/CNMOCK/)
  })

  it('reports when there is nothing to connect to at all', () => {
    expect(hasNoCluster(loadTestConfig({ CNMOCK: 'none' }))).toBe(true)
    expect(
      hasNoCluster(loadTestConfig({ CNCSTR: 'couchbase://localhost' }))
    ).toBe(false)
    // The default backend counts as something to connect to.
    expect(hasNoCluster(loadTestConfig({}))).toBe(false)
  })
})

describe('CNCVER', () => {
  it('is an override, and a connection string alone is fine', () => {
    // The version is probed, so no CNCVER is needed (JSCBC-1447).
    const config = loadTestConfig({ CNCSTR: 'couchbase://localhost' })
    expect(config.versionOverride).toBeUndefined()
  })

  it('parses an override', () => {
    const config = loadTestConfig({
      CNCSTR: 'couchbase://localhost',
      CNCVER: '7.2.4',
    })
    expect(config.versionOverride).toEqual({ major: 7, minor: 2, patch: 4 })
  })

  it('rejects a version with no cluster to apply it to', () => {
    expect(() => loadTestConfig({ CNCVER: '7.6.0' })).toThrow(TestConfigError)
    expect(() => loadTestConfig({ CNCVER: '7.6.0' })).toThrow(/CNCSTR/)
  })

  it('rejects 0.0.0 and other unusable values', () => {
    for (const value of ['0.0.0', '7.6', 'latest']) {
      expect(
        () =>
          loadTestConfig({ CNCSTR: 'couchbase://localhost', CNCVER: value }),
        value
      ).toThrow(TestConfigError)
    }
  })
})

describe('CNFEAT', () => {
  it('parses signed feature names', () => {
    const config = loadTestConfig({ CNFEAT: '+range_scan,-eventing' })
    expect(config.featureOverrides).toEqual({
      [ServerFeature.RangeScan]: true,
      [ServerFeature.Eventing]: false,
    })
  })

  it('expands the wildcard, and a later entry still wins', () => {
    const config = loadTestConfig({ CNFEAT: '-*,+kv' })
    expect(config.featureOverrides[ServerFeature.Query]).toBe(false)
    expect(config.featureOverrides[ServerFeature.KeyValue]).toBe(true)
  })

  it('rejects an unknown feature name instead of storing it', () => {
    // Stored as-is, a typo would match no gate, disable nothing, and report
    // nothing.
    expect(() => loadTestConfig({ CNFEAT: '+rangescan' })).toThrow(
      /unknown feature 'rangescan'/
    )
  })

  it('rejects an entry with no sign', () => {
    expect(() => loadTestConfig({ CNFEAT: 'range_scan' })).toThrow(
      TestConfigError
    )
  })
})

describe('enumerated variables', () => {
  it('rejects an unknown backend or tier by name', () => {
    expect(() => loadTestConfig({ CNMOCK: 'caves' })).toThrow(/CNMOCK='caves'/)
    expect(() => loadTestConfig({ CNTIER: 'quick' })).toThrow(/CNTIER='quick'/)
  })

  it('accepts the documented values', () => {
    expect(loadTestConfig({ CNMOCK: 'none' }).mockBackend).toBe('none')
    expect(loadTestConfig({ CNTIER: 'nightly' }).tier).toBe('nightly')
  })
})
