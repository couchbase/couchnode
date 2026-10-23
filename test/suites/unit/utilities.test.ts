import { describe, expect, it, vi } from 'vitest'

import {
  NodeCallback,
  PromiseHelper,
  callbackOf,
  optionsOf,
} from '../../../lib/utilities'
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

  // The deprecation warning fires once per process, so each test loads its
  // own copy of the module; the tests above have already tripped the shared
  // one.
  describe('#callbackdeprecation', () => {
    async function freshHelper(): Promise<typeof PromiseHelper> {
      vi.resetModules()
      return (await import('../../../lib/utilities')).PromiseHelper
    }

    async function captureWarnings(
      body: () => Promise<void>
    ): Promise<Error[]> {
      const warnings: Error[] = []
      const listener = (w: Error) => warnings.push(w)
      process.on('warning', listener)
      try {
        await body()
        // emitWarning delivers on the next tick.
        await new Promise((resolve) => setImmediate(resolve))
      } finally {
        process.off('warning', listener)
      }
      return warnings.filter(
        (w) => (w as NodeJS.ErrnoException).code === 'CBJS_DEP_CALLBACK'
      )
    }

    it('should not warn when no callback is given', async () => {
      const helper = await freshHelper()
      const warnings = await captureWarnings(async () => {
        await helper.wrap<string>((cb) => cb(null, 'Success!'))
        await helper.wrapAsync(() => Promise.resolve('Success!'))
      })
      expect(warnings).toHaveLength(0)
    })

    it('should warn once across every callback call', async () => {
      const helper = await freshHelper()
      const { callback } = recorder<string>()
      const warnings = await captureWarnings(async () => {
        await helper.wrap<string>((cb) => cb(null, 'Success!'), callback)
        await helper.wrap<string>((cb) => cb(null, 'Success!'), callback)
        await helper.wrapAsync(() => Promise.resolve('Success!'), callback)
      })
      expect(warnings).toHaveLength(1)
      expect(warnings[0].name).toBe('DeprecationWarning')
      expect(warnings[0].message).toContain('await')
    })

    it('should warn from wrapAsync alone', async () => {
      const helper = await freshHelper()
      const { callback } = recorder<string>()
      const warnings = await captureWarnings(async () => {
        await helper.wrapAsync(() => Promise.resolve('Success!'), callback)
      })
      expect(warnings).toHaveLength(1)
    })
  })

  // The prologue every operation opens with: a callback may sit in the
  // options position, and missing options read as empty.
  describe('#prologue', () => {
    const cb: NodeCallback<string> = () => undefined
    const other: NodeCallback<string> = () => undefined

    it('should take the callback from the options position', () => {
      expect(callbackOf(cb, undefined)).toBe(cb)
      expect(callbackOf(cb, other)).toBe(cb)
    })

    it('should keep the callback argument when options are not a function', () => {
      expect(callbackOf({ timeout: 1 }, other)).toBe(other)
      expect(callbackOf(undefined, other)).toBe(other)
      expect(callbackOf(undefined, undefined)).toBeUndefined()
    })

    it('should pass given options through untouched', () => {
      const options = { timeout: 1 }
      expect(optionsOf(options)).toBe(options)
    })

    it('should substitute empty options for missing ones', () => {
      for (const missing of [undefined, null]) {
        const options = optionsOf<{ timeout?: number }>(
          missing as unknown as undefined
        )
        expect(options).toEqual({})
        expect(options.timeout).toBeUndefined()
      }
    })

    it('should substitute empty options when a callback took their place', () => {
      expect(optionsOf(cb as unknown as { timeout?: number })).toEqual({})
    })

    it('should share one frozen empty options object', () => {
      const a = optionsOf<{ timeout?: number }>(undefined)
      const b = optionsOf<{ timeout?: number }>(undefined)
      expect(a).toBe(b)
      expect(Object.isFrozen(a)).toBe(true)
      expect(() => {
        a.timeout = 1
      }).toThrow(TypeError)
    })
  })
})
