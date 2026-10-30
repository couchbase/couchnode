import { join } from 'path'

import { describe, expect, it } from 'vitest'

import { expectProcessExits } from '../../infra/exit'

// A couchbase2 connection never touches the native addon, so the SDK must
// import, build sub-document specs, and connect and close a couchbase2://
// cluster without it. Only a read of an addon value may load it, and that read
// must fail with an error naming what needed it.

const FIXTURES = join(import.meta.dirname, 'exitfixtures')

// The fixture compiles the whole SDK as it imports it, which takes most of the
// default budget on the slower agents. A hang still fails, just later.
const EXIT_BUDGET_MS = 60_000
const TEST_TIMEOUT_MS = EXIT_BUDGET_MS + 15_000

interface AddonFreeOutcome {
  exports: number
  refusedOnImport: number
  refusedOnSpecs: number
  couchbase2: {
    connectError?: string
    connError?: string
    closeError?: string
    refused: number
  }
  useError?: { name: string; message: string }
}

describe('#addon-free import', () => {
  it(
    'imports the SDK, builds specs and a couchbase2 cluster without the addon, and loads it on first read',
    async () => {
      const { outcome } = await expectProcessExits<AddonFreeOutcome>(
        join(FIXTURES, 'addonfree.exitfixture.ts'),
        { withinMs: EXIT_BUDGET_MS }
      )
      expect(outcome.refusedOnImport).toBe(0)
      expect(outcome.refusedOnSpecs).toBe(0)
      expect(outcome.couchbase2).toEqual({
        connectError: undefined,
        connError: 'FeatureNotAvailableError',
        closeError: undefined,
        refused: 0,
      })
      expect(outcome.exports).toBeGreaterThan(0)
      expect(outcome.useError?.name).toBe('CouchbaseError')
      expect(outcome.useError?.message).toContain('native addon')
      expect(outcome.useError?.message).toContain('cbppVersion')
    },
    TEST_TIMEOUT_MS
  )
})
