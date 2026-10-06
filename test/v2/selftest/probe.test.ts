import { describe, expect, it } from 'vitest'

import { ProbeError, resolveVersion, summarizeNodes } from '../infra/probe'

describe('reading the version from the node list', () => {
  it('takes the version a single node reports', () => {
    expect(
      summarizeNodes([
        { hostname: 'a:8091', version: '7.6.10-8025-enterprise' },
      ])
    ).toEqual({
      version: { major: 7, minor: 6, patch: 10 },
      nodeVersions: ['7.6.10-8025-enterprise'],
    })
  })

  it('gates a mixed-version cluster on its lowest node', () => {
    // Whichever node a request lands on, a feature the oldest node lacks is not
    // available, so an upgrade in progress must not read as the new version.
    const summary = summarizeNodes([
      { hostname: 'a:8091', version: '7.6.10-8025-enterprise' },
      { hostname: 'b:8091', version: '7.2.4-1234-enterprise' },
      { hostname: 'c:8091', version: '7.6.10-8025-enterprise' },
    ])
    expect(summary.version).toEqual({ major: 7, minor: 2, patch: 4 })
    expect(summary.nodeVersions).toHaveLength(3)
  })

  it('fails on a version it cannot read, rather than guessing', () => {
    expect(() =>
      summarizeNodes([{ hostname: 'a:8091', version: 'unknown' }])
    ).toThrow(ProbeError)
    expect(() =>
      summarizeNodes([{ hostname: 'a:8091', version: 'unknown' }])
    ).toThrow(/a:8091/)
  })

  it('fails when the cluster reports no nodes at all', () => {
    expect(() => summarizeNodes([])).toThrow(ProbeError)
  })
})

describe('applying a CNCVER override to the probed version', () => {
  const probed = { major: 7, minor: 1, patch: 6 }

  it('uses the probed version when there is no override', () => {
    expect(resolveVersion(probed, undefined)).toEqual(probed)
  })

  it('accepts an override at or below the probed version', () => {
    expect(resolveVersion(probed, probed)).toEqual(probed)
    const older = { major: 6, minor: 6, patch: 0 }
    expect(resolveVersion(probed, older)).toEqual(older)
  })

  it('refuses an override above the probed version', () => {
    // A leftover CNCVER from a newer cluster opens gates this one cannot pass.
    const newer = { major: 7, minor: 6, patch: 10 }
    expect(() => resolveVersion(probed, newer)).toThrow(ProbeError)
    expect(() => resolveVersion(probed, newer)).toThrow(/7\.6\.10.*7\.1\.6/)
  })
})
