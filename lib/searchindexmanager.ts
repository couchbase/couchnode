import { Cluster } from './cluster'
import { NodeCallback, PromiseHelper } from './utilities'
import { CppManagementSearchIndex } from './binding'
import { wrapObservableBindingCall } from './observability'
import { ObservableRequestHandler } from './observabilityhandler'
import {
  SearchIndexMgmtOp,
  ObservabilityInstruments,
} from './observabilitytypes'
import { RequestSpan } from './tracing'

/**
 * Provides information about a search index.  This class is currently
 * incomplete and must be casted from `any` in TypeScript.
 *
 * @category Management
 */
export interface ISearchIndex {
  /**
   * The UUID of the search index.  Used for updates to ensure consistency.
   */
  uuid?: string

  /**
   * The name of the search index.
   */
  name: string

  /**
   * Name of the source of the data (ie: the bucket name).
   */
  sourceName: string

  /**
   * The type of index to use (fulltext-index or fulltext-alias).
   */
  type: string

  /**
   * Parameters to specify such as the store type and mappins.
   */
  params: { [key: string]: any }

  /**
   * The UUID of the data source.
   */
  sourceUuid: string

  /**
   * Extra parameters for the source.  These are usually things like advanced
   * connection options and tuning parameters.
   */
  sourceParams: { [key: string]: any }

  /**
   * The type of the source (couchbase or nil).
   */
  sourceType: string

  /**
   * Plan properties such as the number of replicas and number of partitions.
   */
  planParams: { [key: string]: any }
}

/**
 * This class is currently incomplete and must be casted to `any` in
 * TypeScript to be used.
 *
 * @category Management
 */
export class SearchIndex implements ISearchIndex {
  /**
   * The UUID of the search index.  Used for updates to ensure consistency.
   */
  uuid?: string

  /**
   * The name of the search index.
   */
  name: string

  /**
   * Name of the source of the data (ie: the bucket name).
   */
  sourceName: string

  /**
   * The type of index to use (fulltext-index or fulltext-alias).
   */
  type: string

  /**
   * Parameters to specify such as the store type and mappins.
   */
  params: { [key: string]: any }

  /**
   * The UUID of the data source.
   */
  sourceUuid: string

  /**
   * Extra parameters for the source.  These are usually things like advanced
   * connection options and tuning parameters.
   */
  sourceParams: { [key: string]: any }

  /**
   * The type of the source (couchbase or nil).
   */
  sourceType: string

  /**
   * Plan properties such as the number of replicas and number of partitions.
   */
  planParams: { [key: string]: any }

  /**
   * @internal
   */
  constructor(data: SearchIndex) {
    this.uuid = data.uuid
    this.name = data.name
    this.sourceName = data.sourceName
    this.type = data.type
    this.params = data.params
    this.sourceUuid = data.sourceUuid
    this.sourceParams = data.sourceParams
    this.sourceType = data.sourceType
    this.planParams = data.planParams
  }

  /**
   * @internal
   */
  static _toCppData(data: ISearchIndex): any {
    return {
      uuid: data.uuid,
      name: data.name,
      type: data.type,
      params_json: JSON.stringify(data.params),
      source_uuid: data.sourceUuid,
      source_name: data.sourceName,
      source_type: data.sourceType,
      source_params_json: JSON.stringify(data.sourceParams),
      plan_params_json: JSON.stringify(data.planParams),
    }
  }

  /**
   * @internal
   */
  static _fromCppData(data: CppManagementSearchIndex): SearchIndex {
    const idx = new SearchIndex({
      uuid: data.uuid,
      name: data.name,
      type: data.type,
      params: {},
      sourceUuid: data.source_uuid,
      sourceName: data.source_name,
      sourceType: data.source_type,
      sourceParams: {},
      planParams: {},
    })
    if (data.params_json) {
      idx.params = JSON.parse(data.params_json)
    }
    if (data.source_params_json) {
      idx.sourceParams = JSON.parse(data.source_params_json)
    }
    if (data.plan_params_json) {
      idx.planParams = JSON.parse(data.plan_params_json)
    }
    return idx
  }
}

/**
 * @category Management
 */
export interface GetSearchIndexOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 * @category Management
 */
export interface GetAllSearchIndexesOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 * @category Management
 */
export interface UpsertSearchIndexOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 * @category Management
 */
export interface DropSearchIndexOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 * @category Management
 */
export interface GetSearchIndexedDocumentsCountOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 * @category Management
 */
export interface PauseSearchIngestOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 * @category Management
 */
export interface ResumeSearchIngestOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 * @category Management
 */
export interface AllowSearchQueryingOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 * @category Management
 */
export interface DisallowSearchQueryingOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 * @category Management
 */
export interface FreezeSearchPlanOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 * @category Management
 */
export interface UnfreezeSearchPlanOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 * @category Management
 */
export interface AnalyzeSearchDocumentOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 * SearchIndexManager provides an interface for managing the
 * search indexes on the cluster.
 *
 * @category Management
 */
export class SearchIndexManager {
  private _cluster: Cluster

  /**
   * @internal
   */
  constructor(cluster: Cluster) {
    this._cluster = cluster
  }

  /**
   * @internal
   */
  get observabilityInstruments(): ObservabilityInstruments {
    return this._cluster.observabilityInstruments
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

    const obsReqHandler = new ObservableRequestHandler(
      SearchIndexMgmtOp.SearchIndexGet,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes()

    try {
      const timeout = options.timeout || this._cluster.managementTimeout

      return PromiseHelper.wrapAsync(async () => {
        const [err, resp] = await wrapObservableBindingCall(
          this._cluster.conn.managementSearchIndexGet.bind(this._cluster.conn),
          {
            index_name: indexName,
            timeout: timeout,
          },
          obsReqHandler
        )
        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }
        obsReqHandler.end()
        return SearchIndex._fromCppData(resp.index)
      }, callback)
    } catch (err) {
      obsReqHandler.endWithError(err)
      throw err
    }
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

    const obsReqHandler = new ObservableRequestHandler(
      SearchIndexMgmtOp.SearchIndexGetAll,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes()

    try {
      const timeout = options.timeout || this._cluster.managementTimeout

      return PromiseHelper.wrapAsync(async () => {
        const [err, resp] = await wrapObservableBindingCall(
          this._cluster.conn.managementSearchIndexGetAll.bind(
            this._cluster.conn
          ),
          {
            timeout: timeout,
          },
          obsReqHandler
        )
        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }
        obsReqHandler.end()
        return resp.indexes.map((indexData: any) =>
          SearchIndex._fromCppData(indexData)
        )
      }, callback)
    } catch (err) {
      obsReqHandler.endWithError(err)
      throw err
    }
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

    const obsReqHandler = new ObservableRequestHandler(
      SearchIndexMgmtOp.SearchIndexUpsert,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes()

    try {
      const timeout = options.timeout || this._cluster.managementTimeout

      return PromiseHelper.wrapAsync(async () => {
        const [err, _] = await wrapObservableBindingCall(
          this._cluster.conn.managementSearchIndexUpsert.bind(
            this._cluster.conn
          ),
          {
            index: SearchIndex._toCppData(indexDefinition),
            timeout: timeout,
          },
          obsReqHandler
        )
        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }
        obsReqHandler.end()
      }, callback)
    } catch (err) {
      obsReqHandler.endWithError(err)
      throw err
    }
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

    const obsReqHandler = new ObservableRequestHandler(
      SearchIndexMgmtOp.SearchIndexDrop,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes()

    try {
      const timeout = options.timeout || this._cluster.managementTimeout

      return PromiseHelper.wrapAsync(async () => {
        const [err, _] = await wrapObservableBindingCall(
          this._cluster.conn.managementSearchIndexDrop.bind(this._cluster.conn),
          {
            index_name: indexName,
            timeout: timeout,
          },
          obsReqHandler
        )
        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }
        obsReqHandler.end()
      }, callback)
    } catch (err) {
      obsReqHandler.endWithError(err)
      throw err
    }
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

    const obsReqHandler = new ObservableRequestHandler(
      SearchIndexMgmtOp.SearchIndexGetDocumentsCount,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes()

    try {
      const timeout = options.timeout || this._cluster.managementTimeout

      return PromiseHelper.wrapAsync(async () => {
        const [err, resp] = await wrapObservableBindingCall(
          this._cluster.conn.managementSearchIndexGetDocumentsCount.bind(
            this._cluster.conn
          ),
          {
            index_name: indexName,
            timeout: timeout,
          },
          obsReqHandler
        )
        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }
        obsReqHandler.end()
        return resp.count
      }, callback)
    } catch (err) {
      obsReqHandler.endWithError(err)
      throw err
    }
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

    const obsReqHandler = new ObservableRequestHandler(
      SearchIndexMgmtOp.SearchIndexPauseIngest,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes()

    try {
      const timeout = options.timeout || this._cluster.managementTimeout

      return PromiseHelper.wrapAsync(async () => {
        const [err, _] = await wrapObservableBindingCall(
          this._cluster.conn.managementSearchIndexControlIngest.bind(
            this._cluster.conn
          ),
          {
            index_name: indexName,
            pause: true,
            timeout: timeout,
          },
          obsReqHandler
        )
        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }
        obsReqHandler.end()
      }, callback)
    } catch (err) {
      obsReqHandler.endWithError(err)
      throw err
    }
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

    const obsReqHandler = new ObservableRequestHandler(
      SearchIndexMgmtOp.SearchIndexResumeIngest,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes()

    try {
      const timeout = options.timeout || this._cluster.managementTimeout

      return PromiseHelper.wrapAsync(async () => {
        const [err, _] = await wrapObservableBindingCall(
          this._cluster.conn.managementSearchIndexControlIngest.bind(
            this._cluster.conn
          ),
          {
            index_name: indexName,
            pause: false,
            timeout: timeout,
          },
          obsReqHandler
        )
        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }
        obsReqHandler.end()
      }, callback)
    } catch (err) {
      obsReqHandler.endWithError(err)
      throw err
    }
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

    const obsReqHandler = new ObservableRequestHandler(
      SearchIndexMgmtOp.SearchIndexAllowQuerying,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes()

    try {
      const timeout = options.timeout || this._cluster.managementTimeout

      return PromiseHelper.wrapAsync(async () => {
        const [err, _] = await wrapObservableBindingCall(
          this._cluster.conn.managementSearchIndexControlQuery.bind(
            this._cluster.conn
          ),
          {
            index_name: indexName,
            allow: true,
            timeout: timeout,
          },
          obsReqHandler
        )
        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }
        obsReqHandler.end()
      }, callback)
    } catch (err) {
      obsReqHandler.endWithError(err)
      throw err
    }
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

    const obsReqHandler = new ObservableRequestHandler(
      SearchIndexMgmtOp.SearchIndexDisallowQuerying,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes()

    try {
      const timeout = options.timeout || this._cluster.managementTimeout

      return PromiseHelper.wrapAsync(async () => {
        const [err, _] = await wrapObservableBindingCall(
          this._cluster.conn.managementSearchIndexControlQuery.bind(
            this._cluster.conn
          ),
          {
            index_name: indexName,
            allow: false,
            timeout: timeout,
          },
          obsReqHandler
        )
        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }
        obsReqHandler.end()
      }, callback)
    } catch (err) {
      obsReqHandler.endWithError(err)
      throw err
    }
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

    const obsReqHandler = new ObservableRequestHandler(
      SearchIndexMgmtOp.SearchIndexFreezePlan,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes()

    try {
      const timeout = options.timeout || this._cluster.managementTimeout

      return PromiseHelper.wrapAsync(async () => {
        const [err, _] = await wrapObservableBindingCall(
          this._cluster.conn.managementSearchIndexControlPlanFreeze.bind(
            this._cluster.conn
          ),
          {
            index_name: indexName,
            freeze: true,
            timeout: timeout,
          },
          obsReqHandler
        )
        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }
        obsReqHandler.end()
      }, callback)
    } catch (err) {
      obsReqHandler.endWithError(err)
      throw err
    }
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

    const obsReqHandler = new ObservableRequestHandler(
      SearchIndexMgmtOp.SearchIndexUnfreezePlan,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes()

    try {
      const timeout = options.timeout || this._cluster.managementTimeout

      return PromiseHelper.wrapAsync(async () => {
        const [err, _] = await wrapObservableBindingCall(
          this._cluster.conn.managementSearchIndexControlPlanFreeze.bind(
            this._cluster.conn
          ),
          {
            index_name: indexName,
            freeze: false,
            timeout: timeout,
          },
          obsReqHandler
        )
        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }
        obsReqHandler.end()
      }, callback)
    } catch (err) {
      obsReqHandler.endWithError(err)
      throw err
    }
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

    const obsReqHandler = new ObservableRequestHandler(
      SearchIndexMgmtOp.SearchIndexAnalyzeDocument,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes()

    try {
      const timeout = options.timeout || this._cluster.managementTimeout

      return PromiseHelper.wrapAsync(async () => {
        const [err, resp] = await wrapObservableBindingCall(
          this._cluster.conn.managementSearchIndexAnalyzeDocument.bind(
            this._cluster.conn
          ),
          {
            index_name: indexName,
            encoded_document: JSON.stringify(document),
            timeout: timeout,
          },
          obsReqHandler
        )
        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }
        obsReqHandler.end()
        return JSON.parse(resp.analysis)
      }, callback)
    } catch (err) {
      obsReqHandler.endWithError(err)
      throw err
    }
  }
}
