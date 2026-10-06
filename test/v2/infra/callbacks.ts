// An assertion thrown inside an SDK callback escapes into the SDK's own promise
// chain and the test reports a bare timeout. These helpers still call the SDK
// through its callback overload, but hand back a promise so the assertions
// stay in the test body.

import { NodeCallback } from '../../../lib/utilities'

export interface Settled<T> {
  readonly err: Error | null
  readonly res: T | null
}

/**
 * Typed to satisfy an options parameter as well as a callback one. Every
 * `Collection` method accepts the callback in the options position, but no
 * signature describes it, so `collection.get(key, cb)` does not typecheck
 * even though it runs (@FINDING(JSCBC-1462)). Passing an explicit `undefined`
 * instead would stop exercising that argument shuffle. Both added fields are
 * `never`, so no wrong options object typechecks.
 */
export type CallbackArg<T> = NodeCallback<T> & {
  // TypeScript's weak type check needs one shared property, and `timeout` is
  // on every KV options interface. `never` supplies no value.
  readonly timeout?: never
  // The same for `WaitUntilReadyOptions`, the one options interface with no
  // `timeout` (its timeout is positional).
  readonly desiredState?: never
}

/**
 * Rejects with the SDK's own typed error, so the serializer renders its
 * context as it would for the promise overload.
 */
export function awaitCallback<T>(
  op: (callback: CallbackArg<T>) => unknown
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    op(((err: Error | null, res: T | null) => {
      if (err) {
        reject(err)
        return
      }
      resolve(res as T)
    }) as CallbackArg<T>)
  })
}

/**
 * Resolves with both callback arguments whether or not `err` is set, for
 * tests whose subject is the error itself.
 */
export function settleCallback<T>(
  op: (callback: CallbackArg<T>) => unknown
): Promise<Settled<T>> {
  return new Promise<Settled<T>>((resolve) => {
    op(((err: Error | null, res: T | null) => {
      resolve({ err, res })
    }) as CallbackArg<T>)
  })
}
