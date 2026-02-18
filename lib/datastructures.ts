import { Collection } from './collection'
import { CouchbaseError, PathExistsError, PathInvalidError } from './errors'
import { StoreSemantics } from './generaltypes'
import { LookupInSpec, MutateInSpec } from './sdspecs'
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

  private async _get(): Promise<any[]> {
    const doc = await this._coll.get(this._key)
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
    return PromiseHelper.wrapAsync(async () => {
      return await this._get()
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
    return PromiseHelper.wrapAsync(async () => {
      const res = await this._coll.lookupIn(this._key, [
        LookupInSpec.get('[' + index + ']'),
      ])

      const itemRes = res.content[0]
      if (itemRes.error) {
        throw itemRes.error
      }

      return itemRes.value
    }, callback)
  }

  /**
   * Removes an item at a specific index from the list.
   *
   * @param index The index to remove.
   * @param callback A node-style callback to be invoked after execution.
   */
  async removeAt(index: number, callback?: NodeCallback<void>): Promise<void> {
    return PromiseHelper.wrapAsync(async () => {
      await this._coll.mutateIn(this._key, [
        MutateInSpec.remove('[' + index + ']'),
      ])
    }, callback)
  }

  /**
   * Returns the index of a specific value from the list.
   *
   * @param value The value to search for.
   * @param callback A node-style callback to be invoked after execution.
   */
  async indexOf(value: any, callback?: NodeCallback<number>): Promise<number> {
    return PromiseHelper.wrapAsync(async () => {
      const items = await this._get()

      for (let i = 0; i < items.length; ++i) {
        if (items[i] === value) {
          return i
        }
      }

      return -1
    }, callback)
  }

  /**
   * Returns the number of items in the list.
   *
   * @param callback A node-style callback to be invoked after execution.
   */
  async size(callback?: NodeCallback<number>): Promise<number> {
    return PromiseHelper.wrapAsync(async () => {
      const res = await this._coll.lookupIn(this._key, [LookupInSpec.count('')])
      return res.content[0].value
    }, callback)
  }

  /**
   * Adds a new item to the end of the list.
   *
   * @param value The value to add.
   * @param callback A node-style callback to be invoked after execution.
   */
  async push(value: any, callback?: NodeCallback<void>): Promise<void> {
    return PromiseHelper.wrapAsync(async () => {
      await this._coll.mutateIn(
        this._key,
        [MutateInSpec.arrayAppend('', value)],
        {
          storeSemantics: StoreSemantics.Upsert,
        }
      )
    }, callback)
  }

  /**
   * Adds a new item to the beginning of the list.
   *
   * @param value The value to add.
   * @param callback A node-style callback to be invoked after execution.
   */
  async unshift(value: any, callback?: NodeCallback<void>): Promise<void> {
    return PromiseHelper.wrapAsync(async () => {
      await this._coll.mutateIn(
        this._key,
        [MutateInSpec.arrayPrepend('', value)],
        {
          storeSemantics: StoreSemantics.Upsert,
        }
      )
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

  private async _get(): Promise<{ [key: string]: any }> {
    const doc = await this._coll.get(this._key)
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
    return PromiseHelper.wrapAsync(async () => {
      return await this._get()
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
    return PromiseHelper.wrapAsync(async () => {
      await this._coll.mutateIn(this._key, [MutateInSpec.upsert(item, value)], {
        storeSemantics: StoreSemantics.Upsert,
      })
    }, callback)
  }

  /**
   * Fetches a specific key from the map.
   *
   * @param item The key in the map to retrieve.
   * @param callback A node-style callback to be invoked after execution.
   */
  async get(item: string, callback?: NodeCallback<any>): Promise<any> {
    return PromiseHelper.wrapAsync(async () => {
      const res = await this._coll.lookupIn(this._key, [LookupInSpec.get(item)])

      const itemRes = res.content[0]
      if (itemRes.error) {
        throw itemRes.error
      }

      return itemRes.value
    }, callback)
  }

  /**
   * Removes a specific key from the map.
   *
   * @param item The key in the map to remove.
   * @param callback A node-style callback to be invoked after execution.
   */
  async remove(item: string, callback?: NodeCallback<void>): Promise<void> {
    return PromiseHelper.wrapAsync(async () => {
      await this._coll.mutateIn(this._key, [MutateInSpec.remove(item)])
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
    return PromiseHelper.wrapAsync(async () => {
      const res = await this._coll.lookupIn(this._key, [
        LookupInSpec.exists(item),
      ])

      const itemRes = res.content[0]
      return itemRes.value
    }, callback)
  }

  /**
   * Returns a list of all the keys which exist in the map.
   *
   * @param callback A node-style callback to be invoked after execution.
   */
  async keys(callback?: NodeCallback<string[]>): Promise<string[]> {
    return PromiseHelper.wrapAsync(async () => {
      const values = await this._get()
      return Object.keys(values)
    }, callback)
  }

  /**
   * Returns a list of all the values which exist in the map.
   *
   * @param callback A node-style callback to be invoked after execution.
   */
  async values(callback?: NodeCallback<any[]>): Promise<any[]> {
    return PromiseHelper.wrapAsync(async () => {
      const values = await this._get()
      return Object.values(values)
    }, callback)
  }

  /**
   * Returns the number of items that exist in the map.
   *
   * @param callback A node-style callback to be invoked after execution.
   */
  async size(callback?: NodeCallback<number>): Promise<number> {
    return PromiseHelper.wrapAsync(async () => {
      const res = await this._coll.lookupIn(this._key, [LookupInSpec.count('')])
      return res.content[0].value
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
    return PromiseHelper.wrapAsync(async () => {
      const res = await this._coll.lookupIn(this._key, [LookupInSpec.count('')])
      return res.content[0].value
    }, callback)
  }

  /**
   * Adds a new item to the back of the queue.
   *
   * @param value The value to add.
   * @param callback A node-style callback to be invoked after execution.
   */
  async push(value: any, callback?: NodeCallback<void>): Promise<void> {
    return PromiseHelper.wrapAsync(async () => {
      await this._coll.mutateIn(
        this._key,
        [MutateInSpec.arrayPrepend('', value)],
        {
          storeSemantics: StoreSemantics.Upsert,
        }
      )
    }, callback)
  }

  /**
   * Removes an item from the front of the queue.
   *
   * @param callback A node-style callback to be invoked after execution.
   */
  async pop(callback?: NodeCallback<any>): Promise<any> {
    return PromiseHelper.wrapAsync(async () => {
      for (let i = 0; i < 16; ++i) {
        try {
          const res = await this._coll.lookupIn(this._key, [
            LookupInSpec.get('[-1]'),
          ])

          const value = res.content[0].value

          await this._coll.mutateIn(this._key, [MutateInSpec.remove('[-1]')], {
            cas: res.cas,
          })

          return value
        } catch (e) {
          if (e instanceof PathInvalidError) {
            throw new CouchbaseError('no items available in list')
          }

          // continue and retry
        }
      }

      throw new CouchbaseError('no items available to pop')
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

  private async _get(): Promise<any[]> {
    const doc = await this._coll.get(this._key)
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
    return PromiseHelper.wrapAsync(async () => {
      try {
        await this._coll.mutateIn(
          this._key,
          [MutateInSpec.arrayAddUnique('', item)],
          {
            storeSemantics: StoreSemantics.Upsert,
          }
        )
      } catch (e) {
        if (e instanceof PathExistsError) {
          return false
        }

        throw e
      }

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
    return PromiseHelper.wrapAsync(async () => {
      const values = await this._get()
      for (let i = 0; i < values.length; ++i) {
        if (values[i] === item) {
          return true
        }
      }
      return false
    }, callback)
  }

  /**
   * Removes a specific value from the set.
   *
   * @param item The value to remove.
   * @param callback A node-style callback to be invoked after execution.
   */
  async remove(item: any, callback?: NodeCallback<void>): Promise<void> {
    return PromiseHelper.wrapAsync(async () => {
      for (let i = 0; i < 16; ++i) {
        try {
          const res = await this._coll.get(this._key)
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
            }
          )

          return
        } catch (_e) {
          // continue and retry
        }
      }

      throw new CouchbaseError('no items available to pop')
    }, callback)
  }

  /**
   * Returns a list of all values in the set.
   *
   * @param callback A node-style callback to be invoked after execution.
   */
  async values(callback?: NodeCallback<any[]>): Promise<any[]> {
    return PromiseHelper.wrapAsync(async () => {
      return await this._get()
    }, callback)
  }

  /**
   * Returns the number of elements in this set.
   *
   * @param callback A node-style callback to be invoked after execution.
   */
  async size(callback?: NodeCallback<number>): Promise<number> {
    return PromiseHelper.wrapAsync(async () => {
      const res = await this._coll.lookupIn(this._key, [LookupInSpec.count('')])
      return res.content[0].value
    }, callback)
  }
}
