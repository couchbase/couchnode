import { Collection } from './collection'
import { CouchbaseError, PathExistsError, PathInvalidError } from './errors'
import { StoreSemantics } from './generaltypes'
import { ObservableRequestHandler, WrappedSpan } from './observabilityhandler'
import { DatastructureOp } from './observabilitytypes'
import { LookupInSpec, MutateInSpec } from './sdspecs'
import { RequestSpan } from './tracing'
import { NodeCallback, PromiseHelper } from './utilities'

/**
 * CouchbaseList provides a simplified interface for storing lists
 * within a Couchbase document.
 *
 * @see {@link Collection.list}
 * @category Datastructures
 */
export class CouchbaseList {
  private _coll: Collection
  private _key: string

  /**
   * @internal
   */
  constructor(collection: Collection, key: string) {
    this._coll = collection
    this._key = key
  }

  private async _get(parentSpan?: WrappedSpan): Promise<any[]> {
    const doc = await this._coll.get(this._key, { parentSpan: parentSpan })
    if (!(doc.content instanceof Array)) {
      throw new CouchbaseError('expected document of array type')
    }

    return doc.content
  }

  /**
   * Returns the entire list of items in this list.
   *
   * @param callback A node-style callback to be invoked after execution.
   */
  async getAll(callback?: NodeCallback<any[]>): Promise<any[]> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.ListGetAll,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))

    return PromiseHelper.wrapAsync(async () => {
      try {
        const res = await this._get(obsReqHandler.wrappedSpan)
        obsReqHandler.end()
        return res
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }

  /**
   * Iterates each item in the list.
   *
   * @param rowCallback A callback invoked for each item in the list.
   * @param callback A node-style callback to be invoked after execution.
   */
  async forEach(
    rowCallback: (value: any, index: number, array: CouchbaseList) => void,
    callback?: NodeCallback<void>
  ): Promise<void> {
    return PromiseHelper.wrapAsync(async () => {
      const values = await this._get()
      for (let i = 0; i < values.length; ++i) {
        rowCallback(values[i], i, this)
      }
    }, callback)
  }

  /**
   * Provides the ability to async-for loop this object.
   */
  [Symbol.asyncIterator](): AsyncIterator<any> {
    const getNext = async () => this._get()
    return {
      data: null as null | any[],
      index: -1,
      async next() {
        if (this.index < 0) {
          this.data = await getNext()
          this.index = 0
        }

        const data = this.data as any[]
        if (this.index < data.length) {
          return { done: false, value: data[this.index++] }
        }

        return { done: true }
      },
    } as any
  }

  /**
   * Retrieves the item at a specific index in the list.
   *
   * @param index The index to retrieve.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getAt(index: number, callback?: NodeCallback<any>): Promise<any> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.ListGetAt,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))

    return PromiseHelper.wrapAsync(async () => {
      try {
        const res = await this._coll.lookupIn(
          this._key,
          [LookupInSpec.get('[' + index + ']')],
          { parentSpan: obsReqHandler.wrappedSpan }
        )

        const itemRes = res.content[0]
        if (itemRes.error) {
          throw itemRes.error
        }

        obsReqHandler.end()
        return itemRes.value
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }

  /**
   * Removes an item at a specific index from the list.
   *
   * @param index The index to remove.
   * @param callback A node-style callback to be invoked after execution.
   */
  async removeAt(index: number, callback?: NodeCallback<void>): Promise<void> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.ListRemoveAt,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))

    return PromiseHelper.wrapAsync(async () => {
      try {
        await this._coll.mutateIn(
          this._key,
          [MutateInSpec.remove('[' + index + ']')],
          { parentSpan: obsReqHandler.wrappedSpan }
        )
        obsReqHandler.end()
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }

  /**
   * Returns the index of a specific value from the list.
   *
   * @param value The value to search for.
   * @param callback A node-style callback to be invoked after execution.
   */
  async indexOf(value: any, callback?: NodeCallback<number>): Promise<number> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.ListIndexOf,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))

    return PromiseHelper.wrapAsync(async () => {
      try {
        const items = await this._get(obsReqHandler.wrappedSpan)

        for (let i = 0; i < items.length; ++i) {
          if (items[i] === value) {
            obsReqHandler.end()
            return i
          }
        }

        obsReqHandler.end()
        return -1
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }

  /**
   * Returns the number of items in the list.
   *
   * @param callback A node-style callback to be invoked after execution.
   */
  async size(callback?: NodeCallback<number>): Promise<number> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.ListSize,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))

    return PromiseHelper.wrapAsync(async () => {
      try {
        const res = await this._coll.lookupIn(
          this._key,
          [LookupInSpec.count('')],
          { parentSpan: obsReqHandler.wrappedSpan }
        )
        obsReqHandler.end()
        return res.content[0].value
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }

  /**
   * Adds a new item to the end of the list.
   *
   * @param value The value to add.
   * @param callback A node-style callback to be invoked after execution.
   */
  async push(value: any, callback?: NodeCallback<void>): Promise<void> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.ListPush,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))

    return PromiseHelper.wrapAsync(async () => {
      try {
        await this._coll.mutateIn(
          this._key,
          [MutateInSpec.arrayAppend('', value)],
          {
            storeSemantics: StoreSemantics.Upsert,
            parentSpan: obsReqHandler.wrappedSpan,
          }
        )
        obsReqHandler.end()
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }

  /**
   * Adds a new item to the beginning of the list.
   *
   * @param value The value to add.
   * @param callback A node-style callback to be invoked after execution.
   */
  async unshift(value: any, callback?: NodeCallback<void>): Promise<void> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.ListUnshift,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))

    return PromiseHelper.wrapAsync(async () => {
      try {
        await this._coll.mutateIn(
          this._key,
          [MutateInSpec.arrayPrepend('', value)],
          {
            storeSemantics: StoreSemantics.Upsert,
            parentSpan: obsReqHandler.wrappedSpan,
          }
        )
        obsReqHandler.end()
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }
}

/**
 * CouchbaseMap provides a simplified interface for storing a map
 * within a Couchbase document.
 *
 * @see {@link Collection.map}
 * @category Datastructures
 */
export class CouchbaseMap {
  private _coll: Collection
  private _key: string

  /**
   * @internal
   */
  constructor(collection: Collection, key: string) {
    this._coll = collection
    this._key = key
  }

  private async _get(
    parentSpan?: RequestSpan
  ): Promise<{ [key: string]: any }> {
    const doc = await this._coll.get(this._key, { parentSpan: parentSpan })
    if (!(doc.content instanceof Object)) {
      throw new CouchbaseError('expected document of object type')
    }

    return doc.content
  }

  /**
   * Returns an object representing all items in the map.
   *
   * @param callback A node-style callback to be invoked after execution.
   */
  async getAll(
    callback?: NodeCallback<{ [key: string]: any }>
  ): Promise<{ [key: string]: any }> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.MapGetAll,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))

    return PromiseHelper.wrapAsync(async () => {
      try {
        const res = await this._get(obsReqHandler.wrappedSpan)
        obsReqHandler.end()
        return res
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }

  /**
   * Iterates through every item in the map.
   *
   * @param rowCallback A callback invoked for each item in the list.
   * @param callback A node-style callback to be invoked after execution.
   */
  async forEach(
    rowCallback: (value: any, key: string, map: CouchbaseMap) => void,
    callback?: NodeCallback<void>
  ): Promise<void> {
    return PromiseHelper.wrapAsync(async () => {
      const values = await this._get()
      for (const i in values) {
        rowCallback(values[i], i, this)
      }
    }, callback)
  }

  /**
   * Provides the ability to async-for loop this object.
   */
  [Symbol.asyncIterator](): AsyncIterator<[any, string]> {
    const getNext = async () => this._get()
    return {
      data: null as { [key: string]: any } | null,
      keys: null as string[] | null,
      index: -1,
      async next() {
        if (this.index < 0) {
          this.data = await getNext()
          this.keys = Object.keys(this.data)
          this.index = 0
        }

        const keys = this.keys as string[]
        const data = this.data as { [key: string]: any }
        if (this.index < keys.length) {
          const key = keys[this.index++]
          return { done: false, value: [data[key], key] }
        }

        return { done: true, value: undefined }
      },
    } as any
  }

  /**
   * Sets a specific to the specified value in the map.
   *
   * @param item The key in the map to set.
   * @param value The new value to set.
   * @param callback A node-style callback to be invoked after execution.
   */
  async set(
    item: string,
    value: any,
    callback?: NodeCallback<void>
  ): Promise<void> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.MapSet,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))

    return PromiseHelper.wrapAsync(async () => {
      try {
        await this._coll.mutateIn(
          this._key,
          [MutateInSpec.upsert(item, value)],
          {
            storeSemantics: StoreSemantics.Upsert,
            parentSpan: obsReqHandler.wrappedSpan,
          }
        )
        obsReqHandler.end()
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }

  /**
   * Fetches a specific key from the map.
   *
   * @param item The key in the map to retrieve.
   * @param callback A node-style callback to be invoked after execution.
   */
  async get(item: string, callback?: NodeCallback<any>): Promise<any> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.MapGet,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))

    return PromiseHelper.wrapAsync(async () => {
      try {
        const res = await this._coll.lookupIn(
          this._key,
          [LookupInSpec.get(item)],
          { parentSpan: obsReqHandler.wrappedSpan }
        )

        const itemRes = res.content[0]
        if (itemRes.error) {
          throw itemRes.error
        }

        obsReqHandler.end()
        return itemRes.value
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }

  /**
   * Removes a specific key from the map.
   *
   * @param item The key in the map to remove.
   * @param callback A node-style callback to be invoked after execution.
   */
  async remove(item: string, callback?: NodeCallback<void>): Promise<void> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.MapRemove,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))

    return PromiseHelper.wrapAsync(async () => {
      try {
        await this._coll.mutateIn(this._key, [MutateInSpec.remove(item)], {
          parentSpan: obsReqHandler.wrappedSpan,
        })
        obsReqHandler.end()
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }

  /**
   * Checks whether a specific key exists in the map.
   *
   * @param item The key in the map to search for.
   * @param callback A node-style callback to be invoked after execution.
   */
  async exists(
    item: string,
    callback?: NodeCallback<boolean>
  ): Promise<boolean> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.MapExists,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))

    return PromiseHelper.wrapAsync(async () => {
      try {
        const res = await this._coll.lookupIn(
          this._key,
          [LookupInSpec.exists(item)],
          { parentSpan: obsReqHandler.wrappedSpan }
        )

        const itemRes = res.content[0]
        obsReqHandler.end()
        return itemRes.value
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }

  /**
   * Returns a list of all the keys which exist in the map.
   *
   * @param callback A node-style callback to be invoked after execution.
   */
  async keys(callback?: NodeCallback<string[]>): Promise<string[]> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.MapKeys,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))

    return PromiseHelper.wrapAsync(async () => {
      try {
        const values = await this._get(obsReqHandler.wrappedSpan)
        obsReqHandler.end()
        return Object.keys(values)
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }

  /**
   * Returns a list of all the values which exist in the map.
   *
   * @param callback A node-style callback to be invoked after execution.
   */
  async values(callback?: NodeCallback<any[]>): Promise<any[]> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.MapValues,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))

    return PromiseHelper.wrapAsync(async () => {
      try {
        const values = await this._get(obsReqHandler.wrappedSpan)
        obsReqHandler.end()
        return Object.values(values)
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }

  /**
   * Returns the number of items that exist in the map.
   *
   * @param callback A node-style callback to be invoked after execution.
   */
  async size(callback?: NodeCallback<number>): Promise<number> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.MapSize,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))
    return PromiseHelper.wrapAsync(async () => {
      try {
        const res = await this._coll.lookupIn(
          this._key,
          [LookupInSpec.count('')],
          { parentSpan: obsReqHandler.wrappedSpan }
        )
        obsReqHandler.end()
        return res.content[0].value
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }
}

/**
 * CouchbaseQueue provides a simplified interface for storing a queue
 * within a Couchbase document.
 *
 * @see {@link Collection.queue}
 * @category Datastructures
 */
export class CouchbaseQueue {
  private _coll: Collection
  private _key: string

  /**
   * @internal
   */
  constructor(collection: Collection, key: string) {
    this._coll = collection
    this._key = key
  }

  private async _get(): Promise<any[]> {
    const doc = await this._coll.get(this._key)
    if (!(doc.content instanceof Array)) {
      throw new CouchbaseError('expected document of array type')
    }

    return doc.content
  }

  /**
   * Returns the number of items in the queue.
   *
   * @param callback A node-style callback to be invoked after execution.
   */
  async size(callback?: NodeCallback<number>): Promise<number> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.QueueSize,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))
    return PromiseHelper.wrapAsync(async () => {
      try {
        const res = await this._coll.lookupIn(
          this._key,
          [LookupInSpec.count('')],
          { parentSpan: obsReqHandler.wrappedSpan }
        )
        obsReqHandler.end()
        return res.content[0].value
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }

  /**
   * Adds a new item to the back of the queue.
   *
   * @param value The value to add.
   * @param callback A node-style callback to be invoked after execution.
   */
  async push(value: any, callback?: NodeCallback<void>): Promise<void> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.QueuePush,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))

    return PromiseHelper.wrapAsync(async () => {
      try {
        await this._coll.mutateIn(
          this._key,
          [MutateInSpec.arrayPrepend('', value)],
          {
            storeSemantics: StoreSemantics.Upsert,
            parentSpan: obsReqHandler.wrappedSpan,
          }
        )
        obsReqHandler.end()
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }

  /**
   * Removes an item from the front of the queue.
   *
   * @param callback A node-style callback to be invoked after execution.
   */
  async pop(callback?: NodeCallback<any>): Promise<any> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.QueuePop,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))

    return PromiseHelper.wrapAsync(async () => {
      try {
        for (let i = 0; i < 16; ++i) {
          try {
            const res = await this._coll.lookupIn(
              this._key,
              [LookupInSpec.get('[-1]')],
              { parentSpan: obsReqHandler.wrappedSpan }
            )

            const value = res.content[0].value

            await this._coll.mutateIn(
              this._key,
              [MutateInSpec.remove('[-1]')],
              {
                cas: res.cas,
                parentSpan: obsReqHandler.wrappedSpan,
              }
            )

            obsReqHandler.end()
            return value
          } catch (e) {
            if (e instanceof PathInvalidError) {
              throw new CouchbaseError('no items available in list')
            }

            // continue and retry
          }
        }

        throw new CouchbaseError('no items available to pop')
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }
}

/**
 * CouchbaseSet provides a simplified interface for storing a set
 * within a Couchbase document.
 *
 * @see {@link Collection.set}
 * @category Datastructures
 */
export class CouchbaseSet {
  private _coll: Collection
  private _key: string

  /**
   * @internal
   */
  constructor(collection: Collection, key: string) {
    this._coll = collection
    this._key = key
  }

  private async _get(parentSpan?: RequestSpan): Promise<any[]> {
    const doc = await this._coll.get(this._key, { parentSpan: parentSpan })
    if (!(doc.content instanceof Array)) {
      throw new CouchbaseError('expected document of array type')
    }

    return doc.content
  }

  /**
   * Adds a new item to the set.  Returning whether the item already existed
   * in the set or not.
   *
   * @param item The item to add.
   * @param callback A node-style callback to be invoked after execution.
   */
  async add(item: any, callback?: NodeCallback<boolean>): Promise<boolean> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.SetAdd,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))

    return PromiseHelper.wrapAsync(async () => {
      try {
        await this._coll.mutateIn(
          this._key,
          [MutateInSpec.arrayAddUnique('', item)],
          {
            storeSemantics: StoreSemantics.Upsert,
            parentSpan: obsReqHandler.wrappedSpan,
          }
        )
      } catch (e) {
        if (e instanceof PathExistsError) {
          obsReqHandler.end()
          return false
        }

        obsReqHandler.endWithError(e)
        throw e
      }

      obsReqHandler.end()
      return true
    }, callback)
  }

  /**
   * Returns whether a specific value already exists in the set.
   *
   * @param item The value to search for.
   * @param callback A node-style callback to be invoked after execution.
   */
  async contains(
    item: any,
    callback?: NodeCallback<boolean>
  ): Promise<boolean> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.SetContains,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))

    return PromiseHelper.wrapAsync(async () => {
      try {
        const values = await this._get(obsReqHandler.wrappedSpan)
        for (let i = 0; i < values.length; ++i) {
          if (values[i] === item) {
            obsReqHandler.end()
            return true
          }
        }
        obsReqHandler.end()
        return false
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }

  /**
   * Removes a specific value from the set.
   *
   * @param item The value to remove.
   * @param callback A node-style callback to be invoked after execution.
   */
  async remove(item: any, callback?: NodeCallback<void>): Promise<void> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.SetRemove,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))

    return PromiseHelper.wrapAsync(async () => {
      try {
        for (let i = 0; i < 16; ++i) {
          try {
            const res = await this._coll.get(this._key, {
              parentSpan: obsReqHandler.wrappedSpan,
            })
            if (!(res.content instanceof Array)) {
              throw new CouchbaseError('expected document of array type')
            }

            const itemIdx = res.content.indexOf(item)
            if (itemIdx === -1) {
              throw new Error('item was not found in set')
            }

            await this._coll.mutateIn(
              this._key,
              [MutateInSpec.remove('[' + itemIdx + ']')],
              {
                cas: res.cas,
                parentSpan: obsReqHandler.wrappedSpan,
              }
            )

            obsReqHandler.end()
            return
          } catch (_e) {
            // continue and retry
          }
        }

        throw new CouchbaseError('no items available to pop')
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }

  /**
   * Returns a list of all values in the set.
   *
   * @param callback A node-style callback to be invoked after execution.
   */
  async values(callback?: NodeCallback<any[]>): Promise<any[]> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.SetValues,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))

    return PromiseHelper.wrapAsync(async () => {
      try {
        const res = await this._get(obsReqHandler.wrappedSpan)
        obsReqHandler.end()
        return res
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }

  /**
   * Returns the number of elements in this set.
   *
   * @param callback A node-style callback to be invoked after execution.
   */
  async size(callback?: NodeCallback<number>): Promise<number> {
    const obsReqHandler = new ObservableRequestHandler(
      DatastructureOp.SetSize,
      this._coll.observabilityInstruments
    )
    obsReqHandler.setRequestKeyValueAttributes(this._coll._cppDocId(this._key))

    return PromiseHelper.wrapAsync(async () => {
      try {
        const res = await this._coll.lookupIn(
          this._key,
          [LookupInSpec.count('')],
          { parentSpan: obsReqHandler.wrappedSpan }
        )
        obsReqHandler.end()
        return res.content[0].value
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }
    }, callback)
  }
}
