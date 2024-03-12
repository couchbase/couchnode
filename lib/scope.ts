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
import { NodeCallback, PromiseHelper } from './utilities'

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
  private _conn: CppConnection

  /**
  @internal
  */
  constructor(bucket: Bucket, scopeName: string) {
    this._bucket = bucket
    this._name = scopeName
    this._conn = bucket.conn
  }

  /**
  @internal
  */
  get conn(): CppConnection {
    return this._conn
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
   * Executes a N1QL query against the cluster scoped to this scope.
   *
   * @param statement The N1QL statement to execute.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  query<TRow = any>(
    statement: string,
    options?: QueryOptions,
    callback?: NodeCallback<QueryResult<TRow>>
  ): StreamableRowPromise<QueryResult<TRow>, TRow, QueryMetaData> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const bucket = this.bucket
    const exec = new QueryExecutor(this.cluster)

    const options_ = options
    return PromiseHelper.wrapAsync(
      () =>
        exec.query<TRow>(statement, {
          ...options_,
          queryContext: `${bucket.name}.${this.name}`,
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
   */
  analyticsQuery<TRow = any>(
    statement: string,
    options?: AnalyticsQueryOptions,
    callback?: NodeCallback<AnalyticsResult<TRow>>
  ): StreamableRowPromise<AnalyticsResult<TRow>, TRow, AnalyticsMetaData> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const bucket = this.bucket
    const exec = new AnalyticsExecutor(this.cluster)

    const options_ = options
    return PromiseHelper.wrapAsync(
      () =>
        exec.query<TRow>(statement, {
          ...options_,
          queryContext: `${bucket.name}.${this.name}`,
        }),
      callback
    )
  }

  /**
   * Executes a search query against the scope.
   *
   * Uncommitted: This API is subject to change in the future.
   *
   * @param indexName The name of the index to query.
   * @param request The SearchRequest describing the search to execute.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  search(
    indexName: string,
    request: SearchRequest,
    options?: SearchQueryOptions,
    callback?: NodeCallback<SearchResult>
  ): StreamableRowPromise<SearchResult, SearchRow, SearchMetaData> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const exec = new SearchExecutor(this.cluster, this._bucket.name, this._name)

    const options_ = options
    return PromiseHelper.wrapAsync(
      () => exec.query(indexName, request, options_),
      callback
    )
  }
}
