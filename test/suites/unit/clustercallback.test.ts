import { describe, expect, it } from 'vitest'

import { Cluster, connect } from '../../../lib/couchbase'
import { watchRejections } from '../../infra/rejections'

/** The private state `Cluster.close` reads, which the stub fills in by hand. */
interface ClosingState {
  _openQueryStreams: Set<unknown>
  _transactions?: { _close: () => Promise<void> }
  _conn: { shutdown: (cb: (err: Error | null) => void) => void }
  _closing?: boolean
}

// These tests need no server. A connect fails in the Cluster constructor before
// anything reaches the binding, and a close runs against a stubbed connection
// and transactions object. What is under test is that each failure reaches the
// callback without also escaping as an unhandled rejection.
describe('#cluster callbacks', () => {
  const failure = new Error('close failed')

  // An unregistered profile makes the Cluster constructor throw.
  const connects: { name: string; fn: typeof connect }[] = [
    { name: 'Cluster.connect', fn: Cluster.connect },
    { name: 'connect', fn: connect },
  ]
  const badProfile = /unregistered is not a registered profile/

  for (const t of connects) {
    const call = (cb: (err: Error | null) => void) =>
      t.fn('couchbase://localhost', { configProfile: 'unregistered' }, cb)

    it(`${t.name} reports a failure through the callback only`, async () => {
      await watchRejections(async (rejections) => {
        const callbackError = await new Promise<Error | null>((resolve) => {
          void call(resolve)
        })

        expect(callbackError?.message).toMatch(badProfile)
        expect(await rejections.settle()).toBe(0)
      })
    })

    it(`${t.name} still rejects the promise it returns`, async () => {
      await watchRejections(async (rejections) => {
        await expect(call(() => {})).rejects.toThrow(badProfile)

        expect(await rejections.settle()).toBe(0)
      })
    })
  }

  // Cluster.close cancels open query streams and waits for transactions to
  // close before it shuts down the connection, so a failure in either has to
  // reach the callback as well.
  function closingCluster(
    closeTransactions: () => Promise<void>,
    openQueryStreams: unknown[] = []
  ): { cluster: Cluster; state: ClosingState } {
    const cluster = Object.create(Cluster.prototype) as Cluster
    const state = cluster as unknown as ClosingState
    state._openQueryStreams = new Set(openQueryStreams)
    state._transactions = { _close: closeTransactions }
    state._conn = { shutdown: (cb) => cb(null) }
    return { cluster, state }
  }

  it('Cluster.close reports a failure through the callback only', async () => {
    await watchRejections(async (rejections) => {
      const { cluster } = closingCluster(() => Promise.reject(failure))
      let callbackError: Error | null | undefined
      void cluster.close((err) => {
        callbackError = err
      })

      expect(await rejections.settle()).toBe(0)
      expect(callbackError).toBe(failure)
    })
  })

  it('Cluster.close still rejects the promise it returns', async () => {
    await watchRejections(async (rejections) => {
      const { cluster } = closingCluster(() => Promise.reject(failure))

      await expect(cluster.close(() => {})).rejects.toBe(failure)
      expect(await rejections.settle()).toBe(0)
    })
  })

  it('Cluster.close succeeds through the callback and the promise', async () => {
    await watchRejections(async (rejections) => {
      const { cluster, state } = closingCluster(() => Promise.resolve())
      let callbackError: Error | null | undefined
      await cluster.close((err) => {
        callbackError = err
      })

      expect(await rejections.settle()).toBe(0)
      expect(callbackError).toBeNull()
      expect(state._transactions).toBeUndefined()
    })
  })

  it('Cluster.close reports a stream cancel failure through the callback only', async () => {
    await watchRejections(async (rejections) => {
      const stream = {
        cancel: () => {
          throw failure
        },
        ended: Promise.resolve(),
      }
      const { cluster, state } = closingCluster(
        () => Promise.resolve(),
        [stream]
      )
      let callbackError: Error | null | undefined
      void cluster.close((err) => {
        callbackError = err
      })

      expect(await rejections.settle()).toBe(0)
      expect(callbackError).toBe(failure)
      expect(state._closing).toBe(true)
    })
  })

  // Only the internal helpers, which take no callback, may stay async.
  it('declares only the callback-free helpers async', () => {
    const methods = Object.getOwnPropertyNames(Cluster.prototype)
      .filter((name) => {
        const desc = Object.getOwnPropertyDescriptor(Cluster.prototype, name)
        return (
          desc?.value instanceof Function &&
          desc.value.constructor.name === 'AsyncFunction'
        )
      })
      .map((name) => `Cluster.${name}`)
    for (const t of connects) {
      if (t.fn.constructor.name === 'AsyncFunction') {
        methods.push(t.name)
      }
    }

    expect(methods.sort()).toEqual([
      'Cluster._cancelQueryStreams',
      'Cluster._connect',
    ])
  })
})
