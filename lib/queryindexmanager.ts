import { errorFromCpp } from './bindingutilities'
import { Cluster } from './cluster'
import { CouchbaseError } from './errors'
import { HttpExecutor } from './httpexecutor'
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
   */
  collectionName?: string

  /**
   * Specifies the collection scope of this index.
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
   */
  collectionName?: string

  /**
   * Specifies the collection scope of this index.
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
   */
  collectionName?: string

  /**
   * Specifies the collection scope of this index.
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
   */
  collectionName?: string

  /**
   * Specifies the collection scope of this index.
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
   */
  collectionName?: string

  /**
   * Specifies the collection scope of this index.
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
   */
  collectionName?: string

  /**
   * Specifies the collection scope of this index.
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
   */
  collectionName?: string

  /**
   * Specifies the collection scope of this index.
   */
  scopeName?: string

  /**
   * Specifies whether the primary indexes should be watched as well.
   */
  watchPrimary?: boolean
}

/**
 * QueryIndexManager provides an interface for managing the
 * query indexes on the cluster.
 *
 * @category Management
 */
export class QueryIndexManager {
  private _cluster: Cluster

  /**
   * @internal
   */
  constructor(cluster: Cluster) {
    this._cluster = cluster
  }

  private get _http() {
    return new HttpExecutor(this._cluster.conn)
  }

  private async _createIndex(
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
          is_primary: isPrimary,
          ignore_if_exists: options.ignoreIfExists || false,
          deferred: options.deferred,
          num_replicas: options.numReplicas,
          timeout: timeout,
          condition: '',
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

    return this._createIndex(
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

    return this._createIndex(
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

  private async _dropIndex(
    bucketName: string,
    isPrimary: boolean,
    options: {
      collectionName?: string
      scopeName?: string
      name?: string
      ignoreIfNotExists?: boolean
      timeout?: number
    },
    callback?: NodeCallback<void>
  ): Promise<void> {
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementQueryIndexDrop(
        {
          bucket_name: bucketName,
          scope_name: options.scopeName || '',
          collection_name: options.collectionName || '',
          index_name: options.name || '',
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

    return this._dropIndex(
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

    return this._dropIndex(
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

    const collectionName = options.collectionName || ''
    const scopeName = options.scopeName || ''
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementQueryIndexGetAll(
        {
          bucket_name: bucketName,
          scope_name: scopeName,
          collection_name: collectionName,
          timeout,
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

    const collectionName = options.collectionName || ''
    const scopeName = options.scopeName || ''
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementQueryIndexBuildDeferred(
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

          wrapCallback(null, null)
        }
      )
    }, callback)
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
        const onlineIdxs = foundIdxs.filter((idx) => idx.state === 'online')
        const onlineIdxNames = onlineIdxs.map((idx) => idx.name)

        // Check if all the indexes we want are online
        let allOnline = true
        indexNames.forEach((indexName) => {
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
