import { defineConfig } from 'vitest/config'

// One parallel and one sequential project, three sleeping files each, every
// file recording when it held its slot. No `globalSetup` or `setupFiles`. Run
// as a child process by `selftest/scheduling.test.ts`.
export default defineConfig({
  root: import.meta.dirname,
  test: {
    projects: [
      {
        test: {
          name: 'parallel',
          root: import.meta.dirname,
          pool: 'forks',
          include: ['parallel/*.test.ts'],
          fileParallelism: true,
          // As `integration` is in the real config: capped below the file
          // count, which needs a group of its own.
          maxWorkers: 2,
          sequence: { groupOrder: 1 },
        },
      },
      {
        test: {
          name: 'sequential',
          root: import.meta.dirname,
          pool: 'forks',
          include: ['sequential/*.test.ts'],
          fileParallelism: false,
        },
      },
    ],
  },
})
