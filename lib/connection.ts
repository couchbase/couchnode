/* eslint jsdoc/require-jsdoc: off */
import binding, { CppConnection, CppError } from './binding'
import { errorFromCpp } from './bindingutilities'

// We need this small type-utility to ensure that the labels on the parameter
// tuple actually get transferred during the merge (typescript bug).
type MergeArgs<A, B> = A extends [...infer Params]
  ? [...Params, ...(B extends [...infer Params2] ? Params2 : [])]
  : never

// This type takes a function as input from the CppConnection and then adjusts
// the callback to be of type (Error | null) as opposed to (CppError | null).
// It is used to adjust the return types of Connection to reflect that the error
// has already been translated from a CppError to CouchbaseError.
type CppCbToNew<T extends (...fargs: any[]) => void> = T extends (
  ...fargs: [
    ...infer FArgs,
    (err: CppError | null, ...cbArgs: infer CbArgs) => void
  ]
) => void
  ? [
      ...fargs: MergeArgs<
        FArgs,
        [callback: (err: Error | null, ...cbArgs: CbArgs) => void]
      >
    ]
  : never

export class Connection {
  private _inst: CppConnection

  constructor() {
    this._inst = new binding.Connection()
  }

  get inst(): CppConnection {
    return this._inst
  }

  connect(
    ...args: CppCbToNew<CppConnection['connect']>
  ): ReturnType<CppConnection['connect']> {
    return this._proxyToConn(this._inst, this._inst.connect, ...args)
  }

  openBucket(
    ...args: CppCbToNew<CppConnection['openBucket']>
  ): ReturnType<CppConnection['openBucket']> {
    return this._proxyToConn(this._inst, this._inst.openBucket, ...args)
  }

  shutdown(
    ...args: CppCbToNew<CppConnection['shutdown']>
  ): ReturnType<CppConnection['shutdown']> {
    return this._proxyToConn(this._inst, this._inst.shutdown, ...args)
  }

  get(
    ...args: CppCbToNew<CppConnection['get']>
  ): ReturnType<CppConnection['get']> {
    return this._proxyToConn(this._inst, this._inst.get, ...args)
  }

  exists(
    ...args: CppCbToNew<CppConnection['exists']>
  ): ReturnType<CppConnection['exists']> {
    return this._proxyToConn(this._inst, this._inst.exists, ...args)
  }

  getAndLock(
    ...args: CppCbToNew<CppConnection['getAndLock']>
  ): ReturnType<CppConnection['getAndLock']> {
    return this._proxyToConn(this._inst, this._inst.getAndLock, ...args)
  }

  getAndTouch(
    ...args: CppCbToNew<CppConnection['getAndTouch']>
  ): ReturnType<CppConnection['getAndTouch']> {
    return this._proxyToConn(this._inst, this._inst.getAndTouch, ...args)
  }

  insert(
    ...args: CppCbToNew<CppConnection['insert']>
  ): ReturnType<CppConnection['insert']> {
    return this._proxyToConn(this._inst, this._inst.insert, ...args)
  }

  upsert(
    ...args: CppCbToNew<CppConnection['upsert']>
  ): ReturnType<CppConnection['upsert']> {
    return this._proxyToConn(this._inst, this._inst.upsert, ...args)
  }

  replace(
    ...args: CppCbToNew<CppConnection['replace']>
  ): ReturnType<CppConnection['replace']> {
    return this._proxyToConn(this._inst, this._inst.replace, ...args)
  }

  remove(
    ...args: CppCbToNew<CppConnection['remove']>
  ): ReturnType<CppConnection['remove']> {
    return this._proxyToConn(this._inst, this._inst.remove, ...args)
  }

  touch(
    ...args: CppCbToNew<CppConnection['touch']>
  ): ReturnType<CppConnection['touch']> {
    return this._proxyToConn(this._inst, this._inst.touch, ...args)
  }

  unlock(
    ...args: CppCbToNew<CppConnection['unlock']>
  ): ReturnType<CppConnection['unlock']> {
    return this._proxyToConn(this._inst, this._inst.unlock, ...args)
  }

  append(
    ...args: CppCbToNew<CppConnection['append']>
  ): ReturnType<CppConnection['append']> {
    return this._proxyToConn(this._inst, this._inst.append, ...args)
  }

  prepend(
    ...args: CppCbToNew<CppConnection['prepend']>
  ): ReturnType<CppConnection['prepend']> {
    return this._proxyToConn(this._inst, this._inst.prepend, ...args)
  }

  increment(
    ...args: CppCbToNew<CppConnection['increment']>
  ): ReturnType<CppConnection['increment']> {
    return this._proxyToConn(this._inst, this._inst.increment, ...args)
  }

  decrement(
    ...args: CppCbToNew<CppConnection['decrement']>
  ): ReturnType<CppConnection['decrement']> {
    return this._proxyToConn(this._inst, this._inst.decrement, ...args)
  }

  lookupIn(
    ...args: CppCbToNew<CppConnection['lookupIn']>
  ): ReturnType<CppConnection['lookupIn']> {
    return this._proxyToConn(this._inst, this._inst.lookupIn, ...args)
  }

  mutateIn(
    ...args: CppCbToNew<CppConnection['mutateIn']>
  ): ReturnType<CppConnection['mutateIn']> {
    return this._proxyToConn(this._inst, this._inst.mutateIn, ...args)
  }

  viewQuery(
    ...args: CppCbToNew<CppConnection['viewQuery']>
  ): ReturnType<CppConnection['viewQuery']> {
    return this._proxyToConn(this._inst, this._inst.viewQuery, ...args)
  }

  query(
    ...args: CppCbToNew<CppConnection['query']>
  ): ReturnType<CppConnection['query']> {
    return this._proxyToConn(this._inst, this._inst.query, ...args)
  }

  analyticsQuery(
    ...args: CppCbToNew<CppConnection['analyticsQuery']>
  ): ReturnType<CppConnection['analyticsQuery']> {
    return this._proxyToConn(this._inst, this._inst.analyticsQuery, ...args)
  }

  searchQuery(
    ...args: CppCbToNew<CppConnection['searchQuery']>
  ): ReturnType<CppConnection['searchQuery']> {
    return this._proxyToConn(this._inst, this._inst.searchQuery, ...args)
  }

  httpRequest(
    ...args: CppCbToNew<CppConnection['httpRequest']>
  ): ReturnType<CppConnection['httpRequest']> {
    return this._proxyToConn(this._inst, this._inst.httpRequest, ...args)
  }

  diagnostics(
    ...args: CppCbToNew<CppConnection['diagnostics']>
  ): ReturnType<CppConnection['diagnostics']> {
    return this._proxyToConn(this._inst, this._inst.diagnostics, ...args)
  }

  ping(
    ...args: CppCbToNew<CppConnection['ping']>
  ): ReturnType<CppConnection['ping']> {
    return this._proxyToConn(this._inst, this._inst.ping, ...args)
  }

  private _proxyToConn<FArgs extends any[], CbArgs extends any[]>(
    thisArg: CppConnection,
    fn: (
      ...cppArgs: [
        ...FArgs,
        (...cppCbArgs: [CppError | null, ...CbArgs]) => void
      ]
    ) => void,
    ...newArgs: [...FArgs, (...newCbArgs: [Error | null, ...CbArgs]) => void]
  ) {
    const argsManip = newArgs
    const callback = argsManip.pop() as (
      ...cbArgs: [Error | null, ...CbArgs]
    ) => void

    argsManip.push((err: CppError | null, ...cbArgs: CbArgs) => {
      const translatedErr = errorFromCpp(err)
      callback.apply(undefined, [translatedErr, ...cbArgs])
    })

    const wrappedArgs = argsManip as [
      ...FArgs,
      (err: CppError | null, ...cbArgs: CbArgs) => void
    ]
    fn.apply(thisArg, wrappedArgs)
  }
}
