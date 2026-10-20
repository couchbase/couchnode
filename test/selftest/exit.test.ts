// `infra/exit.ts` proved both ways, with no cluster.
//
// A helper whose job is to fail is worth nothing until it has been seen to
// fail. The shape that matters is the wedged one: a fixture that reports
// success and then keeps its loop alive, which is what a native callback the
// core never makes looks like from outside. If that passed, or hung the test,
// the helper would be the same blind spot it was written to close.

import { join } from 'path'
import { describe, expect, it } from 'vitest'

import {
  FixtureDidNotExitError,
  FixtureFailedError,
  expectProcessExits,
} from '../infra/exit'

const FIXTURES = join(import.meta.dirname, 'exitfixtures')

/**
 * Short, because the wedged fixture spends all of it. Long enough for a
 * `ts-node` start without the SDK, which is what that fixture is.
 */
const WEDGED_BUDGET_MS = 4_000

describe('expectProcessExits', () => {
  it('passes a fixture that exits, and resolves with what it reported', async () => {
    const { outcome } = await expectProcessExits<{
      connectType: string
      resolvedFrom: string
    }>(join(FIXTURES, 'clean.exitfixture.ts'))

    expect(outcome.connectType).toBe('function')
    // The source, not the last build: see the fixture contract.
    expect(outcome.resolvedFrom).toMatch(/[\\/]lib[\\/]couchbase\.ts$/)
  })

  it('kills a fixture that does not exit, and fails naming it', async () => {
    const err = await expectProcessExits(
      join(FIXTURES, 'wedged.exitfixture.ts'),
      { withinMs: WEDGED_BUDGET_MS }
    ).then(
      () => undefined,
      (e: unknown) => e
    )

    expect(err).toBeInstanceOf(FixtureDidNotExitError)
    const wedged = err as FixtureDidNotExitError
    expect(wedged.message).toContain('wedged.exitfixture.ts')
    expect(wedged.message).toContain(`${WEDGED_BUDGET_MS} ms`)
    // It had reported success before it was killed, which is the case the
    // helper exists for: every assertion inside the child passed.
    expect(wedged.message).toContain('"armed":true')

    // Gone, not merely signalled. The error is thrown only after `killChild`
    // has seen it exit, and signal 0 asks the kernel without sending anything.
    expect(wedged.pid).toBeTypeOf('number')
    expect(() => process.kill(wedged.pid as number, 0)).toThrow(
      expect.objectContaining({ code: 'ESRCH' })
    )
  })

  it('fails a fixture that exits with a failure, carrying its message', async () => {
    const err = await expectProcessExits(
      join(FIXTURES, 'failing.exitfixture.ts')
    ).then(
      () => undefined,
      (e: unknown) => e
    )

    expect(err).toBeInstanceOf(FixtureFailedError)
    const failed = err as FixtureFailedError
    expect(failed.exitCode).toBe(1)
    expect(failed.message).toContain(
      'the expectation this fixture exists to fail'
    )
  })

  it('refuses a path that is not named as an exit fixture', async () => {
    // The name is what keeps every project from collecting a fixture as a
    // test file, so a fixture without it would be run twice, once as a test.
    await expect(
      expectProcessExits(join(FIXTURES, 'clean.ts'))
    ).rejects.toThrow(/\*\.exitfixture\.ts/)
  })
})
