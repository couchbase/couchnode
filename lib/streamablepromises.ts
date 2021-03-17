/* eslint jsdoc/require-jsdoc: off */
import EventEmitter from 'events'

/**
 * @internal
 */
type PromisifyFunc<T> = (
  emitter: StreamablePromise<T>,
  resolve: (result: T) => void,
  reject: (err: Error) => void
) => void

/**
 * @internal
 */
export class StreamablePromise<T> extends EventEmitter implements Promise<T> {
  private _promise: Promise<T> | null = null
  private _promiseifyFn: PromisifyFunc<T>

  /**
   * @internal
   */
  constructor(promisefyFn: PromisifyFunc<T>) {
    super()

    this._promiseifyFn = promisefyFn
  }

  private get promise(): Promise<T> {
    if (!this._promise) {
      this._promise = new Promise((resolve, reject) =>
        this._promiseifyFn(this, resolve, reject)
      )
    }
    return this._promise
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

  /**
   * @internal
   */
  get [Symbol.toStringTag](): string {
    return (Promise as any)[Symbol.toStringTag]
  }
}

/**
 * Provides the ability to be used as both a promise, or an event emitter.  Enabling
 * an application to easily retrieve all results using async/await, while also enabling
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
 * Provides the ability to be used as both a promise, or an event emitter.  Enabling
 * an application to easily retrieve all results using async/await, while also enabling
 * streaming of results by listening for the replica event.
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
