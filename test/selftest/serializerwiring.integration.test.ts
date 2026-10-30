// Checks that the error serializer is actually installed, by reading a real
// failure report.
//
// It needs a child process: the serializer decorates the error the runner
// reports, a plain serialized copy with no prototype, not one a test can catch,
// so nothing inside a passing test proves the wiring works.

import { execFileSync } from 'child_process'
import { join } from 'path'
import { describe, expect, inject, it } from 'vitest'

import { ServerFeature, isClassic, supports } from '../infra/capabilities'
import { packageBin } from '../infra/nodebin'

const state = inject('runState')
const TEST_ROOT = join(import.meta.dirname, '..')

function runFailingFixture(): string {
  try {
    execFileSync(
      process.execPath,
      [
        packageBin('vitest'),
        'run',
        '--config',
        join(TEST_ROOT, 'vitest.fixtures.config.mts'),
      ],
      { cwd: join(TEST_ROOT, '..'), encoding: 'utf8', stdio: 'pipe' }
    )
    throw new Error('the fixture suite was supposed to fail, and did not')
  } catch (err) {
    // A non-zero exit is the expected outcome; the output is what we came for.
    // Anything without an exit status, a process that never started or the
    // error just above, is rethrown so that it reports itself.
    const e = err as { stdout?: string; stderr?: string; status?: unknown }
    if (typeof e.status !== 'number') {
      throw err
    }
    return `${e.stdout ?? ''}${e.stderr ?? ''}`
  }
}

// Needs a target the fixture can actually fail against: with KV gated off (by
// CNFEAT, or by a backend that lacks it) the fixture suite skips instead of
// failing, and there would be no report to read.
const canFail =
  state?.kind === 'ready' &&
  supports(state.capabilities, ServerFeature.KeyValue)

/**
 * Over couchbase2 the context is the gateway's, whatever the operation, and it
 * names the document as one resource rather than field by field.
 */
const GATEWAY = state?.kind === 'ready' && !isClassic(state.capabilities)
const CONTEXT_CLASS = GATEWAY ? 'GenericErrorContext' : 'KeyValueErrorContext'
const DOCUMENT_FIELDS = GATEWAY
  ? [/resource_name=\S+\/\S+/]
  : [/key=\S+/, /bucket=\S+/]

describe.skipIf(!canFail)('the serializer is installed', () => {
  it('reports the context of an error no test asserted on', () => {
    const output = runFailingFixture()

    expect(output).toContain('DocumentNotFoundError')
    expect(output).toContain(`couchbase context (${CONTEXT_CLASS})`)
    // The document the operation was aimed at, and the fields the server
    // supplies.
    for (const field of DOCUMENT_FIELDS) {
      expect(output).toMatch(field)
    }
    expect(output).toMatch(/status_code=\d+/)
    expect(output).toMatch(/last_dispatched_to=\S+/)
  }, 180_000)
})
