import { describe, expect, it } from 'vitest'

import { NodeCallback, PromiseHelper } from '../../../lib/utilities'
import { watchRejections } from '../../infra/rejections'

interface Seen<T> {
  success: number
  error: number
  res?: T | null
  err?: Error | null
}

/**
 * A node-style callback that counts what it was handed, by truthiness, as a
 * real caller would test it.
 */
function recorder<T>(): { seen: Seen<T>; callback: NodeCallback<T> } {
  const seen: Seen<T> = { success: 0, error: 0 }
  const callback: NodeCallback<T> = (err, res) => {
    if (err) {
      seen.error++
      seen.err = err
    }
    if (res) {
      seen.success++
      seen.res = res
    }
  }
  return { seen, callback }
}

// `PromiseHelper` bridges callbacks onto promises, so what is under test is
// which rejections stay handled. Each test takes over the unhandled rejection
// listener for its duration and asserts on the count.
describe('#utilities', () => {
  describe('#promisehelper', () => {
    it('should wrap function and return resolved promise', async () => {
      await watchRejections(async (rejections) => {
        let calls = 0
        const res = await PromiseHelper.wrap<string>((cb) => {
          calls++
          cb(null, 'Success!')
        })

        expect(res).toBe('Success!')
        expect(calls).toBe(1)
        expect(await rejections.settle()).toBe(0)
      })
    })

    it('should wrap function and return rejected promise', async () => {
      await watchRejections(async (rejections) => {
        let calls = 0
        await expect(
          PromiseHelper.wrap<string>((cb) => {
            calls++
            cb(new Error('Oh no!!'), null)
          })
        ).rejects.toThrow('Oh no!!')

        expect(calls).toBe(1)
        expect(await rejections.settle()).toBe(0)
      })
    })

    it('should wrap function and pass resolved promise result to callback', async () => {
      await watchRejections(async (rejections) => {
        const { seen, callback } = recorder<string>()

        PromiseHelper.wrap<string>((cb) => cb(null, 'Success!'), callback)

        expect(await rejections.settle()).toBe(0)
        expect(seen.res).toBe('Success!')
        expect(seen.err).toBeUndefined()
        expect(seen.success).toBe(1)
        expect(seen.error).toBe(0)
      })
    })

    it('should wrap function and pass rejected promise result to callback', async () => {
      await watchRejections(async (rejections) => {
        const { seen, callback } = recorder<string>()

        PromiseHelper.wrap<string>(
          (cb) => cb(new Error('Oh no!!'), null),
          callback
        )

        // Zero: attaching the callback keeps the rejection handled.
        expect(await rejections.settle()).toBe(0)
        expect(seen.err).toBeInstanceOf(Error)
        expect(seen.err?.message).toBe('Oh no!!')
        expect(seen.res).toBeUndefined()
        expect(seen.success).toBe(0)
        expect(seen.error).toBe(1)
      })
    })

    it('should wrap function and handle callback that throws uncaught error', async () => {
      await watchRejections(async (rejections) => {
        const seen = { success: 0, error: 0 }
        const callback: NodeCallback<object> = (err, res) => {
          if (err) {
            seen.error++
          }
          if (res) {
            seen.success++
            throw new Error('Oops!')
          }
        }

        PromiseHelper.wrap<object>((cb) => cb(null, seen), callback)

        // A throw from the callback lands on a promise nothing can handle:
        // documented as an unhandled rejection.
        expect(await rejections.settle()).toBe(1)
        expect(seen.success).toBe(1)
        expect(seen.error).toBe(0)
      })
    })

    it('should wrap function and and allow continued execution', async () => {
      await watchRejections(async (rejections) => {
        const seen = { success: 0, error: 0 }
        const callback: NodeCallback<object> = (err, res) => {
          if (err) {
            seen.error++
            PromiseHelper.wrap<object>((cb) => cb(null, seen), callback)
          }
          if (res) {
            seen.success++
          }
        }

        PromiseHelper.wrap<object>(
          (cb) => cb(new Error('Oh no!!'), null),
          callback
        )

        expect(await rejections.settle()).toBe(0)
        expect(seen.success).toBe(1)
        expect(seen.error).toBe(1)
      })
    })
  })

  describe('#promisehelperasync', () => {
    it('should wrapAsync function and return resolved promise', async () => {
      await watchRejections(async (rejections) => {
        let calls = 0
        const res = await PromiseHelper.wrapAsync(() => {
          calls++
          return Promise.resolve('Success!')
        })

        expect(res).toBe('Success!')
        expect(calls).toBe(1)
        expect(await rejections.settle()).toBe(0)
      })
    })

    it('should wrapAsync function and return rejected promise', async () => {
      await watchRejections(async (rejections) => {
        let calls = 0
        await expect(
          PromiseHelper.wrapAsync(() => {
            calls++
            return Promise.reject(new Error('Oh no!!'))
          })
        ).rejects.toThrow('Oh no!!')

        expect(calls).toBe(1)
        expect(await rejections.settle()).toBe(0)
      })
    })

    it('should wrapAsync function and pass resolved promise result to callback', async () => {
      await watchRejections(async (rejections) => {
        const { seen, callback } = recorder<string>()

        PromiseHelper.wrapAsync(() => Promise.resolve('Success!'), callback)

        expect(await rejections.settle()).toBe(0)
        expect(seen.res).toBe('Success!')
        expect(seen.err).toBeUndefined()
        expect(seen.success).toBe(1)
        expect(seen.error).toBe(0)
      })
    })

    it('should wrapAsync function and pass rejected promise result to callback', async () => {
      await watchRejections(async (rejections) => {
        const { seen, callback } = recorder<string>()

        PromiseHelper.wrapAsync(
          () => Promise.reject(new Error('Oh no!!')),
          callback
        )

        expect(await rejections.settle()).toBe(0)
        expect(seen.err).toBeInstanceOf(Error)
        expect(seen.err?.message).toBe('Oh no!!')
        expect(seen.res).toBeUndefined()
        expect(seen.success).toBe(0)
        expect(seen.error).toBe(1)
      })
    })

    it('should wrapAsync function and handle callback that throws uncaught error', async () => {
      await watchRejections(async (rejections) => {
        const seen = { success: 0, error: 0 }
        const callback: NodeCallback<string> = (err, res) => {
          if (err) {
            seen.error++
          }
          if (res) {
            seen.success++
            throw new Error('Oops!')
          }
        }

        PromiseHelper.wrapAsync(() => Promise.resolve('Success!'), callback)

        expect(await rejections.settle()).toBe(1)
        expect(seen.success).toBe(1)
        expect(seen.error).toBe(0)
      })
    })

    it('should wrapAsync function and allow continued execution', async () => {
      await watchRejections(async (rejections) => {
        const seen = { success: 0, error: 0 }
        const callback: NodeCallback<string> = (err, res) => {
          if (err) {
            seen.error++
            PromiseHelper.wrapAsync(() => Promise.resolve('Success!'), callback)
          }
          if (res) {
            seen.success++
          }
        }

        PromiseHelper.wrapAsync(
          () => Promise.reject(new Error('Oh no!!')),
          callback
        )

        expect(await rejections.settle()).toBe(0)
        expect(seen.success).toBe(1)
        expect(seen.error).toBe(1)
      })
    })
  })
})
