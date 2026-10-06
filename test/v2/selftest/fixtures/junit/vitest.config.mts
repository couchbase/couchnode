import { join } from 'path'
import { defineConfig } from 'vitest/config'

// Every outcome the JUnit reporter renders, run as a child process by
// `selftest/junit.test.ts`. No `globalSetup` or `setupFiles`; it fails on
// purpose.
export default defineConfig({
  root: import.meta.dirname,
  test: {
    pool: 'forks',
    include: ['*.test.ts'],
    reporters: [
      [
        join(import.meta.dirname, '..', '..', '..', 'reporters', 'junit.ts'),
        { outputFile: process.env.CNJUNIT ?? 'junit.xml' },
      ],
    ],
  },
})
