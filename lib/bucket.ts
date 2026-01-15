import { CppConnection } from './binding'
import { Cluster } from './cluster'
import { Collection } from './collection'
import { CollectionManager } from './collectionmanager'
import { PingExecutor } from './diagnosticsexecutor'
import { PingOptions, PingResult } from './diagnosticstypes'
import { Scope } from './scope'
import { StreamableRowPromise } from './streamablepromises'
import { Transcoder } from './transcoders'
import { NodeCallback, PromiseHelper } from './utilities'
import { ViewExecutor } from './viewexecutor'
import { ViewIndexManager } from './viewindexmanager'
import {
  ViewMetaData,
  ViewQueryOptions,
  ViewResult,
  ViewRow,
} from './viewtypes'

/**
 * Exposes the operations which are available to be performed against a bucket.
 * Namely the ability to access to Collections as well as performing management
 * operations against the bucket.
 *
 * @category Core
 */
export class Bucket {
  private _cluster: Cluster
  private _name: string
  private _conn: CppConnection

  /**
  @internal
  */
  constructor(cluster: Cluster, bucketName: string) {
    this._cluster = cluster
    this._name = bucketName
    this._conn = cluster.conn
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
  get cluster(): Cluster {
    return this._cluster
  }

  /**
  @internal
  */
  get transcoder(): Transcoder {
    return this._cluster.transcoder
  }

  /**
   * The name of the bucket this Bucket object references.
   */
  get name(): string {
    return this._name
  }

  /**
   * Creates a Scope object reference to a specific scope.
   *
   * @param scopeName The name of the scope to reference.
   */
  scope(scopeName: string): Scope {
    return new Scope(this, scopeName)
  }

  /**
   * Creates a Scope object reference to the default scope.
   */
  defaultScope(): Scope {
    return this.scope(Scope.DEFAULT_NAME)
  }

  /**
   * Creates a Collection object reference to a specific collection.
   *
   * @param collectionName The name of the collection to reference.
   */
  collection(collectionName: string): Collection {
    const scope = this.defaultScope()
    return scope.collection(collectionName)
  }

  /**
   * Creates a Collection object reference to the default collection.
   */
  defaultCollection(): Collection {
    return this.collection(Collection.DEFAULT_NAME)
  }

  /**
   * Returns a ViewIndexManager which can be used to manage the view indexes
   * of this bucket.
   *
   * @deprecated Since version 4.7.0. Views are deprecated in Couchbase Server 7.0+, and will be removed from a future server version.
   *             Views are not compatible with the Magma storage engine. Instead of views, use indexes and queries using the
   *             Index Service (GSI) and the Query Service (SQL++).
   */
  viewIndexes(): ViewIndexManager {
    return new ViewIndexManager(this)
  }

  /**
   * Returns a CollectionManager which can be used to manage the collections
   * of this bucket.
   */
  collections(): CollectionManager {
    return new CollectionManager(this)
  }

  /**
   * Executes a view query.
   *
   * @deprecated Since version 4.7.0. Views are deprecated in Couchbase Server 7.0+, and will be removed from a future server version.
   *             Views are not compatible with the Magma storage engine. Instead of views, use indexes and queries using the
   *             Index Service (GSI) and the Query Service (SQL++).
   *
   * @param designDoc The name of the design document containing the view to execute.
   * @param viewName The name of the view to execute.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  viewQuery<TValue = any, TKey = any>(
    designDoc: string,
    viewName: string,
    options?: ViewQueryOptions,
    callback?: NodeCallback<ViewResult<TValue, TKey>>
  ): StreamableRowPromise<
    ViewResult<TValue, TKey>,
    ViewRow<TValue, TKey>,
    ViewMetaData
  > {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const exec = new ViewExecutor(this)

    const options_ = options
    return PromiseHelper.wrapAsync(
      () => exec.query<TValue, TKey>(designDoc, viewName, options_),
      callback
    )
  }

  /**
   * Performs a ping operation against the cluster.  Pinging the bucket services
   * which are specified (or all services if none are specified).  Returns a report
   * which describes the outcome of the ping operations which were performed.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  ping(
    options?: PingOptions,
    callback?: NodeCallback<PingResult>
  ): Promise<PingResult> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const exec = new PingExecutor(this._cluster)

    const options_ = options
    return PromiseHelper.wrapAsync(
      () =>
        exec.ping({
          ...options_,
          bucket: this.name,
        }),
      callback
    )
  }
}
