// The known-issue registry's own invariants.
//
// A known issue skips on a real cluster too, so every entry must name a filed
// ticket. With the registry empty the entry checks pass vacuously; the
// `isTicket` checks and the fixture-backed gate tests are what run meanwhile.

import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

import {
  KNOWN_ISSUES,
  UNTRACKED,
  gateFrom,
  gateKnownIssues,
  isTicket,
  type KnownIssue,
} from '../infra/knownissues'

const TEST_ROOT = join(import.meta.dirname, '..')
const REGISTRY = join('infra', 'knownissues.ts')

const entries = Object.entries(KNOWN_ISSUES) as [string, KnownIssue][]

/** Every `.ts` under `test/` except the registry itself and this file. */
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
  walk(TEST_ROOT)
  return found.filter(
    (path) =>
      !path.endsWith(REGISTRY) &&
      !path.endsWith(join('selftest', 'knownissues.test.ts'))
  )
}

const corpus = sources()
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n')

describe('what counts as a ticket', () => {
  it('accepts a key from any project that files against this SDK', () => {
    // This SDK, the C++ core, the server, and the build board.
    for (const ticket of ['JSCBC-1442', 'CXXCBC-174', 'CBD-5091', 'MB-12345']) {
      expect(isTicket(ticket)).toBe(true)
    }
  })

  it('refuses everything that is not one', () => {
    for (const nope of [
      '',
      'none yet',
      'TODO',
      'see the ticket',
      'jscbc-1442',
      'JSCBC1442',
      'JSCBC-',
      '1442',
      'JSCBC-1442 and JSCBC-1443',
    ]) {
      expect(isTicket(nope)).toBe(false)
    }
  })

  it('admits exactly one escape hatch, and it is a word', () => {
    // For a defect understood before anybody has filed it. Unlike a blank, it
    // is greppable.
    expect(isTicket(UNTRACKED)).toBe(true)
    expect(UNTRACKED).toBe('UNTRACKED')
  })
})

describe('the known-issue registry', () => {
  it('names a real ticket in every entry', () => {
    const untraceable = entries
      .filter(([, issue]) => !isTicket(issue.ticket))
      .map(([id]) => id)
    expect(untraceable).toEqual([])
  })

  it('lists what is owed to Jira, rather than letting it pass', () => {
    // Not a failure: `UNTRACKED` is admissible, but a run says it out loud.
    const owed = entries
      .filter(([, issue]) => issue.ticket === UNTRACKED)
      .map(([id]) => id)
    if (owed.length > 0) {
      console.warn(
        `[test] ${owed.length} known issue(s) still need a ticket filed: ` +
          `${owed.join(', ')}`
      )
    }
    expect(Array.isArray(owed)).toBe(true)
  })

  it('says enough about each defect to recognize it later', () => {
    const thin = entries
      .filter(([, issue]) => issue.note.trim().length < 80)
      .map(([id]) => id)
    expect(thin).toEqual([])
  })

  it('has no entry that nothing uses', () => {
    // An unused entry reads as an accepted defect while silencing nothing.
    // The id is a string literal at every call site.
    const unused = entries
      .filter(([id]) => !corpus.includes(`'${id}'`))
      .map(([id]) => id)
    expect(unused).toEqual([])
  })
})

describe('the known-issue gate', () => {
  it('cites nothing, so it gates nothing', () => {
    expect(gateKnownIssues([]).kind).toBe('ok')
  })

  it('ignores an id that is not declared, rather than inventing a skip', () => {
    // Unreachable from a suite by type, and checked anyway: a missed lookup
    // must not silence a test for no stated reason.
    // @ts-expect-error an id the registry does not declare
    expect(gateKnownIssues(['not-a-declared-issue']).kind).toBe('ok')
  })

  it('requires the ids and nothing else, which is the point', () => {
    // A guard on the signature: a product defect is not narrowed by
    // deployment. That narrowing belongs to `gateLimitations`.
    expect(gateKnownIssues.length).toBe(1)
  })

  // The registry is empty, so the gate saying "yes" is tested against a
  // fixture.
  const FIXTURE = Object.freeze({
    'mutatein-expiry-lost': Object.freeze({
      ticket: 'JSCBC-9999',
      note: 'a placeholder, used only by this file',
    }),
    'unfiled-thing': Object.freeze({
      ticket: UNTRACKED,
      note: 'a placeholder, used only by this file',
    }),
  })

  it('reports the ticket, the id and the note, in that order', () => {
    // The reason is the whole output of this mechanism, so it must carry the
    // ticket.
    const gate = gateFrom(['mutatein-expiry-lost'], FIXTURE)
    expect(gate.kind).toBe('known-issue')
    expect(gate.kind !== 'ok' && gate.reason).toBe(
      'JSCBC-9999 [mutatein-expiry-lost]: a placeholder, used only by this file'
    )
  })

  it('gates on an untracked entry too, rather than waiting for the filing', () => {
    const gate = gateFrom(['unfiled-thing'], FIXTURE)
    expect(gate.kind).toBe('known-issue')
  })

  it('answers with the first cited issue that exists', () => {
    const gate = gateFrom(
      ['not-declared', 'unfiled-thing', 'mutatein-expiry-lost'],
      FIXTURE
    )
    expect(gate.kind !== 'ok' && gate.reason).toContain('unfiled-thing')
  })
})
