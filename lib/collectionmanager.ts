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
 * This is intentionally unexported as we don't return it to the user.
 *
 * @internal
 */
class CollectionSpec {
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
 * @category Management
 */
export interface CreateCollectionOptions {
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
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DropCollectionOptions {
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
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DropScopeOptions {
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
    const timeout = options.timeout
    return PromiseHelper.wrapAsync(async () => {
      const collectionData = CollectionSpec._toNsData(collectionSpec)

      const res = await this._http.request({
        type: HttpServiceType.Management,
        method: HttpMethod.Post,
        path: `/pools/default/buckets/${bucketName}/scopes/${collectionSpec.scopeName}/collections`,
        contentType: 'application/x-www-form-urlencoded',
        body: cbQsStringify(collectionData),
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
        if (
          errText.includes('already exists') &&
          errText.includes('collection')
        ) {
          throw new CollectionExistsError(undefined, errCtx)
        }
        if (errText.includes('not found') && errText.includes('scope')) {
          throw new ScopeNotFoundError(undefined, errCtx)
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
    const timeout = options.timeout
    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Management,
        method: HttpMethod.Delete,
        path: `/pools/default/buckets/${bucketName}/scopes/${scopeName}/collections/${collectionName}`,
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
        if (errText.includes('not found') && errText.includes('collection')) {
          throw new CollectionNotFoundError(undefined, errCtx)
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
        if (errText.includes('already exists') && errText.includes('scope')) {
          throw new ScopeExistsError(undefined, errCtx)
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
    const timeout = options.timeout
    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Management,
        method: HttpMethod.Delete,
        path: `/pools/default/buckets/${bucketName}/scopes/${scopeName}`,
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
        if (errText.includes('not found') && errText.includes('scope')) {
          throw new ScopeNotFoundError(undefined, errCtx)
        }

        throw new CouchbaseError('failed to drop scope', undefined, errCtx)
      }
    }, callback)
  }
}
