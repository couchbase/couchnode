import { join } from 'path'
import { defineConfig } from 'vitest/config'

// Four projects, one per scheduling need:
//
// | project | what is in it | scheduling | in the default run |
// |---|---|---|---|
// | `unit` | no cluster, no mock, no network | fully parallel | yes |
// | `integration` | needs a cluster or the mock | file-parallel | yes |
// | `exclusive` | creates or drops buckets | strictly sequential | yes |
// | `periodic` | costs minutes and is wanted rarely | strictly sequential | **no** |
//
// Membership is a filename (`*.exclusive.test.ts`, `*.periodic.test.ts`,
// `selftest/*.integration.test.ts`), never a list kept here.
// `selftest/projects.test.ts` checks every test file belongs to exactly one.
//
// Bucket-creating suites are sequential because the server serializes bucket
// create, update and delete behind one cluster-wide lock: a parallel file gets
// `503 Cannot update bucket while another bucket is being deleted`.
//
// The periodic project (the eventing function management suites, minutes per
// file) is selected out with `--project '!periodic'` rather than tiered down,
// because tiers are cumulative and cannot express "all but this". Its suites
// declare no tier, so the project is the only gate.
//
// The SDK's N-API addon loads under this config with no `server.deps` or
// interop settings; do not add them speculatively.

const REPO_ROOT = join(import.meta.dirname, '..')

const TESTS = 'test'

/**
 * What every project shares. Spelled once, spread into each, so a divergence
 * between them is visible as an explicit override rather than as drift.
 */
const base = {
  // The repo, not `test/`: the v8 provider only counts files beneath the
  // project root, so rooting at `test/` silently reports `0/0` coverage for
  // `lib/`. Vitest has no `coverage.root`, and an absolute include does not
  // help. Hence the `test/` prefix on every glob below.
  root: REPO_ROOT,
  pool: 'forks' as const,
  // `testTimeout` must exceed the SDK operation timeouts a test wraps, so the
  // SDK's typed error (with its context) fires first rather than the runner's
  // bare "Timeout of Nms exceeded".
  testTimeout: 30_000,
  hookTimeout: 60_000,
  setupFiles: [join(import.meta.dirname, 'setup.ts')],
}

/**
 * Never a test file. `selftest/fixtures/` holds configs and suites that a
 * selftest spawns as a child process. `node_modules` is repeated because
 * setting `exclude` replaces the defaults.
 */
const NEVER = ['**/node_modules/**', `${TESTS}/selftest/fixtures/**`]

export default defineConfig({
  root: REPO_ROOT,
  test: {
    // At the root, not per project: a `globalSetup` named by two projects runs
    // once per project from a fresh module copy, which would spawn two mocks
    // and give the halves of the run different run ids.
    globalSetup: [join(import.meta.dirname, 'globalSetup.ts')],
    // `CNJUNIT=<path>` adds a JUnit file for CI. The tree's own reporter,
    // because Vitest's drops skip reasons. Unset, `reporters` stays unset so a
    // command line `--reporter` keeps its meaning.
    ...(process.env.CNJUNIT
      ? {
          reporters: [
            'default',
            [
              join(import.meta.dirname, 'reporters', 'junit.ts'),
              { outputFile: process.env.CNJUNIT },
            ],
          ],
        }
      : {}),
    // Root only: Vitest does not accept `coverage` on a project.
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
      // `binding.ts` only loads the compiled addon.
      exclude: ['lib/binding.ts', 'lib/**/*.d.ts'],
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: 'coverage',
    },
    projects: [
      {
        test: {
          ...base,
          name: 'unit',
          // No mock, connection or probe. `selftest/` holds the
          // infrastructure's own tests, so `suites/` is only the SDK's.
          include: [
            `${TESTS}/suites/unit/**/*.test.ts`,
            `${TESTS}/selftest/**/*.test.ts`,
          ],
          exclude: [...NEVER, `${TESTS}/selftest/**/*.integration.test.ts`],
        },
      },
      {
        test: {
          ...base,
          name: 'integration',
          include: [
            `${TESTS}/suites/**/*.test.ts`,
            `${TESTS}/selftest/**/*.integration.test.ts`,
          ],
          exclude: [
            ...NEVER,
            `${TESTS}/suites/unit/**`,
            '**/*.exclusive.test.ts',
            '**/*.periodic.test.ts',
          ],
          fileParallelism: true,
          // A floor to raise, not a measured ceiling. Unset, it follows the
          // runner's core count, so cluster load would depend on the machine.
          // Raise it only against a real cluster; GoCAVES passes at any count.
          //
          // `--maxWorkers` does not override a project's value, and projects
          // with different `maxWorkers` cannot share a `groupOrder`, hence a
          // group of its own. Groups run in order: `unit` first, the
          // sequential projects last.
          maxWorkers: 2,
          sequence: { groupOrder: 1 },
        },
      },
      {
        test: {
          ...base,
          name: 'exclusive',
          include: [`${TESTS}/suites/**/*.exclusive.test.ts`],
          exclude: NEVER,
          // Files here overlap neither each other nor any other project's
          // files: the scheduler runs sequential files last. The bucket lock
          // above depends on it, and it is undocumented, so
          // `selftest/scheduling.test.ts` checks it.
          fileParallelism: false,
        },
      },
      {
        test: {
          ...base,
          name: 'periodic',
          include: [`${TESTS}/suites/**/*.periodic.test.ts`],
          exclude: NEVER,
          // Also sequential because eventing functions are cluster-global:
          // two files driving deploys at once are refused for each other's
          // state.
          fileParallelism: false,
        },
      },
    ],
  },
})
