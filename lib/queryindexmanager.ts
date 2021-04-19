import { Cluster } from './cluster'
import { CouchbaseError, IndexExistsError, IndexNotFoundError } from './errors'
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
   * The keyspace which this index covers.
   */
  keyspace: string

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
   * @internal
   */
  constructor(data: QueryIndex) {
    this.name = data.name
    this.isPrimary = data.isPrimary
    this.type = data.type
    this.state = data.state
    this.keyspace = data.keyspace
    this.indexKey = data.indexKey
    this.condition = data.condition
    this.partition = data.partition
  }
}

/**
 * @category Management
 */
export interface CreateQueryIndexOptions {
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
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface BuildQueryIndexOptions {
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
    return new HttpExecutor(this._cluster._getClusterConn())
  }

  private async _createIndex(
    bucketName: string,
    options: {
      name?: string
      fields?: string[]
      ignoreIfExists?: boolean
      numReplicas?: number
      deferred?: boolean
      timeout?: number
    },
    callback?: NodeCallback<void>
  ): Promise<void> {
    let qs = ''

    if (!options.fields) {
      qs += 'CREATE PRIMARY INDEX'
    } else {
      qs += 'CREATE INDEX'
    }

    if (options.name) {
      qs += ' `' + options.name + '`'
    }

    qs += ' ON `' + bucketName + '`'

    if (options.fields && options.fields.length > 0) {
      qs += '('
      for (let i = 0; i < options.fields.length; ++i) {
        if (i > 0) {
          qs += ', '
        }

        qs += '`' + options.fields[i] + '`'
      }
      qs += ')'
    }

    const withOpts: any = {}

    if (options.deferred) {
      withOpts.defer_build = true
    }

    if (options.numReplicas) {
      withOpts.num_replica = options.numReplicas
    }

    if (Object.keys(withOpts).length > 0) {
      qs += ' WITH ' + JSON.stringify(withOpts)
    }

    return PromiseHelper.wrapAsync(async () => {
      try {
        await this._cluster.query(qs, {
          timeout: options.timeout,
        })
      } catch (err) {
        if (options.ignoreIfExists && err instanceof IndexExistsError) {
          // swallow the error if the user wants us to
        } else {
          throw err
        }
      }
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
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    return this._createIndex(
      bucketName,
      {
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
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    return this._createIndex(
      bucketName,
      {
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
    options: {
      name?: string
      ignoreIfNotExists?: boolean
      timeout?: number
    },
    callback?: NodeCallback<void>
  ): Promise<void> {
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      let qs = ''

      if (!options.name) {
        qs += 'DROP PRIMARY INDEX `' + bucketName + '`'
      } else {
        qs += 'DROP INDEX `' + bucketName + '`.`' + options.name + '`'
      }

      try {
        await this._cluster.query(qs, {
          timeout: timeout,
        })
      } catch (err) {
        if (options.ignoreIfNotExists && err instanceof IndexNotFoundError) {
          // swallow the error if the user wants us to
        } else {
          throw err
        }
      }
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
      {
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
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    return this._dropIndex(
      bucketName,
      {
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

    let qs = ''
    qs += 'SELECT idx.* FROM system:indexes AS idx'
    qs += ' WHERE keyspace_id="' + bucketName + '"'
    qs += ' AND `using`="gsi" ORDER BY is_primary DESC, name ASC'

    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._cluster.query(qs, {
        timeout: timeout,
      })

      const indexes = res.rows.map(
        (row) =>
          new QueryIndex({
            name: row.name,
            isPrimary: row.is_primary,
            type: row.using,
            state: row.state,
            keyspace: row.keyspace_id,
            indexKey: row.index_key,
            condition: row.condition,
            partition: row.partition,
          })
      )

      return indexes
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

    const timeout = options.timeout
    const timer = new CompoundTimeout(timeout)

    return PromiseHelper.wrapAsync(async () => {
      const indexes = await this.getAllIndexes(bucketName, {
        timeout: timer.left(),
      })

      // Filter out the index names that need to be built
      const deferredList = indexes
        .filter(
          (index) => index.state === 'deferred' || index.state === 'pending'
        )
        .map((index) => index.name)

      // If there are no deferred indexes, we have nothing to do.
      if (deferredList.length === 0) {
        return []
      }

      let qs = ''
      qs += 'BUILD INDEX ON `' + bucketName + '` '
      qs += '('
      for (let j = 0; j < deferredList.length; ++j) {
        if (j > 0) {
          qs += ', '
        }
        qs += '`' + deferredList[j] + '`'
      }
      qs += ')'

      // Run our deferred build query
      await this._cluster.query(qs, {
        timeout: timer.left(),
      })

      // Return the list of indices that we built
      return deferredList
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
      callback = arguments[1]
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
        curInterval = Math.min(curInterval, curInterval + 500)

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
        await new Promise((resolve) => setTimeout(resolve, curInterval))
      }
    }, callback)
  }
}
