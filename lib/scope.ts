import { AnalyticsExecutor } from './analyticsexecutor'
import {
  AnalyticsMetaData,
  AnalyticsQueryOptions,
  AnalyticsResult,
} from './analyticstypes'
import { CppConnection } from './binding'
import { Bucket } from './bucket'
import { Cluster } from './cluster'
import { Collection } from './collection'
import { StreamingOp } from './observabilitytypes'
import { QueryExecutor } from './queryexecutor'
import { QueryMetaData, QueryOptions, QueryResult } from './querytypes'
import { SearchExecutor } from './searchexecutor'
import { ScopeSearchIndexManager } from './scopesearchindexmanager'
import {
  SearchMetaData,
  SearchQueryOptions,
  SearchRequest,
  SearchResult,
  SearchRow,
} from './searchtypes'
import { StreamableRowPromise } from './streamablepromises'
import { Transcoder } from './transcoders'
import { NodeCallback, PromiseHelper, callbackOf, optionsOf } from './utilities'
import { ScopeEventingFunctionManager } from './scopeeventingfunctionmanager'

/**
 * Exposes the operations which are available to be performed against a scope.
 * Namely the ability to access to Collections for performing operations.
 *
 * @category Core
 */
export class Scope {
  /**
   * @internal
   */
  static get DEFAULT_NAME(): string {
    return '_default'
  }

  private _bucket: Bucket
  private _name: string

  /**
  @internal
  */
  constructor(bucket: Bucket, scopeName: string) {
    this._bucket = bucket
    this._name = scopeName
  }

  /**
  @internal
  */
  get conn(): CppConnection {
    return this._bucket.conn
  }

  /**
  @internal
  */
  get bucket(): Bucket {
    return this._bucket
  }

  /**
  @internal
  */
  get cluster(): Cluster {
    return this._bucket.cluster
  }

  /**
  @internal
  */
  get transcoder(): Transcoder {
    return this._bucket.transcoder
  }

  /**
   * The name of the scope this Scope object references.
   */
  get name(): string {
    return this._name
  }

  /**
   * Creates a Collection object reference to a specific collection.
   *
   * @param collectionName The name of the collection to reference.
   */
  collection(collectionName: string): Collection {
    return new Collection(this, collectionName)
  }

  /**
   * Returns a SearchIndexManager which can be used to manage the search
   * indexes of this scope.
   */
  searchIndexes(): ScopeSearchIndexManager {
    return new ScopeSearchIndexManager(
      this.cluster,
      this.bucket.name,
      this._name
    )
  }

  /**
   * Returns a ScopeEventingFunctionManager which can be used to manage the eventing
   * functions of this scope.
   * Uncommitted: This API is subject to change in the future.
   */
  eventingFunctions(): ScopeEventingFunctionManager {
    return new ScopeEventingFunctionManager(
      this.cluster,
      this._bucket.name,
      this._name
    )
  }

  /**
   * Executes a N1QL query against the cluster scoped to this scope.
   *
   * @param statement The N1QL statement to execute.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   *   Deprecated: await the returned promise instead.
   */
  query<TRow = any>(
    statement: string,
    options?: QueryOptions,
    callback?: NodeCallback<QueryResult<TRow>>
  ): StreamableRowPromise<QueryResult<TRow>, TRow, QueryMetaData> {
    callback = callbackOf(options, callback)
    options = optionsOf(options)

    const bucket = this.bucket
    const options_ = options
    const backend = this.cluster.backend
    if (backend) {
      const scope = { bucketName: bucket.name, scopeName: this.name }
      const obs = this.cluster._streamingRequestHandler(
        StreamingOp.Query,
        options_.parentSpan,
        {
          statement,
          queryContext: `\`${bucket.name}\`.\`${this.name}\``,
          queryOptions: options_,
        }
      )
      return PromiseHelper.wrapAsync(
        () => backend.query.query<TRow>(statement, options_, scope, obs),
        callback
      )
    }

    const exec = new QueryExecutor(this.cluster)
    return PromiseHelper.wrapAsync(
      () =>
        exec.query<TRow>(statement, {
          ...options_,
          queryContext: `\`${bucket.name}\`.\`${this.name}\``,
        }),
      callback
    )
  }

  /**
   * Executes an analytics query against the cluster scoped this scope.
   *
   * @param statement The analytics statement to execute.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   *   Deprecated: await the returned promise instead.
   */
  analyticsQuery<TRow = any>(
    statement: string,
    options?: AnalyticsQueryOptions,
    callback?: NodeCallback<AnalyticsResult<TRow>>
  ): StreamableRowPromise<AnalyticsResult<TRow>, TRow, AnalyticsMetaData> {
    callback = callbackOf(options, callback)
    options = optionsOf(options)

    const bucket = this.bucket
    const exec = new AnalyticsExecutor(this.cluster)

    const options_ = options
    return PromiseHelper.wrapAsync(
      () =>
        exec.query<TRow>(statement, {
          ...options_,
          queryContext: `\`${bucket.name}\`.\`${this.name}\``,
        }),
      callback
    )
  }

  /**
   * Executes a search query against the scope.
   *
   * @param indexName The name of the index to query.
   * @param request The SearchRequest describing the search to execute.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   *   Deprecated: await the returned promise instead.
   */
  search(
    indexName: string,
    request: SearchRequest,
    options?: SearchQueryOptions,
    callback?: NodeCallback<SearchResult>
  ): StreamableRowPromise<SearchResult, SearchRow, SearchMetaData> {
    callback = callbackOf(options, callback)
    options = optionsOf(options)

    const exec = new SearchExecutor(this.cluster, this._bucket.name, this._name)

    const options_ = options
    return PromiseHelper.wrapAsync(
      () => exec.query(indexName, request, options_),
      callback
    )
  }
}
