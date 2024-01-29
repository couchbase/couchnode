import { Cluster } from './cluster'
import { NodeCallback, PromiseHelper } from './utilities'
import { errorFromCpp } from './bindingutilities'
import {
  GetSearchIndexOptions,
  GetAllSearchIndexesOptions,
  UpsertSearchIndexOptions,
  GetSearchIndexedDocumentsCountOptions,
  DropSearchIndexOptions,
  PauseSearchIngestOptions,
  ResumeSearchIngestOptions,
  AllowSearchQueryingOptions,
  DisallowSearchQueryingOptions,
  FreezeSearchPlanOptions,
  UnfreezeSearchPlanOptions,
  AnalyzeSearchDocumentOptions,
  ISearchIndex,
  SearchIndex,
} from './searchindexmanager'

/**
 * SearchIndexManager provides an interface for managing the
 * search indexes on the cluster.
 *
 * Volatile: This API is subject to change at any time.
 *
 * @category Management
 */
export class ScopeSearchIndexManager {
  private _cluster: Cluster
  private _bucketName: string
  private _scopeName: string

  /**
   * @internal
   */
  constructor(cluster: Cluster, bucketName: string, scopeName: string) {
    this._cluster = cluster
    this._bucketName = bucketName
    this._scopeName = scopeName
  }

  /**
   * Returns an index by it's name.
   *
   * @param indexName The index to retrieve.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getIndex(
    indexName: string,
    options?: GetSearchIndexOptions,
    callback?: NodeCallback<SearchIndex>
  ): Promise<SearchIndex> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementSearchIndexGet(
        {
          index_name: indexName,
          timeout: timeout,
          bucket_name: this._bucketName,
          scope_name: this._scopeName,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          const index = SearchIndex._fromCppData(resp.index)
          wrapCallback(null, index)
        }
      )
    }, callback)
  }

  /**
   * Returns a list of all existing indexes.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getAllIndexes(
    options?: GetAllSearchIndexesOptions,
    callback?: NodeCallback<SearchIndex[]>
  ): Promise<SearchIndex[]> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementSearchIndexGetAll(
        {
          timeout: timeout,
          bucket_name: this._bucketName,
          scope_name: this._scopeName,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          const indexes = resp.indexes.map((indexData: any) =>
            SearchIndex._fromCppData(indexData)
          )
          wrapCallback(null, indexes)
        }
      )
    }, callback)
  }

  /**
   * Creates or updates an existing index.
   *
   * @param indexDefinition The index to update.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async upsertIndex(
    indexDefinition: ISearchIndex,
    options?: UpsertSearchIndexOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementSearchIndexUpsert(
        {
          index: SearchIndex._toCppData(indexDefinition),
          timeout: timeout,
          bucket_name: this._bucketName,
          scope_name: this._scopeName,
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
   * Drops an index.
   *
   * @param indexName The name of the index to drop.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async dropIndex(
    indexName: string,
    options?: DropSearchIndexOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementSearchIndexDrop(
        {
          index_name: indexName,
          timeout: timeout,
          bucket_name: this._bucketName,
          scope_name: this._scopeName,
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
   * Returns the number of documents that have been indexed.
   *
   * @param indexName The name of the index to return the count for.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getIndexedDocumentsCount(
    indexName: string,
    options?: GetSearchIndexedDocumentsCountOptions,
    callback?: NodeCallback<number>
  ): Promise<number> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementSearchIndexGetDocumentsCount(
        {
          index_name: indexName,
          timeout: timeout,
          bucket_name: this._bucketName,
          scope_name: this._scopeName,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(null, resp.count)
        }
      )
    }, callback)
  }

  /**
   * Pauses the ingestion of documents into an index.
   *
   * @param indexName The name of the index to pause.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async pauseIngest(
    indexName: string,
    options?: PauseSearchIngestOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementSearchIndexControlIngest(
        {
          index_name: indexName,
          pause: true,
          timeout: timeout,
          bucket_name: this._bucketName,
          scope_name: this._scopeName,
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
   * Resumes the ingestion of documents into an index.
   *
   * @param indexName The name of the index to resume.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async resumeIngest(
    indexName: string,
    options?: ResumeSearchIngestOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementSearchIndexControlIngest(
        {
          index_name: indexName,
          pause: false,
          timeout: timeout,
          bucket_name: this._bucketName,
          scope_name: this._scopeName,
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
   * Enables querying of an index.
   *
   * @param indexName The name of the index to enable querying for.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async allowQuerying(
    indexName: string,
    options?: AllowSearchQueryingOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementSearchIndexControlQuery(
        {
          index_name: indexName,
          allow: true,
          timeout: timeout,
          bucket_name: this._bucketName,
          scope_name: this._scopeName,
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
   * Disables querying of an index.
   *
   * @param indexName The name of the index to disable querying for.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async disallowQuerying(
    indexName: string,
    options?: DisallowSearchQueryingOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementSearchIndexControlQuery(
        {
          index_name: indexName,
          allow: false,
          timeout: timeout,
          bucket_name: this._bucketName,
          scope_name: this._scopeName,
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
   * Freezes the indexing plan for execution of queries.
   *
   * @param indexName The name of the index to freeze the plan of.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async freezePlan(
    indexName: string,
    options?: FreezeSearchPlanOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementSearchIndexControlPlanFreeze(
        {
          index_name: indexName,
          freeze: true,
          timeout: timeout,
          bucket_name: this._bucketName,
          scope_name: this._scopeName,
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
   * Unfreezes the indexing plan for execution of queries.
   *
   * @param indexName The name of the index to freeze the plan of.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async unfreezePlan(
    indexName: string,
    options?: UnfreezeSearchPlanOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementSearchIndexControlPlanFreeze(
        {
          index_name: indexName,
          freeze: false,
          timeout: timeout,
          bucket_name: this._bucketName,
          scope_name: this._scopeName,
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
   * Performs analysis of a specific document by an index.
   *
   * @param indexName The name of the index to use for the analysis.
   * @param document The document to analyze.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async analyzeDocument(
    indexName: string,
    document: any,
    options?: AnalyzeSearchDocumentOptions,
    callback?: NodeCallback<any>
  ): Promise<any> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementSearchIndexAnalyzeDocument(
        {
          index_name: indexName,
          encoded_document: JSON.stringify(document),
          timeout: timeout,
          bucket_name: this._bucketName,
          scope_name: this._scopeName,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          const result = JSON.parse(resp.analysis)
          wrapCallback(result, null)
        }
      )
    }, callback)
  }
}
