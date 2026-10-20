import { describe, expect, it } from 'vitest'

import { watchRejections } from '../infra/rejections'

/**
 * The listener list matters more than the counts: a watch that fails to put
 * Vitest's listener back leaves every later unhandled rejection unreported.
 */
function listeners(): unknown[] {
  return [
    ...process.listeners('unhandledRejection'),
    ...process.listeners('rejectionHandled'),
  ]
}

describe('watchRejections', () => {
  it('counts a rejection nobody handled, and keeps the reason', async () => {
    await watchRejections(async (rejections) => {
      const reason = new Error('nobody is listening')
      Promise.reject(reason)

      expect(await rejections.settle()).toBe(1)
      expect(rejections.reasons).toEqual([reason])
    })
  })

  it('counts nothing when the rejection is handled in time', async () => {
    await watchRejections(async (rejections) => {
      await expect(Promise.reject(new Error('caught'))).rejects.toThrow(
        'caught'
      )

      expect(await rejections.settle()).toBe(0)
    })
  })

  it('reports a running total, so it can be read more than once', async () => {
    await watchRejections(async (rejections) => {
      Promise.reject(new Error('first'))
      expect(await rejections.settle()).toBe(1)

      Promise.reject(new Error('second'))
      expect(await rejections.settle()).toBe(2)
    })
  })

  it('counts a rejection that is only handled later', async () => {
    await watchRejections(async (rejections) => {
      const rejected = Promise.reject(new Error('late'))

      // Unhandled at the end of its own tick, which is the moment Node decides.
      expect(await rejections.settle()).toBe(1)

      await expect(rejected).rejects.toThrow('late')
      // Handling it afterwards neither retracts the count nor warns: the
      // watch owns that event too while open.
      expect(rejections.reasons).toHaveLength(1)
    })
  })

  it('puts back exactly the listeners it displaced', async () => {
    const before = listeners()
    expect(before.length).toBeGreaterThan(0)

    await watchRejections(async (rejections) => {
      expect(process.listeners('unhandledRejection')).toHaveLength(1)
      expect(rejections.reasons).toHaveLength(0)
    })

    expect(listeners()).toEqual(before)
  })

  it('puts them back when the body throws', async () => {
    const before = listeners()

    await expect(
      watchRejections(async () => {
        throw new Error('the body failed')
      })
    ).rejects.toThrow('the body failed')

    expect(listeners()).toEqual(before)
    // And the watch is closed, not merely unwound: a failed test must not stop
    // the next one from opening a watch of its own.
    await watchRejections(async (rejections) => {
      expect(await rejections.settle()).toBe(0)
    })
  })

  it('refuses to nest', async () => {
    await watchRejections(async () => {
      await expect(watchRejections(async () => undefined)).rejects.toThrow(
        /already open/
      )
    })

    // The refusal must not have closed the outer watch's window on its way out.
    await watchRejections(async (rejections) => {
      Promise.reject(new Error('still counted'))
      expect(await rejections.settle()).toBe(1)
    })
  })
})
