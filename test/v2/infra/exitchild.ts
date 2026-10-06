// The fixture side of `exit.ts`: what a `*.exitfixture.ts` imports.
//
// It runs under `ts-node` as CommonJS, not Vitest, so it imports nothing; the
// run's settings arrive as environment variables `exit.ts` sets.
//
// Nothing here ends the process: it exits when its loop is empty or not at
// all, and that is the check. A fixture calling `process.exit()` or unrefing
// what it started would hide the handle being looked for.

/**
 * The variables the parent sets, named as the run reads them so a fixture can
 * also be run by hand.
 */
export const EXIT_CHILD_ENV = {
  connectionString: 'CNCSTR',
  username: 'CNUSER',
  password: 'CNPASS',
  bucket: 'CNBUCKET',
} as const

/**
 * Writes the body's outcome to stdout as one JSON line. A throw sets
 * `process.exitCode` instead of exiting, so a failing body that also leaks is
 * reported as not exiting.
 */
export function runExitFixture(
  body: () => Promise<Record<string, unknown>>
): void {
  body().then(
    (outcome) => {
      process.stdout.write(`${JSON.stringify(outcome)}\n`)
    },
    (err: unknown) => {
      process.exitCode = 1
      process.stderr.write(
        `exit fixture failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`
      )
    }
  )
}
