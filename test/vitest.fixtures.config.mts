import { defineConfig } from 'vitest/config'

// Runs only the deliberately failing fixture suites, which the main config
// excludes. Used by `selftest/serializerwiring.integration.test.ts`, which
// spawns this and reads the failure report: the only way to check that a hook
// which decorates reported failures is actually wired in.
export default defineConfig({
  root: import.meta.dirname,
  test: {
    pool: 'forks',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    globalSetup: ['./globalSetup.ts'],
    setupFiles: ['./setup.ts'],
    include: ['selftest/fixtures/**/*.test.ts'],
    // `scheduling/` and `junit/` are fixtures with spawners of their own
    // (`selftest/scheduling.test.ts`, `selftest/junit.test.ts`).
    exclude: [
      '**/node_modules/**',
      'selftest/fixtures/scheduling/**',
      'selftest/fixtures/junit/**',
    ],
  },
})
