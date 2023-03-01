import { CppQueryContext } from './binding'
import { errorFromCpp } from './bindingutilities'
import { Cluster } from './cluster'
import { Collection } from './collection'
import { CouchbaseError, IndexNotFoundError } from './errors'
import { CompoundTimeout, NodeCallback, PromiseHelper } from './utilities'

/**
 * Contains a specific index configuration for the query service.
 *
 * @category Management
 */
export class QueryIndex {
  /**
   * The name of the index.
   */
  name: string

  /**
   * Whether this is a primary or secondary index.
   */
  isPrimary: boolean

  /**
   * The type of index.
   */
  type: string

  /**
   * The current state of the index.
   */
  state: string

  /**
   * The keys for this index.
   */
  indexKey: string[]

  /**
   * The conditional expression to limit the indexes scope.
   */
  condition?: string

  /**
   * Information about the partitioning of this index.
   */
  partition?: string

  /**
   * The collection that this index is for.
   */
  collectionName?: string

  /**
   * The scope that this index is for.
   */
  scopeName?: string

  /**
   * The bucket that this index is for.
   */
  bucketName?: string

  /**
   * @internal
   */
  constructor(data: QueryIndex) {
    this.name = data.name
    this.isPrimary = data.isPrimary
    this.type = data.type
    this.state = data.state
    this.indexKey = data.indexKey
    this.condition = data.condition
    this.partition = data.partition
    this.collectionName = data.collectionName
    this.scopeName = data.scopeName
    this.bucketName = data.bucketName
  }
}

/**
 * @category Management
 */
export interface CreateQueryIndexOptions {
  /**
   * Specifies the collection of this index.
   *
   * @deprecated Use {@link CollectionQueryIndexManager} instead.
   */
  collectionName?: string

  /**
   * Specifies the collection scope of this index.
   *
   * @deprecated Use {@link CollectionQueryIndexManager} instead.
   */
  scopeName?: string

  /**
   * Whether or not the call should ignore the index already existing when
   * determining whether the call was successful.
   */
  ignoreIfExists?: boolean

  /**
   * The number of replicas of this index that should be created.
   */
  numReplicas?: number

  /**
   * Specifies whether this index creation should be deferred until a later
   * point in time when they can be explicitly built together.
   */
  deferred?: boolean

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface CreatePrimaryQueryIndexOptions {
  /**
   * Specifies the collection of this index.
   *
   * @deprecated Use {@link CollectionQueryIndexManager} instead.
   */
  collectionName?: string

  /**
   * Specifies the collection scope of this index.
   *
   * @deprecated Use {@link CollectionQueryIndexManager} instead.
   */
  scopeName?: string

  /**
   * The name of this primary index.
   */
  name?: string

  /**
   * Whether or not the call should ignore the index already existing when
   * determining whether the call was successful.
   */
  ignoreIfExists?: boolean

  /**
   * The number of replicas of this index that should be created.
   */
  numReplicas?: number

  /**
   * Specifies whether this index creation should be deferred until a later
   * point in time when they can be explicitly built together.
   */
  deferred?: boolean

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DropQueryIndexOptions {
  /**
   * Specifies the collection of this index.
   *
   * @deprecated Use {@link CollectionQueryIndexManager} instead.
   */
  collectionName?: string

  /**
   * Specifies the collection scope of this index.
   *
   * @deprecated Use {@link CollectionQueryIndexManager} instead.
   */
  scopeName?: string

  /**
   * Whether or not the call should ignore the index already existing when
   * determining whether the call was successful.
   */
  ignoreIfNotExists?: boolean

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DropPrimaryQueryIndexOptions {
  /**
   * Specifies the collection of this index.
   *
   * @deprecated Use {@link CollectionQueryIndexManager} instead.
   */
  collectionName?: string

  /**
   * Specifies the collection scope of this index.
   *
   * @deprecated Use {@link CollectionQueryIndexManager} instead.
   */
  scopeName?: string

  /**
   * The name of the primary index to drop.
   */
  name?: string

  /**
   * Whether or not the call should ignore the index already existing when
   * determining whether the call was successful.
   */
  ignoreIfNotExists?: boolean

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface GetAllQueryIndexesOptions {
  /**
   * Specifies the collection of this index.
   *
   * @deprecated Use {@link CollectionQueryIndexManager} instead.
   */
  collectionName?: string

  /**
   * Specifies the collection scope of this index.
   *
   * @deprecated Use {@link CollectionQueryIndexManager} instead.
   */
  scopeName?: string

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface BuildQueryIndexOptions {
  /**
   * Specifies the collection of this index.
   *
   * @deprecated Use {@link CollectionQueryIndexManager} instead.
   */
  collectionName?: string

  /**
   * Specifies the collection scope of this index.
   *
   * @deprecated Use {@link CollectionQueryIndexManager} instead.
   */
  scopeName?: string

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface WatchQueryIndexOptions {
  /**
   * Specifies the collection of this index.
   *
   * @deprecated Use {@link CollectionQueryIndexManager} instead.
   */
  collectionName?: string

  /**
   * Specifies the collection scope of this index.
   *
   * @deprecated Use {@link CollectionQueryIndexManager} instead.
   */
  scopeName?: string

  /**
   * Specifies whether the primary indexes should be watched as well.
   */
  watchPrimary?: boolean
}

/**
 * @internal
 */
class InternalQueryIndexManager {
  private _cluster: Cluster
  private _queryContext: CppQueryContext

  /**
   * @internal
   */
  constructor(cluster: Cluster) {
    this._cluster = cluster
    this._queryContext = {
      bucket_name: '',
      scope_name: '',
    }
  }

  /**
   * @internal
   */
  async createIndex(
    bucketName: string,
    isPrimary: boolean,
    options: {
      collectionName?: string
      scopeName?: string
      name?: string
      fields?: string[]
      ignoreIfExists?: boolean
      numReplicas?: number
      deferred?: boolean
      timeout?: number
      queryContext?: CppQueryContext
    },
    callback?: NodeCallback<void>
  ): Promise<void> {
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementQueryIndexCreate(
        {
          bucket_name: bucketName,
          scope_name: options.scopeName || '',
          collection_name: options.collectionName || '',
          index_name: options.name || '',
          fields: options.fields || [],
          query_ctx: options.queryContext || this._queryContext,
          is_primary: isPrimary,
          ignore_if_exists: options.ignoreIfExists || false,
          deferred: options.deferred,
          num_replicas: options.numReplicas,
          timeout: timeout,
          condition: undefined,
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
   * @internal
   */
  async dropIndex(
    bucketName: string,
    isPrimary: boolean,
    options: {
      collectionName?: string
      scopeName?: string
      name?: string
      ignoreIfNotExists?: boolean
      timeout?: number
      queryContext?: CppQueryContext
    },
    callback?: NodeCallback<void>
  ): Promise<void> {
    const timeout = options.timeout || this._cluster.managementTimeout

    // BUG(JSCBC-1066): We need to use a normal drop index for named primary indexes.
    if (options.name) {
      isPrimary = false
    }

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementQueryIndexDrop(
        {
          bucket_name: bucketName,
          scope_name: options.scopeName || '',
          collection_name: options.collectionName || '',
          index_name: options.name || '',
          query_ctx: options.queryContext || this._queryContext,
          is_primary: isPrimary,
          ignore_if_does_not_exist: options.ignoreIfNotExists || false,
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
   * @internal
   */
  async getAllIndexes(
    bucketName: string,
    options: {
      collectionName?: string
      scopeName?: string
      timeout?: number
      queryContext?: CppQueryContext
    },
    callback?: NodeCallback<QueryIndex[]>
  ): Promise<QueryIndex[]> {
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementQueryIndexGetAll(
        {
          bucket_name: bucketName,
          scope_name: options.scopeName || '',
          collection_name: options.collectionName || '',
          query_ctx: options.queryContext || this._queryContext,
          timeout: timeout,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }

          const indexes = resp.indexes.map(
            (row) =>
              new QueryIndex({
                isPrimary: row.is_primary,
                name: row.name,
                state: row.state,
                type: row.type,
                indexKey: row.index_key,
                partition: row.partition,
                condition: row.condition,
                bucketName: row.bucket_name,
                scopeName: row.scope_name,
                collectionName: row.collection_name,
              })
          )

          wrapCallback(null, indexes)
        }
      )
    }, callback)
  }

  /**
   * @internal
   */
  async buildDeferredIndexes(
    bucketName: string,
    options: {
      collectionName?: string
      scopeName?: string
      timeout?: number
      queryContext?: CppQueryContext
    },
    callback?: NodeCallback<string[]>
  ): Promise<string[]> {
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementQueryIndexBuildDeferred(
        {
          bucket_name: bucketName,
          scope_name: options.scopeName || '',
          collection_name: options.collectionName || '',
          query_ctx: options.queryContext || this._queryContext,
          timeout: timeout,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(null, null)
        }
      )
    }, callback)
  }

  /**
   * @internal
   */
  async watchIndexes(
    bucketName: string,
    indexNames: string[],
    timeout: number,
    options: {
      collectionName?: string
      scopeName?: string
      watchPrimary?: boolean
    },
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options.watchPrimary) {
      indexNames = [...indexNames, '#primary']
    }

    const timer = new CompoundTimeout(timeout)

    return PromiseHelper.wrapAsync(async () => {
      let curInterval = 50
      for (;;) {
        // Get all the indexes that are currently registered
        const foundIdxs = await this.getAllIndexes(bucketName, {
          timeout: timer.left(),
        })
        const foundIndexNames = foundIdxs.map((idx) => idx.name)
        const onlineIdxs = foundIdxs.filter((idx) => idx.state === 'online')
        const onlineIdxNames = onlineIdxs.map((idx) => idx.name)

        // Check if all the indexes we want are online
        let allOnline = true
        indexNames.forEach((indexName) => {
          if (!foundIndexNames.includes(indexName)) {
            throw new IndexNotFoundError(
              new Error(`Cannot find index with name ${indexName}`)
            )
          }
          allOnline = allOnline && onlineIdxNames.indexOf(indexName) !== -1
        })

        // If all the indexes are online, we've succeeded
        if (allOnline) {
          break
        }

        // Add 500 to our interval to a max of 1000
        curInterval = Math.min(1000, curInterval + 500)

        // Make sure we don't go past our user-specified duration
        const userTimeLeft = timer.left()
        if (userTimeLeft !== undefined) {
          curInterval = Math.min(curInterval, userTimeLeft)
        }

        if (curInterval <= 0) {
          throw new CouchbaseError(
            'Failed to find all indexes online within the alloted time.'
          )
        }

        // Wait until curInterval expires
        await new Promise((resolve) =>
          setTimeout(() => resolve(true), curInterval)
        )
      }
    }, callback)
  }
}

/**
 * CollectionQueryIndexManager provides an interface for managing the
 * query indexes on the collection.
 *
 * @category Management
 */
export class CollectionQueryIndexManager {
  private _bucketName: string
  private _collectionName: string
  private _manager: InternalQueryIndexManager
  private _scopeName: string

  /**
   * @internal
   */
  constructor(collection: Collection) {
    this._bucketName = collection.scope.bucket.name
    this._collectionName = collection.name
    this._scopeName = collection.scope.name
    this._manager = new InternalQueryIndexManager(collection.cluster)
  }

  /**
   * Creates a new query index.
   *
   * @param indexName The name of the new index.
   * @param fields The fields which this index should cover.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async createIndex(
    indexName: string,
    fields: string[],
    options?: CreateQueryIndexOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    return this._manager.createIndex(
      this._bucketName,
      false,
      {
        collectionName: this._collectionName,
        scopeName: this._scopeName,
        name: indexName,
        fields: fields,
        ignoreIfExists: options.ignoreIfExists,
        numReplicas: options.numReplicas,
        deferred: options.deferred,
        timeout: options.timeout,
      },
      callback
    )
  }

  /**
   * Creates a new primary query index.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async createPrimaryIndex(
    options?: CreatePrimaryQueryIndexOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    return this._manager.createIndex(
      this._bucketName,
      true,
      {
        collectionName: this._collectionName,
        scopeName: this._scopeName,
        name: options.name,
        ignoreIfExists: options.ignoreIfExists,
        deferred: options.deferred,
        timeout: options.timeout,
      },
      callback
    )
  }

  /**
   * Drops an existing query index.
   *
   * @param indexName The name of the index to drop.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async dropIndex(
    indexName: string,
    options?: DropQueryIndexOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    return this._manager.dropIndex(
      this._bucketName,
      false,
      {
        collectionName: this._collectionName,
        scopeName: this._scopeName,
        name: indexName,
        ignoreIfNotExists: options.ignoreIfNotExists,
        timeout: options.timeout,
      },
      callback
    )
  }

  /**
   * Drops an existing primary index.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async dropPrimaryIndex(
    options?: DropPrimaryQueryIndexOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    return this._manager.dropIndex(
      this._bucketName,
      true,
      {
        collectionName: this._collectionName,
        scopeName: this._scopeName,
        name: options.name,
        ignoreIfNotExists: options.ignoreIfNotExists,
        timeout: options.timeout,
      },
      callback
    )
  }

  /**
   * Returns a list of indexes for a specific bucket.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getAllIndexes(
    options?: GetAllQueryIndexesOptions,
    callback?: NodeCallback<QueryIndex[]>
  ): Promise<QueryIndex[]> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    return this._manager.getAllIndexes(
      this._bucketName,
      {
        collectionName: this._collectionName,
        scopeName: this._scopeName,
        timeout: options.timeout,
      },
      callback
    )
  }

  /**
   * Starts building any indexes which were previously created with deferred=true.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async buildDeferredIndexes(
    options?: BuildQueryIndexOptions,
    callback?: NodeCallback<string[]>
  ): Promise<string[]> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    return this._manager.buildDeferredIndexes(
      this._bucketName,
      {
        collectionName: this._collectionName,
        scopeName: this._scopeName,
        timeout: options.timeout,
      },
      callback
    )
  }

  /**
   * Waits for a number of indexes to finish creation and be ready to use.
   *
   * @param indexNames The names of the indexes to watch.
   * @param timeout The maximum time to wait for the index, expressed in milliseconds.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async watchIndexes(
    indexNames: string[],
    timeout: number,
    options?: WatchQueryIndexOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    return this._manager.watchIndexes(
      this._bucketName,
      indexNames,
      timeout,
      {
        collectionName: this._collectionName,
        scopeName: this._scopeName,
        watchPrimary: options.watchPrimary,
      },
      callback
    )
  }
}

/**
 * QueryIndexManager provides an interface for managing the
 * query indexes on the cluster.
 *
 * @category Management
 */
export class QueryIndexManager {
  private _manager: InternalQueryIndexManager

  /**
   * @internal
   */
  constructor(cluster: Cluster) {
    this._manager = new InternalQueryIndexManager(cluster)
  }

  /**
   * Creates a new query index.
   *
   * @param bucketName The name of the bucket this index is for.
   * @param indexName The name of the new index.
   * @param fields The fields which this index should cover.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async createIndex(
    bucketName: string,
    indexName: string,
    fields: string[],
    options?: CreateQueryIndexOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[3]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    return this._manager.createIndex(
      bucketName,
      false,
      {
        collectionName: options.collectionName,
        scopeName: options.scopeName,
        name: indexName,
        fields: fields,
        ignoreIfExists: options.ignoreIfExists,
        numReplicas: options.numReplicas,
        deferred: options.deferred,
        timeout: options.timeout,
      },
      callback
    )
  }

  /**
   * Creates a new primary query index.
   *
   * @param bucketName The name of the bucket this index is for.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async createPrimaryIndex(
    bucketName: string,
    options?: CreatePrimaryQueryIndexOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    return this._manager.createIndex(
      bucketName,
      true,
      {
        collectionName: options.collectionName,
        scopeName: options.scopeName,
        name: options.name,
        ignoreIfExists: options.ignoreIfExists,
        deferred: options.deferred,
        timeout: options.timeout,
      },
      callback
    )
  }

  /**
   * Drops an existing query index.
   *
   * @param bucketName The name of the bucket containing the index to drop.
   * @param indexName The name of the index to drop.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async dropIndex(
    bucketName: string,
    indexName: string,
    options?: DropQueryIndexOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    return this._manager.dropIndex(
      bucketName,
      false,
      {
        collectionName: options.collectionName,
        scopeName: options.scopeName,
        name: indexName,
        ignoreIfNotExists: options.ignoreIfNotExists,
        timeout: options.timeout,
      },
      callback
    )
  }

  /**
   * Drops an existing primary index.
   *
   * @param bucketName The name of the bucket containing the primary index to drop.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async dropPrimaryIndex(
    bucketName: string,
    options?: DropPrimaryQueryIndexOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    return this._manager.dropIndex(
      bucketName,
      true,
      {
        collectionName: options.collectionName,
        scopeName: options.scopeName,
        name: options.name,
        ignoreIfNotExists: options.ignoreIfNotExists,
        timeout: options.timeout,
      },
      callback
    )
  }

  /**
   * Returns a list of indexes for a specific bucket.
   *
   * @param bucketName The name of the bucket to fetch indexes for.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getAllIndexes(
    bucketName: string,
    options?: GetAllQueryIndexesOptions,
    callback?: NodeCallback<QueryIndex[]>
  ): Promise<QueryIndex[]> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    return this._manager.getAllIndexes(
      bucketName,
      {
        collectionName: options.collectionName,
        scopeName: options.scopeName,
        timeout: options.timeout,
      },
      callback
    )
  }

  /**
   * Starts building any indexes which were previously created with deferred=true.
   *
   * @param bucketName The name of the bucket to perform the build on.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async buildDeferredIndexes(
    bucketName: string,
    options?: BuildQueryIndexOptions,
    callback?: NodeCallback<string[]>
  ): Promise<string[]> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    return this._manager.buildDeferredIndexes(
      bucketName,
      {
        collectionName: options.collectionName,
        scopeName: options.scopeName,
        timeout: options.timeout,
      },
      callback
    )
  }

  /**
   * Waits for a number of indexes to finish creation and be ready to use.
   *
   * @param bucketName The name of the bucket to watch for indexes on.
   * @param indexNames The names of the indexes to watch.
   * @param timeout The maximum time to wait for the index, expressed in milliseconds.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async watchIndexes(
    bucketName: string,
    indexNames: string[],
    timeout: number,
    options?: WatchQueryIndexOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[3]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    return this._manager.watchIndexes(
      bucketName,
      indexNames,
      timeout,
      {
        collectionName: options.collectionName,
        scopeName: options.scopeName,
        watchPrimary: options.watchPrimary,
      },
      callback
    )
  }
}
