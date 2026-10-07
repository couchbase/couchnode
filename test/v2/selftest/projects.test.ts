// Every test file belongs to exactly one of the four projects
// `vitest.config.mts` declares. Membership is by glob, so a file matching none
// is silently never run, and an exclusive file matching two loses its
// isolation.
//
// The projects are asked through `createVitest` and `globTestFiles()`, the
// runner's own calls, rather than matched here a second time. That resolves
// the config without starting a run, so `globalSetup` never fires.

import { readFileSync, readdirSync } from 'fs'
import { join, relative, sep } from 'path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createVitest } from 'vitest/node'

import { UNIT_PROJECT } from '../globalSetup'

const V2_ROOT = join(import.meta.dirname, '..')
const CONFIG = join(V2_ROOT, 'vitest.config.mts')

/** Never walked: other packages' tests, and the runner's cache. */
const SKIP_DIRS = new Set(['node_modules'])

/** Spawned by selftests as a child process; excluded from every project. */
const FIXTURES = join('selftest', 'fixtures')

/**
 * Every `*.test.ts` under `test/v2/`. The whole tree, not just where the globs
 * look, or a file no glob reaches would go unnoticed.
 */
function testFilesOnDisk(): string[] {
  const found: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          walk(full)
        }
      } else if (entry.name.endsWith('.test.ts')) {
        found.push(relative(V2_ROOT, full))
      }
    }
  }
  walk(V2_ROOT)
  return found.filter((f) => !f.startsWith(FIXTURES + sep)).sort()
}

/** Every file under `test/v2/` that `match` accepts, given directory and name. */
function filesOnDisk(match: (dir: string, name: string) => boolean): string[] {
  const found: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          walk(full)
        }
      } else if (match(dir, entry.name)) {
        found.push(relative(V2_ROOT, full))
      }
    }
  }
  walk(V2_ROOT)
  return found.sort()
}

const EXIT_FIXTURE_SUFFIX = '.exitfixture.ts'
const EXIT_FIXTURE_DIR = 'exitfixtures'

/** What each npm script the Makefile targets run is supposed to select. */
const AXES: readonly { script: string; expected: string[] }[] = [
  { script: 'test:v2', expected: ['exclusive', 'integration', 'unit'] },
  { script: 'test:v2:fast', expected: ['integration', 'unit'] },
  { script: 'test:v2:unit', expected: ['unit'] },
  { script: 'test:v2:periodic', expected: ['periodic'] },
]

/**
 * The `--project` values an npm script passes, read out of `package.json`.
 *
 * Checked rather than read because a negation is not a filter: `!periodic`
 * matches every other project, and selection is an `any` over the patterns, so
 * `--project unit --project '!periodic'` silently selects `exclusive` too.
 */
function projectFlags(script: string): string[] {
  const pkg = JSON.parse(
    readFileSync(join(V2_ROOT, '..', '..', 'package.json'), 'utf8')
  ) as { scripts: Record<string, string> }
  const command = pkg.scripts[script]
  expect(command, `package.json has a '${script}' script`).toBeTypeOf('string')
  const flags: string[] = []
  const words = command.split(/\s+/)
  words.forEach((word, i) => {
    if (word === '--project') {
      flags.push(words[i + 1].replace(/^['"]|['"]$/g, ''))
    }
  })
  return flags
}

describe('the project split', () => {
  let byProject: Map<string, string[]>

  beforeAll(async () => {
    const vitest = await createVitest('test', {
      config: CONFIG,
      watch: false,
      run: true,
    })
    try {
      byProject = new Map()
      for (const project of vitest.projects) {
        const { testFiles } = await project.globTestFiles()
        byProject.set(
          project.name,
          testFiles.map((f) => relative(V2_ROOT, f)).sort()
        )
      }
    } finally {
      await vitest.close()
    }
  }, 60_000)

  it('is exactly unit, integration, exclusive and periodic', () => {
    expect([...byProject.keys()].sort()).toEqual([
      'exclusive',
      'integration',
      'periodic',
      'unit',
    ])
  })

  it('agrees with globalSetup on what the cluster-free project is called', () => {
    // globalSetup skips starting a server when this project runs alone, so
    // the two names must agree or a unit run silently spawns a mock.
    expect(byProject.has(UNIT_PROJECT)).toBe(true)
  })

  it('claims every test file in the tree, and no file twice', () => {
    const claimed = [...byProject.values()].flat()
    expect([...claimed].sort()).toEqual(testFilesOnDisk())
    expect(new Set(claimed).size).toBe(claimed.length)
  })

  it('puts every bucket-creating suite in the sequential project', () => {
    const exclusiveOnDisk = testFilesOnDisk().filter((f) =>
      f.endsWith('.exclusive.test.ts')
    )
    // Not a tautology against the glob: the assertion is that the naming
    // convention and the project agree in both directions, so a file named
    // `*.exclusive.test.ts` somewhere the exclusive `include` does not reach
    // fails here rather than running in parallel with everything else.
    expect(exclusiveOnDisk.length).toBeGreaterThan(0)
    expect(byProject.get('exclusive')).toEqual(exclusiveOnDisk)
  })

  it('puts every periodic suite in the periodic project', () => {
    const periodicOnDisk = testFilesOnDisk().filter((f) =>
      f.endsWith('.periodic.test.ts')
    )
    // The same claim the exclusive check makes, and it matters more here,
    // because this project is the one no ordinary run selects. A file named
    // `*.periodic.test.ts` that the periodic `include` does not reach is run by
    // nothing at all: it is excluded from the default run by its name and
    // excluded from the periodic run by not matching, and the only symptom is
    // a suite nobody notices has stopped running.
    expect(byProject.get('periodic')).toEqual(periodicOnDisk)
  })

  it('collects no exit fixture, and keeps every one where it is named', () => {
    // An exit fixture runs only in its own process via `infra/exit.ts`, never
    // as a test file, and its name and directory are what keep it so. A test
    // file in `exitfixtures/` would run in the forks pool, where not exiting
    // is invisible; a fixture elsewhere is one nobody finds.
    const fixtures = filesOnDisk((_, name) =>
      name.endsWith(EXIT_FIXTURE_SUFFIX)
    )
    const inFixtureDirs = filesOnDisk(
      (dir) => dir.split(sep).pop() === EXIT_FIXTURE_DIR
    )
    // Not vacuous: `selftest/exitfixtures/` proves the helper itself.
    expect(fixtures.length).toBeGreaterThan(0)
    expect(inFixtureDirs).toEqual(fixtures)

    const claimed = new Set([...byProject.values()].flat())
    for (const fixture of fixtures) {
      expect(claimed.has(fixture), `${fixture} is collected as a test`).toBe(
        false
      )
    }
  })

  it.each(AXES)(
    'selects the right projects for npm run $script',
    async ({ script, expected }) => {
      // The flags come from `package.json` and the selection from Vitest, so
      // this cannot drift from what CI runs.
      const project = projectFlags(script)
      const vitest = await createVitest('test', {
        config: CONFIG,
        watch: false,
        run: true,
        ...(project.length > 0 ? { project } : {}),
      })
      try {
        expect(
          vitest.projects.map((p) => p.name).sort(),
          `${script} passes ${JSON.stringify(project)}`
        ).toEqual(expected)
      } finally {
        await vitest.close()
      }
    },
    60_000
  )

  it('keeps anything needing a server out of the unit project', () => {
    const unit = byProject.get(UNIT_PROJECT) ?? []
    // `suites/unit/` takes no cluster fixture; any other selftest that wants
    // a server says so with `.integration.test.ts`.
    for (const file of unit) {
      const isUnitSuite = file.startsWith(join('suites', 'unit') + sep)
      const isPureSelftest =
        file.startsWith('selftest' + sep) &&
        !file.endsWith('.integration.test.ts')
      expect(
        isUnitSuite || isPureSelftest,
        `${file} is in the '${UNIT_PROJECT}' project but is neither a ` +
          'suites/unit suite nor a selftest'
      ).toBe(true)
    }
  })
})
