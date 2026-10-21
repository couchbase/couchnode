import { join } from 'path'

import { describe, expect, it } from 'vitest'

import { expectProcessExits } from '../../infra/exit'
import {
  ABANDONED_UNDER_MS,
  WORKER_CASES,
  type MainExitOutcome,
  type WorkerCasesOutcome,
} from './shutdowntimeout.cases'

// Tearing down an environment whose connection's close is stalled. The
// teardown waits for the close for at most `CN_SHUTDOWN_TIMEOUT_MS`, which the
// addon reads from the environment's own `process.env`. A bound that does not
// hold leaves the teardown waiting, and a waiting worker keeps the process
// that started it from exiting, so every case runs in a fixture process.

const FIXTURES = join(import.meta.dirname, 'exitfixtures')

/**
 * Five workers, three of them waiting out the stall. Generous, because a slow
 * pass is not the defect: the defect is never exiting at all.
 */
const WORKER_BUDGET_MS = 30_000

describe('#worker-threads shutdown timeout', () => {
  it(
    'bounds the wait for a stalled close when a worker is terminated',
    async () => {
      const { outcome } = await expectProcessExits<WorkerCasesOutcome>(
        join(FIXTURES, 'shutdowntimeout.exitfixture.ts'),
        { withinMs: WORKER_BUDGET_MS }
      )
      for (const c of WORKER_CASES) {
        const ms = outcome.terminateMs[c.name]
        if (c.abandons) {
          expect(ms, `abandons at ${c.name}`).toBeLessThan(ABANDONED_UNDER_MS)
        } else {
          // Returns once the stall ends and the close finishes, well before
          // the bound.
          expect(ms, `waits under ${c.name}`).toBeGreaterThanOrEqual(
            ABANDONED_UNDER_MS
          )
          expect(ms, `returns within ${c.name}`).toBeLessThan(c.boundMs)
        }
      }
    },
    WORKER_BUDGET_MS + 15_000
  )
})

describe('#main-thread shutdown timeout', () => {
  /** How long the exit took after the fixture had nothing left to do. */
  async function exitMs(fixture: string): Promise<number> {
    const { outcome } = await expectProcessExits<MainExitOutcome>(
      join(FIXTURES, fixture)
    )
    return Date.now() - outcome.endedAt
  }

  it('waits for a stalled close under a bound longer than the stall', async () => {
    expect(
      await exitMs('shutdowntimeoutmain.exitfixture.ts')
    ).toBeGreaterThanOrEqual(ABANDONED_UNDER_MS)
  })

  it('abandons a stalled close under a bound shorter than the stall', async () => {
    expect(
      await exitMs('shutdowntimeoutmainabandon.exitfixture.ts')
    ).toBeLessThan(ABANDONED_UNDER_MS)
  })
})
