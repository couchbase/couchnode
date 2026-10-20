import { describe, expect, it } from 'vitest'

import {
  PollAbortedError,
  PollTimeoutError,
  pollUntil,
  sleep,
  tryNTimes,
} from '../infra/retry'

describe('pollUntil', () => {
  it('returns the first defined value', async () => {
    let calls = 0
    const result = await pollUntil(
      'a value',
      async () => (++calls < 3 ? undefined : 'ready'),
      { deadlineMs: 1_000, intervalMs: 1 }
    )
    expect(result).toBe('ready')
    expect(calls).toBe(3)
  })

  it('fails on deadline naming what it waited for and what it last saw', async () => {
    // An unsatisfiable condition must end in an error, not spin forever.
    const err = await pollUntil(
      'the index to build',
      async (ctx) => {
        ctx.note('index reported 3 of 9 documents')
        return undefined
      },
      { deadlineMs: 30, intervalMs: 5 }
    ).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(PollTimeoutError)
    expect((err as Error).message).toContain('the index to build')
    expect((err as Error).message).toContain('index reported 3 of 9 documents')
  })

  it('stops when the signal fires, instead of outliving its test', async () => {
    const controller = new AbortController()
    let calls = 0
    const pending = pollUntil(
      'something that never happens',
      async () => {
        calls += 1
        return undefined
      },
      { deadlineMs: 10_000, intervalMs: 5, signal: controller.signal }
    )

    await sleep(20)
    controller.abort()
    await expect(pending).rejects.toBeInstanceOf(PollAbortedError)

    const seen = calls
    await sleep(30)
    // Nothing kept running after the abort.
    expect(calls).toBe(seen)
  })

  it('propagates an error by default rather than swallowing it', async () => {
    await expect(
      pollUntil(
        'a failing check',
        async () => {
          throw new Error('boom')
        },
        { deadlineMs: 50, intervalMs: 5 }
      )
    ).rejects.toThrow('boom')
  })

  it('retries through errors when asked, and reports the last one', async () => {
    const err = await pollUntil(
      'a flaky check',
      async () => {
        throw new Error('still warming up')
      },
      { deadlineMs: 30, intervalMs: 5, retryErrors: true }
    ).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(PollTimeoutError)
    expect((err as Error).message).toContain('still warming up')
  })
})

describe('tryNTimes', () => {
  it('returns the first success', async () => {
    let calls = 0
    const result = await tryNTimes(3, 1, async () => {
      if (++calls < 2) {
        throw new Error('not yet')
      }
      return 'ok'
    })
    expect(result).toBe('ok')
    expect(calls).toBe(2)
  })

  it('throws the last error rather than returning undefined', async () => {
    await expect(
      tryNTimes(2, 1, async () => {
        throw new Error('always fails')
      })
    ).rejects.toThrow('always fails')
  })
})
