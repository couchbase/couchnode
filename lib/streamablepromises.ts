/* eslint jsdoc/require-jsdoc: off */
import EventEmitter from 'events'

/**
 * @internal
 */
type ListenerFunc = (...args: any[]) => void

/**
 * @internal
 */
interface PromisifyEmitter {
  on(eventName: string | symbol, listener: ListenerFunc): void
}

/**
 * @internal
 */
type PromisifyFunc<T> = (
  emitter: PromisifyEmitter,
  resolve: (result: T) => void,
  reject: (err: Error) => void
) => void

/**
 * @internal
 */
export class StreamablePromise<T> extends EventEmitter implements Promise<T> {
  private _promise: Promise<T> | null = null
  private _promiseOns: [string | symbol, ListenerFunc][]

  /**
   * @internal
   */
  constructor(promisefyFn: PromisifyFunc<T>) {
    super()

    this._promiseOns = []
    this._promise = new Promise((resolve, reject) => {
      promisefyFn(
        {
          on: (eventName: string | symbol, listener: ListenerFunc) => {
            this._promiseOns.push([eventName, listener])
            super.on(eventName, listener)
          },
        },
        resolve,
        reject
      )
    })
  }

  private get promise(): Promise<T> {
    if (!this._promise) {
      throw new Error(
        'Cannot await a promise that is already registered for events'
      )
    }
    return this._promise
  }

  private _depromisify() {
    this._promiseOns.forEach((e) => this.off(...e))
    this._promise = null
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    return this.promise.then<TResult1, TResult2>(onfulfilled, onrejected)
  }

  catch<TResult = never>(
    onrejected?:
      | ((reason: any) => TResult | PromiseLike<TResult>)
      | undefined
      | null
  ): Promise<T | TResult> {
    return this.promise.catch<TResult>(onrejected)
  }

  finally(onfinally?: (() => void) | undefined | null): Promise<T> {
    return this.promise.finally(onfinally)
  }

  addListener(eventName: string | symbol, listener: ListenerFunc): this {
    this._depromisify()
    return super.on(eventName, listener)
  }

  on(eventName: string | symbol, listener: ListenerFunc): this {
    this._depromisify()
    return super.on(eventName, listener)
  }

  /**
   * @internal
   */
  get [Symbol.toStringTag](): string {
    return (Promise as any)[Symbol.toStringTag]
  }
}

/**
 * Provides the ability to be used as either a promise or an event emitter.  Enabling
 * an application to easily retrieve all results using async/await or enabling
 * streaming of results by listening for the row and meta events.
 */
export class StreamableRowPromise<T, TRow, TMeta> extends StreamablePromise<T> {
  constructor(fn: (rows: TRow[], meta: TMeta) => T) {
    super((emitter, resolve, reject) => {
      let err: Error | undefined
      const rows: TRow[] = []
      let meta: TMeta | undefined

      emitter.on('row', (r) => rows.push(r))
      emitter.on('meta', (m) => (meta = m))
      emitter.on('error', (e) => (err = e))
      emitter.on('end', () => {
        if (err) {
          return reject(err)
        }

        resolve(fn(rows, meta as TMeta))
      })
    })
  }
}

/**
 * Provides the ability to be used as either a promise or an event emitter.  Enabling
 * an application to easily retrieve all replicas using async/await or enabling
 * streaming of replicas by listening for the replica event.
 */
export class StreamableReplicasPromise<T, TRep> extends StreamablePromise<T> {
  constructor(fn: (replicas: TRep[]) => T) {
    super((emitter, resolve, reject) => {
      let err: Error | undefined
      const replicas: TRep[] = []

      emitter.on('replica', (r) => replicas.push(r))
      emitter.on('error', (e) => (err = e))
      emitter.on('end', () => {
        if (err) {
          return reject(err)
        }

        resolve(fn(replicas))
      })
    })
  }
}

/**
 * Provides the ability to be used as either a promise or an event emitter.  Enabling
 * an application to easily retrieve all scan results using async/await or enabling
 * streaming of scan results by listening for the result event.
 */
export class StreamableScanPromise<T, TRes> extends StreamablePromise<T> {
  private _cancelRequested: boolean

  constructor(fn: (results: TRes[]) => T) {
    super((emitter, resolve, reject) => {
      let err: Error | undefined
      const results: TRes[] = []

      emitter.on('result', (r) => results.push(r))
      emitter.on('error', (e) => (err = e))
      emitter.on('end', () => {
        if (err) {
          return reject(err)
        }

        resolve(fn(results))
      })
    })
    this._cancelRequested = false
  }

  get cancelRequested(): boolean {
    return this._cancelRequested
  }

  cancelStreaming(): void {
    this._cancelRequested = true
  }
}
