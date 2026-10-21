import { describe, expect, it } from 'vitest'

import binding, { type CppError } from '../../../lib/binding'
import { errorFromCpp } from '../../../lib/bindingutilities'
import { RequestCanceledError } from '../../../lib/errors'

// An operation whose native handler is destroyed without being called. The
// callback would otherwise never run, and the operation's promise would never
// settle.

/** Long enough for a second, wrongly queued call to arrive. */
const SECOND_CALL_WAIT_MS = 200

describe('dropped callback', () => {
  it('completes once with RequestCanceledError', async () => {
    const conn = new binding.Connection()
    try {
      const calls: (CppError | null)[] = []
      const first = new Promise<CppError | null>((resolve) => {
        conn._dropCallback((err) => {
          calls.push(err)
          resolve(err)
        })
      })
      expect(errorFromCpp(await first)).toBeInstanceOf(RequestCanceledError)
      await new Promise((resolve) => setTimeout(resolve, SECOND_CALL_WAIT_MS))
      expect(calls).toHaveLength(1)
    } finally {
      await new Promise<void>((resolve) => conn.shutdown(() => resolve()))
    }
  })
})
