// The mock-limitation registry's own invariants.
//
// Every entry is coverage given up, and a green run never says an entry has
// become unnecessary. These checks keep the registry attached to reality:
// pinned to the backend version it was observed on, referenced from code, and
// unable to skip anything on a real cluster.

import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

import {
  MEASURED_AGAINST,
  MOCK_LIMITATIONS,
  type MockLimitation,
} from '../infra/limitations'
import { GOCAVES_VERSION } from '../infra/mock/gocaves'

const V2_ROOT = join(import.meta.dirname, '..')
const REGISTRY = join('infra', 'limitations.ts')

const entries = Object.entries(MOCK_LIMITATIONS) as [string, MockLimitation][]

function sources(): string[] {
  const found: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') {
          walk(path)
        }
      } else if (entry.name.endsWith('.ts')) {
        found.push(path)
      }
    }
  }
  walk(V2_ROOT)
  return found.filter(
    (path) =>
      !path.endsWith(REGISTRY) &&
      !path.endsWith(join('selftest', 'limitations.test.ts'))
  )
}

const corpus = sources()
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n')

describe('the mock-limitation registry', () => {
  it('has something to say', () => {
    // Without this the three checks below pass vacuously on an empty registry,
    // which is also what a broken import would produce.
    expect(entries.length).toBeGreaterThan(0)
  })

  it('pins every entry to the release it was observed against', () => {
    // Makes a limitation temporary: bumping GoCAVES moves `MEASURED_AGAINST`
    // and fails every entry until the suite is re-run and fixed ones deleted.
    const stale = entries
      .filter(([, l]) => l.observedIn !== MEASURED_AGAINST)
      .map(([id]) => id)
    expect(stale).toEqual([])
  })

  it('keeps the observed version and the launched version together', () => {
    // `MEASURED_AGAINST` is a copy, so the registry does not load
    // `child_process`; this stops the copy drifting.
    expect(MEASURED_AGAINST).toBe(GOCAVES_VERSION)
  })

  it('never lets an entry name a real cluster', () => {
    // The worst a wrong entry can do is lose coverage on a mock; naming `none`
    // would silence the real cluster.
    const overreaching = entries
      .filter(([, l]) => l.backends.includes('none'))
      .map(([id]) => id)
    expect(overreaching).toEqual([])
  })

  it('names at least one backend per entry', () => {
    const empty = entries.filter(([, l]) => l.backends.length === 0)
    expect(empty.map(([id]) => id)).toEqual([])
  })

  it('has no entry that nothing uses', () => {
    // An unreferenced entry silences nothing but still reads as a known
    // defect. Ids are string literals at call sites, so plain search is exact.
    const unused = entries
      .filter(([id]) => !corpus.includes(`'${id}'`))
      .map(([id]) => id)
    expect(unused).toEqual([])
  })

  it('says enough about each defect to file it', () => {
    // "Does not work" is not an entry: the note must be actionable by whoever
    // maintains the backend.
    const thin = entries
      .filter(([, l]) => l.note.trim().length < 80)
      .map(([id]) => id)
    expect(thin).toEqual([])
  })
})
