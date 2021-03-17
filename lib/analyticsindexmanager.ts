import { Cluster } from './cluster'
import {
  CouchbaseError,
  DatasetExistsError,
  DatasetNotFoundError,
  DataverseExistsError,
  DataverseNotFoundError,
} from './errors'
import { HttpExecutor, HttpMethod, HttpServiceType } from './httpexecutor'
import { NodeCallback, PromiseHelper } from './utilities'

/**
 * Contains a specific dataset configuration for the analytics service.
 *
 * @category Management
 */
export class AnalyticsDataset {
  /**
   * The name of the dataset.
   */
  name: string

  /**
   * The name of the dataverse that this dataset exists within.
   */
  dataverseName: string

  /**
   * The name of the link that is associated with this dataset.
   */
  linkName: string

  /**
   * The name of the bucket that this dataset includes.
   */
  bucketName: string

  /**
   * @internal
   */
  constructor(data: AnalyticsDataset) {
    this.name = data.name
    this.dataverseName = data.dataverseName
    this.linkName = data.linkName
    this.bucketName = data.bucketName
  }
}

/**
 * Contains a specific index configuration for the analytics service.
 *
 * @category Management
 */
export class AnalyticsIndex {
  /**
   * The name of the index.
   */
  name: string

  /**
   * The name of the dataset this index belongs to.
   */
  datasetName: string

  /**
   * The name of the dataverse this index belongs to.
   */
  dataverseName: string

  /**
   * Whether or not this is a primary index or not.
   */
  isPrimary: boolean

  /**
   * @internal
   */
  constructor(data: AnalyticsIndex) {
    this.name = data.name
    this.datasetName = data.datasetName
    this.dataverseName = data.dataverseName
    this.isPrimary = data.isPrimary
  }
}

/**
 * @category Management
 */
export interface CreateAnalyticsDataverseOptions {
  /**
   * Whether or not the call should ignore the dataverse already existing when
   * determining whether the call was successful.
   */
  ignoreIfExists?: boolean

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DropAnalyticsDataverseOptions {
  /**
   * Whether or not the call should ignore the dataverse not existing when
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
export interface CreateAnalyticsDatasetOptions {
  /**
   * Whether or not the call should ignore the dataset already existing when
   * determining whether the call was successful.
   */
  ignoreIfExists?: boolean

  /**
   * The name of the dataverse the dataset should belong to.
   */
  dataverseName?: string

  /**
   * A conditional expression to limit the indexes scope.
   */
  condition?: string

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DropAnalyticsDatasetOptions {
  /**
   * Whether or not the call should ignore the dataset already existing when
   * determining whether the call was successful.
   */
  ignoreIfNotExists?: boolean

  /**
   * The name of the dataverse the dataset belongs to.
   */
  dataverseName?: string

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface GetAllAnalyticsDatasetsOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface CreateAnalyticsIndexOptions {
  /**
   * Whether or not the call should ignore the dataverse not existing when
   * determining whether the call was successful.
   */
  ignoreIfExists?: boolean

  /**
   * The name of the dataverse the index should belong to.
   */
  dataverseName?: string

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DropAnalyticsIndexOptions {
  /**
   * Whether or not the call should ignore the index already existing when
   * determining whether the call was successful.
   */
  ignoreIfNotExists?: boolean

  /**
   * The name of the dataverse the index belongs to.
   */
  dataverseName?: string

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface GetAllAnalyticsIndexesOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface ConnectAnalyticsLinkOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DisconnectAnalyticsLinkOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface GetPendingAnalyticsMutationsOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * AnalyticsIndexManager provides an interface for performing management
 * operations against the analytics service of the cluster.
 *
 * @category Management
 */
export class AnalyticsIndexManager {
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

  /**
   * Creates a new dataverse.
   *
   * @param dataverseName The name of the dataverse to create.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async createDataverse(
    dataverseName: string,
    options?: CreateAnalyticsDataverseOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    let qs = ''

    qs += 'CREATE DATAVERSE'

    qs += ' `' + dataverseName + '`'

    if (options.ignoreIfExists) {
      qs += ' IF NOT EXISTS'
    }

    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      try {
        await this._cluster.analyticsQuery(qs, {
          timeout: timeout,
        })
      } catch (err) {
        if (err instanceof DataverseExistsError) {
          throw err
        }

        throw new CouchbaseError('failed to create dataverse', err)
      }
    }, callback)
  }

  /**
   * Drops a previously created dataverse.
   *
   * @param dataverseName The name of the dataverse to drop.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async dropDataverse(
    dataverseName: string,
    options?: DropAnalyticsDataverseOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    let qs = ''

    qs += 'DROP DATAVERSE'

    qs += ' `' + dataverseName + '`'

    if (options.ignoreIfNotExists) {
      qs += ' IF EXISTS'
    }

    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      try {
        await this._cluster.analyticsQuery(qs, {
          timeout: timeout,
        })
      } catch (err) {
        if (err instanceof DataverseNotFoundError) {
          throw err
        }

        throw new CouchbaseError('failed to drop dataverse', err)
      }
    }, callback)
  }

  /**
   * Creates a new dataset.
   *
   * @param bucketName The name of the bucket to create this dataset of.
   * @param datasetName The name of the new dataset.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async createDataset(
    bucketName: string,
    datasetName: string,
    options?: CreateAnalyticsDatasetOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    let qs = ''

    qs += 'CREATE DATASET'

    if (options.ignoreIfExists) {
      qs += ' IF NOT EXISTS'
    }

    if (options.dataverseName) {
      qs += ' `' + options.dataverseName + '`.`' + datasetName + '`'
    } else {
      qs += ' `' + datasetName + '`'
    }

    qs += ' ON `' + bucketName + '`'

    if (options.condition) {
      qs += ' WHERE ' + options.condition
    }

    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      try {
        await this._cluster.analyticsQuery(qs, {
          timeout: timeout,
        })
      } catch (err) {
        if (err instanceof DatasetExistsError) {
          throw err
        }

        throw new CouchbaseError('failed to create dataset', err)
      }
    }, callback)
  }

  /**
   * Drops a previously created dataset.
   *
   * @param datasetName The name of the dataset to drop.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async dropDataset(
    datasetName: string,
    options?: DropAnalyticsDatasetOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    let qs = ''

    qs += 'DROP DATASET'

    if (options.dataverseName) {
      qs += ' `' + options.dataverseName + '`.`' + datasetName + '`'
    } else {
      qs += ' `' + datasetName + '`'
    }

    if (options.ignoreIfNotExists) {
      qs += ' IF EXISTS'
    }

    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      try {
        await this._cluster.analyticsQuery(qs, {
          timeout: timeout,
        })
      } catch (err) {
        if (err instanceof DatasetNotFoundError) {
          throw err
        }

        throw new CouchbaseError('failed to drop dataset', err)
      }
    }, callback)
  }

  /**
   * Returns a list of all existing datasets.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getAllDatasets(
    options?: GetAllAnalyticsDatasetsOptions,
    callback?: NodeCallback<AnalyticsDataset[]>
  ): Promise<AnalyticsDataset[]> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const qs =
      'SELECT d.* FROM `Metadata`.`Dataset` d WHERE d.DataverseName <> "Metadata"'

    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._cluster.analyticsQuery(qs, {
        timeout: timeout,
      })

      const datasets = res.rows.map(
        (row) =>
          new AnalyticsDataset({
            name: row.DatasetName,
            dataverseName: row.DataverseName,
            linkName: row.LinkName,
            bucketName: row.BucketName,
          })
      )

      return datasets
    }, callback)
  }

  /**
   * Creates a new index.
   *
   * @param datasetName The name of the dataset to create this index on.
   * @param indexName The name of index to create.
   * @param fields A map of fields that the index should contain.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async createIndex(
    datasetName: string,
    indexName: string,
    fields: { [key: string]: string },
    options?: CreateAnalyticsIndexOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[3]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    let qs = ''

    qs += 'CREATE INDEX'

    qs += ' `' + indexName + '`'

    if (options.ignoreIfExists) {
      qs += ' IF NOT EXISTS'
    }

    if (options.dataverseName) {
      qs += ' ON `' + options.dataverseName + '`.`' + datasetName + '`'
    } else {
      qs += ' ON `' + datasetName + '`'
    }

    qs += ' ('

    qs += Object.keys(fields)
      .map((i) => '`' + i + '`: ' + fields[i])
      .join(', ')

    qs += ')'

    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      await this._cluster.analyticsQuery(qs, {
        timeout: timeout,
      })
    }, callback)
  }

  /**
   * Drops a previously created index.
   *
   * @param datasetName The name of the dataset containing the index to drop.
   * @param indexName The name of the index to drop.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async dropIndex(
    datasetName: string,
    indexName: string,
    options?: DropAnalyticsIndexOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    let qs = ''

    qs += 'DROP INDEX'

    if (options.dataverseName) {
      qs += ' `' + options.dataverseName + '`.`' + datasetName + '`'
    } else {
      qs += ' `' + datasetName + '`'
    }
    qs += '.`' + indexName + '`'

    if (options.ignoreIfNotExists) {
      qs += ' IF EXISTS'
    }

    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      await this._cluster.analyticsQuery(qs, {
        timeout: timeout,
      })
    }, callback)
  }

  /**
   * Returns a list of all existing indexes.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getAllIndexes(
    options?: GetAllAnalyticsIndexesOptions,
    callback?: NodeCallback<AnalyticsIndex[]>
  ): Promise<AnalyticsIndex[]> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const qs =
      'SELECT d.* FROM `Metadata`.`Index` d WHERE d.DataverseName <> "Metadata"'

    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._cluster.analyticsQuery(qs, {
        timeout: timeout,
      })

      const indexes = res.rows.map(
        (row) =>
          new AnalyticsIndex({
            name: row.IndexName,
            datasetName: row.DatasetName,
            dataverseName: row.DataverseName,
            isPrimary: row.IsPrimary,
          })
      )

      return indexes
    }, callback)
  }

  /**
   * Connects a not yet connected link.
   *
   * @param linkName The name of the link to connect.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async connectLink(
    linkName: string,
    options?: ConnectAnalyticsLinkOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const qs = 'CONNECT LINK ' + linkName

    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      await this._cluster.analyticsQuery(qs, {
        timeout: timeout,
      })
    }, callback)
  }

  /**
   * Disconnects a previously connected link.
   *
   * @param linkName The name of the link to disconnect.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async disconnectLink(
    linkName: string,
    options?: DisconnectAnalyticsLinkOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const qs = 'DISCONNECT LINK ' + linkName

    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      await this._cluster.analyticsQuery(qs, {
        timeout: timeout,
      })
    }, callback)
  }

  /**
   * Returns a list of all pending mutations.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getPendingMutations(
    options?: GetPendingAnalyticsMutationsOptions,
    callback?: NodeCallback<{ [k: string]: { [k: string]: number } }>
  ): Promise<{ [k: string]: { [k: string]: number } }> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Analytics,
        method: HttpMethod.Get,
        path: `/analytics/node/agg/stats/remaining`,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        throw new CouchbaseError(
          'failed to get pending mutations',
          undefined,
          errCtx
        )
      }

      return JSON.parse(res.body.toString())
    }, callback)
  }
}
