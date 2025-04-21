import {
  CppTopologyCollectionsManifestCollection,
  CppTopologyCollectionsManifestScope,
} from './binding'
import { errorFromCpp } from './bindingutilities'
import { Bucket } from './bucket'
import { NodeCallback, PromiseHelper } from './utilities'

/**
 * Provides options for configuring a collection.
 *
 * @category Management
 */
export interface ICollectionSpec {
  /**
   * The name of the collection.
   */
  name: string

  /**
   * The name of the scope containing this collection.
   */
  scopeName: string

  /**
   * The maximum expiry for documents in this collection.
   *
   * @see {@link IBucketSettings.maxExpiry}
   */
  maxExpiry?: number

  /**
   * The history retention override setting in this collection.
   * Only supported on Magma Buckets.
   *
   * @see {@link StorageBackend.Magma}.
   */
  history?: boolean
}

/**
 * Contains information about a collection.
 *
 * @category Management
 */
export class CollectionSpec {
  /**
   * The name of the collection.
   */
  name: string

  /**
   * The name of the scope this collection exists in.
   */
  scopeName: string

  /**
   * The maximum expiry for documents in this collection.
   *
   * @see {@link IBucketSettings.maxExpiry}
   */
  maxExpiry?: number

  /**
   * The history retention override setting in this collection.
   * Only supported on Magma Buckets.
   *
   * @see {@link StorageBackend.Magma}.
   */
  history?: boolean

  /**
   * @internal
   */
  constructor(data: CollectionSpec) {
    this.name = data.name
    this.scopeName = data.scopeName
    this.maxExpiry = data.maxExpiry
    this.history = data.history
  }

  /**
   * @internal
   */
  static _fromCppData(
    scopeName: string,
    data: CppTopologyCollectionsManifestCollection
  ): CollectionSpec {
    return new CollectionSpec({
      name: data.name,
      scopeName: scopeName,
      maxExpiry: data.max_expiry,
      history: data.history,
    })
  }
}

/**
 * Contains information about a scope.
 *
 * @category Management
 */
export class ScopeSpec {
  /**
   * The name of the scope.
   */
  name: string

  /**
   * The collections which exist in this scope.
   */
  collections: CollectionSpec[]

  /**
   * @internal
   */
  constructor(data: ScopeSpec) {
    this.name = data.name
    this.collections = data.collections
  }

  /**
   * @internal
   */
  static _fromCppData(data: CppTopologyCollectionsManifestScope): ScopeSpec {
    let collections: CollectionSpec[]
    if (data.collections.length > 0) {
      const scopeName = data.name
      collections = data.collections.map(
        (collectionData: CppTopologyCollectionsManifestCollection) =>
          CollectionSpec._fromCppData(scopeName, collectionData)
      )
    } else {
      collections = []
    }

    return new ScopeSpec({
      name: data.name,
      collections: collections,
    })
  }
}

/**
 * The settings to use when creating the collection.
 *
 * @category Management
 */
export interface CreateCollectionSettings {
  /**
   * The maximum expiry for documents in this collection.
   *
   * @see {@link IBucketSettings.maxExpiry}
   */
  maxExpiry?: number

  /**
   * The history retention override setting in this collection.
   * Only supported on Magma Buckets.
   *
   * @see {@link StorageBackend.Magma}.
   */
  history?: boolean
}

/**
 * The settings which should be updated on the collection.
 *
 * @category Management
 */
export interface UpdateCollectionSettings {
  /**
   * The maximum expiry for documents in this collection.
   *
   * @see {@link IBucketSettings.maxExpiry}
   */
  maxExpiry?: number

  /**
   * The history retention override setting in this collection.
   * Only supported on Magma Buckets.
   *
   * @see {@link StorageBackend.Magma}.
   */
  history?: boolean
}

/**
 * @category Management
 */
export interface CreateCollectionOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface GetAllScopesOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DropCollectionOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface CreateScopeOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DropScopeOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface UpdateCollectionOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * CollectionManager allows the management of collections within a Bucket.
 *
 * @category Management
 */
export class CollectionManager {
  private _bucket: Bucket

  /**
   * @internal
   */
  constructor(bucket: Bucket) {
    this._bucket = bucket
  }

  private get _cluster() {
    return this._bucket.cluster
  }

  /**
   * Returns all configured scopes along with their collections.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getAllScopes(
    options?: GetAllScopesOptions,
    callback?: NodeCallback<ScopeSpec[]>
  ): Promise<ScopeSpec[]> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const bucketName = this._bucket.name
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementScopeGetAll(
        {
          bucket_name: bucketName,
          timeout: timeout,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }

          const scopes = resp.manifest.scopes.map((scopeData) =>
            ScopeSpec._fromCppData(scopeData)
          )

          wrapCallback(null, scopes)
        }
      )
    }, callback)
  }

  /**
   * Creates a collection in a scope.
   *
   * @param collectionSpec Specifies the settings for the new collection.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   * @deprecated Use the other overload instead.
   */
  async createCollection(
    collectionSpec: ICollectionSpec,
    options?: CreateCollectionOptions,
    callback?: NodeCallback<void>
  ): Promise<void>

  /**
   * Creates a collection in a scope.
   */
  async createCollection(
    collectionName: string,
    scopeName: string,
    options?: CreateCollectionOptions,
    callback?: NodeCallback<void>
  ): Promise<void>

  /**
   * Creates a collection in a scope.
   *
   * @param collectionName The name of the collection.
   * @param scopeName The name of the scope containing this collection.
   * @param settings The settings to use on creating the collection.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async createCollection(
    collectionName: string,
    scopeName: string,
    settings?: CreateCollectionSettings,
    options?: CreateCollectionOptions,
    callback?: NodeCallback<void>
  ): Promise<void>

  /**
   * @internal
   */
  async createCollection(): Promise<void> {
    let collectionName: string = arguments[0]
    let scopeName: string = arguments[1]
    let settings: CreateCollectionSettings | undefined = arguments[2]
    let options: CreateCollectionOptions | undefined = arguments[3]
    let callback: NodeCallback<void> | undefined = arguments[4]

    // Deprecated usage conversion for (CollectionSpec, options, callback)
    if (typeof collectionName === 'object') {
      const spec = collectionName as CollectionSpec
      collectionName = spec.name
      scopeName = spec.scopeName
      settings = {
        maxExpiry: spec.maxExpiry,
        history: spec.history,
      }
      options = arguments[1]
      callback = arguments[2]
      if (options instanceof Function) {
        callback = arguments[1]
        options = undefined
      }
    }
    // Handling of callbacks for alternative overloads
    if (settings instanceof Function) {
      callback = arguments[2]
      settings = undefined
    } else if (options instanceof Function) {
      callback = arguments[3]
      options = undefined
    }

    if (!options) {
      options = {}
    }

    if (!settings) {
      settings = {}
    }

    const bucketName = this._bucket.name
    const timeout = options.timeout || this._cluster.managementTimeout
    const maxExpiry = settings?.maxExpiry
    const history = settings?.history

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementCollectionCreate(
        {
          bucket_name: bucketName,
          scope_name: scopeName,
          collection_name: collectionName,
          max_expiry: maxExpiry,
          history: history,
          timeout: timeout,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Drops a collection from a scope.
   *
   * @param collectionName The name of the collection to drop.
   * @param scopeName The name of the scope containing the collection to drop.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async dropCollection(
    collectionName: string,
    scopeName: string,
    options?: DropCollectionOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const bucketName = this._bucket.name
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementCollectionDrop(
        {
          bucket_name: bucketName,
          scope_name: scopeName,
          collection_name: collectionName,
          timeout: timeout,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Updates a collection in a scope.
   *
   * @param collectionName The name of the collection to update.
   * @param scopeName The name of the scope containing the collection.
   * @param settings The settings to update on the collection.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async updateCollection(
    collectionName: string,
    scopeName: string,
    settings: UpdateCollectionSettings,
    options?: UpdateCollectionOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[3]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const bucketName = this._bucket.name
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementCollectionUpdate(
        {
          bucket_name: bucketName,
          scope_name: scopeName,
          collection_name: collectionName,
          max_expiry: settings.maxExpiry,
          history: settings.history,
          timeout: timeout,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Creates a new scope.
   *
   * @param scopeName The name of the new scope to create.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async createScope(
    scopeName: string,
    options?: CreateScopeOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const bucketName = this._bucket.name
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementScopeCreate(
        {
          bucket_name: bucketName,
          scope_name: scopeName,
          timeout: timeout,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Drops a scope.
   *
   * @param scopeName The name of the scope to drop.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async dropScope(
    scopeName: string,
    options?: DropScopeOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const bucketName = this._bucket.name
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementScopeDrop(
        {
          bucket_name: bucketName,
          scope_name: scopeName,
          timeout: timeout,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(err)
        }
      )
    }, callback)
  }
}
