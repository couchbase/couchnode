import { Cluster } from './cluster'
import { NodeCallback, PromiseHelper } from './utilities'
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
import { wrapObservableBindingCall } from './observability'
import { ObservableRequestHandler } from './observabilityhandler'
import {
  SearchIndexMgmtOp,
  ObservabilityInstruments,
} from './observabilitytypes'

/**
 * SearchIndexManager provides an interface for managing the
 * search indexes on the cluster.
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
    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

    try {
      const timeout = options.timeout || this._cluster.managementTimeout

      return PromiseHelper.wrapAsync(async () => {
        const [err, resp] = await wrapObservableBindingCall(
          this._cluster.conn.managementSearchIndexGet.bind(this._cluster.conn),
          {
            index_name: indexName,
            bucket_name: this._bucketName,
            scope_name: this._scopeName,
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
    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

    try {
      const timeout = options.timeout || this._cluster.managementTimeout

      return PromiseHelper.wrapAsync(async () => {
        const [err, resp] = await wrapObservableBindingCall(
          this._cluster.conn.managementSearchIndexGetAll.bind(
            this._cluster.conn
          ),
          {
            bucket_name: this._bucketName,
            scope_name: this._scopeName,
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
    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

    try {
      const timeout = options.timeout || this._cluster.managementTimeout

      return PromiseHelper.wrapAsync(async () => {
        const [err, _] = await wrapObservableBindingCall(
          this._cluster.conn.managementSearchIndexUpsert.bind(
            this._cluster.conn
          ),
          {
            index: SearchIndex._toCppData(indexDefinition),
            bucket_name: this._bucketName,
            scope_name: this._scopeName,
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
    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

    try {
      const timeout = options.timeout || this._cluster.managementTimeout

      return PromiseHelper.wrapAsync(async () => {
        const [err, _] = await wrapObservableBindingCall(
          this._cluster.conn.managementSearchIndexDrop.bind(this._cluster.conn),
          {
            index_name: indexName,
            bucket_name: this._bucketName,
            scope_name: this._scopeName,
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
    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

    try {
      const timeout = options.timeout || this._cluster.managementTimeout

      return PromiseHelper.wrapAsync(async () => {
        const [err, resp] = await wrapObservableBindingCall(
          this._cluster.conn.managementSearchIndexGetDocumentsCount.bind(
            this._cluster.conn
          ),
          {
            index_name: indexName,
            bucket_name: this._bucketName,
            scope_name: this._scopeName,
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
    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

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
            bucket_name: this._bucketName,
            scope_name: this._scopeName,
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
    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

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
            bucket_name: this._bucketName,
            scope_name: this._scopeName,
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
    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

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
            bucket_name: this._bucketName,
            scope_name: this._scopeName,
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
    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

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
            bucket_name: this._bucketName,
            scope_name: this._scopeName,
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
    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

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
            bucket_name: this._bucketName,
            scope_name: this._scopeName,
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
    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

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
            bucket_name: this._bucketName,
            scope_name: this._scopeName,
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
    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

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
            bucket_name: this._bucketName,
            scope_name: this._scopeName,
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
