import { Bucket } from './bucket'
import {
  CollectionExistsError,
  CollectionNotFoundError,
  CouchbaseError,
  FeatureNotAvailableError,
  ScopeExistsError,
  ScopeNotFoundError,
} from './errors'
import { HttpExecutor, HttpMethod, HttpServiceType } from './httpexecutor'
import { RequestSpan } from './tracing'
import { cbQsStringify, NodeCallback, PromiseHelper } from './utilities'

/**
 * Provides options for configuring a collection.
 *
 * @category Management
 */
export interface ICollectionSpec {
  /**
   * The name of the scope.
   */
  name: string

  /**
   * The name of the scope containing this collection.
   */
  scopeName: string

  /**
   * The maximum expiry for documents in this collection.
   *
   * @see {@link IBucketSettings.maxExpiry}
   */
  maxExpiry?: number
}

/**
 * Contains information about a collection.
 *
 * @category Management
 */
export class CollectionSpec {
  /**
   * The name of the collection.
   */
  name: string

  /**
   * The name of the scope this collection exists in.
   */
  scopeName: string

  /**
   * The maximum expiry for documents in this collection.
   *
   * @see {@link IBucketSettings.maxExpiry}
   */
  maxExpiry: number

  /**
   * @internal
   */
  constructor(data: CollectionSpec) {
    this.name = data.name
    this.scopeName = data.scopeName
    this.maxExpiry = data.maxExpiry
  }

  /**
   * @internal
   */
  static _fromNsData(scopeName: string, data: any): CollectionSpec {
    return new CollectionSpec({
      name: data.name,
      scopeName: scopeName,
      maxExpiry: data.maxTTL,
    })
  }

  /**
   * @internal
   */
  static _toNsData(data: ICollectionSpec): any {
    return {
      name: data.name,
      maxTTL: data.maxExpiry,
    }
  }
}

/**
 * Contains information about a scope.
 *
 * @category Management
 */
export class ScopeSpec {
  /**
   * The name of the scope.
   */
  name: string

  /**
   * The collections which exist in this scope.
   */
  collections: CollectionSpec[]

  /**
   * @internal
   */
  constructor(data: ScopeSpec) {
    this.name = data.name
    this.collections = data.collections
  }

  /**
   * @internal
   */
  static _fromNsData(data: any): ScopeSpec {
    let collections: CollectionSpec[]
    if (data.collections) {
      const scopeName = data.name
      collections = data.collections.map((collectionData: any) =>
        CollectionSpec._fromNsData(scopeName, collectionData)
      )
    } else {
      collections = []
    }

    return new ScopeSpec({
      name: data.name,
      collections: collections,
    })
  }
}

/**
 * @category Management
 */
export interface CreateCollectionOptions {
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
export interface GetAllScopesOptions {
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
export interface DropCollectionOptions {
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
export interface CreateScopeOptions {
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
export interface DropScopeOptions {
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
 * CollectionManager allows the management of collections within a Bucket.
 *
 * @category Management
 */
export class CollectionManager {
  private _bucket: Bucket

  /**
   * @internal
   */
  constructor(bucket: Bucket) {
    this._bucket = bucket
  }

  private get _http() {
    return new HttpExecutor(this._bucket.conn)
  }

  /**
   * Returns all configured scopes along with their collections.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getAllScopes(
    options?: GetAllScopesOptions,
    callback?: NodeCallback<ScopeSpec[]>
  ): Promise<ScopeSpec[]> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const bucketName = this._bucket.name
    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Management,
        method: HttpMethod.Get,
        path: `/pools/default/buckets/${bucketName}/scopes`,
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        const errText = res.body.toString().toLowerCase()
        if (
          errText.includes('not allowed on this version of cluster') ||
          res.statusCode === 404
        ) {
          throw new FeatureNotAvailableError(undefined, errCtx)
        }

        throw new CouchbaseError('failed to get scopes', undefined, errCtx)
      }

      const scopesData = JSON.parse(res.body.toString())
      const scopes = scopesData.scopes.map((scopeData: any) =>
        ScopeSpec._fromNsData(scopeData)
      )
      return scopes
    }, callback)
  }

  /**
   * Creates a collection in a scope.
   *
   * @deprecated Use the other overload instead.
   */
  async createCollection(
    collectionName: string,
    scopeName: string,
    options?: CreateCollectionOptions,
    callback?: NodeCallback<void>
  ): Promise<void>

  /**
   * Creates a collection in a scope.
   *
   * @param collectionSpec Specifies the settings for the new collection.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async createCollection(
    collectionSpec: ICollectionSpec,
    options?: CreateCollectionOptions,
    callback?: NodeCallback<void>
  ): Promise<void>

  /**
   * @internal
   */
  async createCollection(): Promise<void> {
    let collectionSpec: ICollectionSpec = arguments[0]
    let options: CreateCollectionOptions | undefined = arguments[1]
    let callback: NodeCallback<void> | undefined = arguments[2]

    // Deprecated usage conversion for (name, scopeName, options, callback)
    if (typeof collectionSpec === 'string') {
      collectionSpec = {
        name: arguments[0],
        scopeName: arguments[1],
      }
      options = arguments[2]
      callback = arguments[3]
    }

    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const bucketName = this._bucket.name
    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const collectionData = CollectionSpec._toNsData(collectionSpec)

      const res = await this._http.request({
        type: HttpServiceType.Management,
        method: HttpMethod.Post,
        path: `/pools/default/buckets/${bucketName}/scopes/${collectionSpec.scopeName}/collections`,
        contentType: 'application/x-www-form-urlencoded',
        body: cbQsStringify(collectionData),
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        const errText = res.body.toString().toLowerCase()
        if (
          errText.includes('already exists') &&
          errText.includes('collection')
        ) {
          throw new CollectionExistsError(undefined, errCtx)
        }
        if (errText.includes('not found') && errText.includes('scope')) {
          throw new ScopeNotFoundError(undefined, errCtx)
        }
        if (
          errText.includes('not allowed on this version of cluster') ||
          res.statusCode === 404
        ) {
          throw new FeatureNotAvailableError(undefined, errCtx)
        }

        throw new CouchbaseError(
          'failed to create collection',
          undefined,
          errCtx
        )
      }
    }, callback)
  }

  /**
   * Drops a collection from a scope.
   *
   * @param collectionName The name of the collection to drop.
   * @param scopeName The name of the scope containing the collection to drop.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async dropCollection(
    collectionName: string,
    scopeName: string,
    options?: DropCollectionOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const bucketName = this._bucket.name
    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Management,
        method: HttpMethod.Delete,
        path: `/pools/default/buckets/${bucketName}/scopes/${scopeName}/collections/${collectionName}`,
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        const errText = res.body.toString().toLowerCase()
        if (errText.includes('not found') && errText.includes('collection')) {
          throw new CollectionNotFoundError(undefined, errCtx)
        }
        if (errText.includes('not found') && errText.includes('scope')) {
          throw new ScopeNotFoundError(undefined, errCtx)
        }
        if (
          errText.includes('not allowed on this version of cluster') ||
          res.statusCode === 404
        ) {
          throw new FeatureNotAvailableError(undefined, errCtx)
        }

        throw new CouchbaseError('failed to drop collection', undefined, errCtx)
      }
    }, callback)
  }

  /**
   * Creates a new scope.
   *
   * @param scopeName The name of the new scope to create.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async createScope(
    scopeName: string,
    options?: CreateScopeOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const bucketName = this._bucket.name
    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Management,
        method: HttpMethod.Post,
        path: `/pools/default/buckets/${bucketName}/scopes`,
        contentType: 'application/x-www-form-urlencoded',
        body: cbQsStringify({
          name: scopeName,
        }),
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        const errText = res.body.toString().toLowerCase()
        if (errText.includes('already exists') && errText.includes('scope')) {
          throw new ScopeExistsError(undefined, errCtx)
        }
        if (
          errText.includes('not allowed on this version of cluster') ||
          res.statusCode === 404
        ) {
          throw new FeatureNotAvailableError(undefined, errCtx)
        }

        throw new CouchbaseError('failed to create scope', undefined, errCtx)
      }
    }, callback)
  }

  /**
   * Drops a scope.
   *
   * @param scopeName The name of the scope to drop.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async dropScope(
    scopeName: string,
    options?: DropScopeOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const bucketName = this._bucket.name
    const parentSpan = options.parentSpan
    const timeout = options.timeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Management,
        method: HttpMethod.Delete,
        path: `/pools/default/buckets/${bucketName}/scopes/${scopeName}`,
        parentSpan: parentSpan,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        const errText = res.body.toString().toLowerCase()
        if (errText.includes('not found') && errText.includes('scope')) {
          throw new ScopeNotFoundError(undefined, errCtx)
        }
        if (
          errText.includes('not allowed on this version of cluster') ||
          res.statusCode === 404
        ) {
          throw new FeatureNotAvailableError(undefined, errCtx)
        }

        throw new CouchbaseError('failed to drop scope', undefined, errCtx)
      }
    }, callback)
  }
}
