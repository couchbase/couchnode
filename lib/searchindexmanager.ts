import { Cluster } from './cluster'
import { IndexNotFoundError } from './errors'
import { HttpExecutor, HttpMethod, HttpServiceType } from './httpexecutor'
import { RequestSpan } from './tracing'
import { NodeCallback, PromiseHelper } from './utilities'

/**
 * Provides information about a search index.  This class is currently
 * incomplete and must be casted from `any` in TypeScript.
 *
 * @category Management
 */
export interface ISearchIndex {
  /**
   * The name of the search index.
   */
  name: string
}

/**
 * This class is currently incomplete and must be casted to `any` in
 * TypeScript to be used.
 *
 * @category Management
 */
export class SearchIndex {
  /**
   * The name of the search index.
   */
  name: string

  /**
   * @internal
   */
  constructor(data: SearchIndex) {
    this.name = data.name
  }
}

/**
 * @category Management
 */
export interface GetSearchIndexOptions {
  /**
   * The parent tracing span that this operation will be part of.
   */
  parentSpan?: RequestSpan

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface GetAllSearchIndexesOptions {
  /**
   * The parent tracing span that this operation will be part of.
   */
  parentSpan?: RequestSpan

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface UpsertSearchIndexOptions {
  /**
   * The parent tracing span that this operation will be part of.
   */
  parentSpan?: RequestSpan

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DropSearchIndexOptions {
  /**
   * The parent tracing span that this operation will be part of.
   */
  parentSpan?: RequestSpan

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface GetSearchIndexedDocumentsCountOptions {
  /**
   * The parent tracing span that this operation will be part of.
   */
  parentSpan?: RequestSpan

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface PauseSearchIngestOptions {
  /**
   * The parent tracing span that this operation will be part of.
   */
  parentSpan?: RequestSpan

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface ResumeSearchIngestOptions {
  /**
   * The parent tracing span that this operation will be part of.
   */
  parentSpan?: RequestSpan

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface AllowSearchQueryingOptions {
  /**
   * The parent tracing span that this operation will be part of.
   */
  parentSpan?: RequestSpan

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DisallowSearchQueryingOptions {
  /**
   * The parent tracing span that this operation will be part of.
   */
  parentSpan?: RequestSpan

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface FreezeSearchPlanOptions {
  /**
   * The parent tracing span that this operation will be part of.
   */
  parentSpan?: RequestSpan

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface UnfreezeSearchPlanOptions {
  /**
   * The parent tracing span that this operation will be part of.
   */
  parentSpan?: RequestSpan

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface AnalyzeSearchDocumentOptions {
  /**
   * The parent tracing span that this operation will be part of.
   */
  parentSpan?: RequestSpan

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
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

  private get _http() {
    return new HttpExecutor(this._cluster._getClusterConn())
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
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Search,
        method: HttpMethod.Get,
        path: `/api/index/${indexName}`,
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        throw new IndexNotFoundError()
      }

      return JSON.parse(res.body.toString())
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

    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Search,
        method: HttpMethod.Get,
        path: `/api/index`,
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        throw new Error('failed to fetch search indices')
      }

      return JSON.parse(res.body.toString())
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

    const indexName = indexDefinition.name
    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Search,
        method: HttpMethod.Put,
        path: `/api/index/${indexName}`,
        contentType: 'application/json',
        body: JSON.stringify(indexDefinition),
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        throw new Error('failed to create index')
      }
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

    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Search,
        method: HttpMethod.Delete,
        path: `/api/index/${indexName}`,
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        throw new Error('failed to delete search index')
      }

      return JSON.parse(res.body.toString())
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

    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Search,
        method: HttpMethod.Get,
        path: `/api/index/${indexName}/count`,
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        throw new Error('failed to get search indexed documents count')
      }

      return JSON.parse(res.body.toString()).count
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

    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Search,
        method: HttpMethod.Post,
        path: `/api/index/${indexName}/ingestControl/pause`,
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        throw new Error('failed to pause search index ingestion')
      }
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

    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Search,
        method: HttpMethod.Post,
        path: `/api/index/${indexName}/ingestControl/resume`,
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        throw new Error('failed to resume search index ingestion')
      }
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

    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Search,
        method: HttpMethod.Post,
        path: `/api/index/${indexName}/queryControl/allow`,
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        throw new Error('failed to allow search index quering')
      }
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

    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Search,
        method: HttpMethod.Post,
        path: `/api/index/${indexName}/queryControl/disallow`,
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        throw new Error('failed to disallow search index quering')
      }
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

    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Search,
        method: HttpMethod.Post,
        path: `/api/index/${indexName}/planFreezeControl/freeze`,
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        throw new Error('failed to freeze search index plan')
      }
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
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Search,
        method: HttpMethod.Post,
        path: `/api/index/${indexName}/analyzeDoc`,
        body: JSON.stringify(document),
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        throw new Error('failed to perform search index document analysis')
      }

      return JSON.parse(res.body.toString()).analyze
    }, callback)
  }
}
