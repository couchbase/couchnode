import { Bucket } from './bucket'
import { CompoundTimeout, NodeCallback, PromiseHelper } from './utilities'
import { DesignDocumentNamespace } from './viewtypes'
import {
  CppManagementViewsDesignDocument,
  CppManagementViewsDesignDocumentView,
} from './binding'
import {
  designDocumentNamespaceFromCpp,
  designDocumentNamespaceToCpp,
} from './bindingutilities'
import { wrapObservableBindingCall } from './observability'
import { ObservableRequestHandler } from './observabilityhandler'
import { ViewIndexMgmtOp, ObservabilityInstruments } from './observabilitytypes'
import { RequestSpan } from './tracing'

/**
 * Contains information about a view in a design document.
 *
 * @category Management
 */
export class DesignDocumentView {
  /**
   * The mapping function to use for this view.
   */
  map: string | undefined

  /**
   * The reduction function to use for this view.
   */
  reduce: string | undefined

  constructor(data: { map?: string; reduce?: string })

  /**
   * @deprecated
   */
  constructor(map?: string, reduce?: string)

  /**
   * @internal
   */
  constructor(...args: any[]) {
    let data
    if (typeof args[0] === 'string' || typeof args[0] === 'function') {
      data = {
        map: args[0],
        reduce: args[1],
      }
    } else {
      data = args[0]
    }

    this.map = data.map
    this.reduce = data.reduce
  }

  /**
   * @internal
   */
  static _toCppData(
    name: string,
    data: DesignDocumentView
  ): CppManagementViewsDesignDocumentView {
    return {
      name: name,
      map: data.map,
      reduce: data.reduce,
    }
  }

  /**
   * @internal
   */
  static _fromCppData(
    data: CppManagementViewsDesignDocumentView
  ): DesignDocumentView {
    return new DesignDocumentView({
      map: data.map,
      reduce: data.reduce,
    })
  }
}

/**
 * Contains information about a design document.
 *
 * @category Management
 */
export class DesignDocument {
  /**
   * Same as {@link DesignDocumentView}.
   *
   * @deprecated Use {@link DesignDocumentView} directly.
   */
  static get View(): any {
    return DesignDocumentView
  }

  /**
   * The name of the design document.
   */
  name: string

  /**
   * A map of the views that exist in this design document.
   */
  views: { [viewName: string]: DesignDocumentView }

  /**
   * The namespace for this design document.
   */
  namespace: DesignDocumentNamespace

  /**
   * The revision of the design document.
   */
  rev: string | undefined

  constructor(data: {
    name: string
    views?: { [viewName: string]: DesignDocumentView }
    namespace?: DesignDocumentNamespace
    rev?: string
  })

  /**
   * @deprecated
   */
  constructor(name: string, views: { [viewName: string]: DesignDocumentView })

  /**
   * @internal
   */
  constructor(...args: any[]) {
    let data
    if (typeof args[0] === 'string') {
      data = {
        name: args[0],
        views: args[1],
      }
    } else {
      data = args[0]
    }

    this.name = data.name
    this.views = data.views || {}
    this.namespace = data.namespace || DesignDocumentNamespace.Production
    this.rev = data.rev
  }

  /**
   * @internal
   */
  static _fromNsData(ddocName: string, ddocData: any): DesignDocument {
    const views: { [viewName: string]: DesignDocumentView } = {}
    for (const viewName in ddocData.views) {
      const viewData = ddocData.views[viewName]
      views[viewName] = new DesignDocumentView({
        map: viewData.map,
        reduce: viewData.reduce,
      })
    }

    return new DesignDocument({ name: ddocName, views: views })
  }

  /**
   * @internal
   */
  static _toCppData(
    data: DesignDocument,
    namespace: DesignDocumentNamespace
  ): CppManagementViewsDesignDocument {
    const cppView: { [key: string]: CppManagementViewsDesignDocumentView } = {}
    for (const [k, v] of Object.entries(data.views)) {
      cppView[k] = DesignDocumentView._toCppData(k, v)
    }
    return {
      rev: data.rev,
      name: data.name,
      ns: designDocumentNamespaceToCpp(namespace),
      views: cppView,
    }
  }

  /**
   * @internal
   */
  static _fromCppData(ddoc: CppManagementViewsDesignDocument): DesignDocument {
    const views: { [viewName: string]: DesignDocumentView } = {}
    for (const [viewName, viewData] of Object.entries(ddoc.views)) {
      views[viewName] = DesignDocumentView._fromCppData(viewData)
    }

    return new DesignDocument({
      name: ddoc.name,
      views: views,
      namespace: designDocumentNamespaceFromCpp(ddoc.ns),
      rev: ddoc.rev,
    })
  }
}

/**
 * @category Management
 */
export interface GetAllDesignDocumentOptions {
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
export interface GetDesignDocumentOptions {
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
export interface UpsertDesignDocumentOptions {
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
export interface DropDesignDocumentOptions {
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
export interface PublishDesignDocumentOptions {
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
 * ViewIndexManager is an interface which enables the management
 * of view indexes on the cluster.
 *
 * @deprecated Since version 4.7.0. Views are deprecated in Couchbase Server 7.0+, and will be removed from a future server version.
 *             Views are not compatible with the Magma storage engine. Instead of views, use indexes and queries using the
 *             Index Service (GSI) and the Query Service (SQL++).
 *
 * @category Management
 */
export class ViewIndexManager {
  private _bucket: Bucket

  /**
   * @internal
   */
  constructor(bucket: Bucket) {
    this._bucket = bucket
  }

  /**
   * @internal
   */
  private get _cluster() {
    return this._bucket.cluster
  }

  /**
   * @internal
   */
  get observabilityInstruments(): ObservabilityInstruments {
    return this._bucket.cluster.observabilityInstruments
  }

  /**
   * Returns a list of all the design documents in this bucket.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   * @deprecated
   */
  async getAllDesignDocuments(
    options?: GetAllDesignDocumentOptions,
    callback?: NodeCallback<DesignDocument[]>
  ): Promise<DesignDocument[]>

  /**
   * Returns a list of all the design documents in this bucket.
   *
   * @param namespace The DesignDocument namespace.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getAllDesignDocuments(
    namespace: DesignDocumentNamespace,
    options?: GetAllDesignDocumentOptions,
    callback?: NodeCallback<DesignDocument[]>
  ): Promise<DesignDocument[]>

  /**
   * @internal
   */
  async getAllDesignDocuments(): Promise<DesignDocument[]> {
    let namespace: DesignDocumentNamespace | undefined
    let options: GetAllDesignDocumentOptions | undefined
    let callback: NodeCallback<DesignDocument[]> | undefined
    if (typeof arguments[0] === 'object') {
      namespace = undefined
      options = arguments[0]
      callback = arguments[1]
    } else if (arguments[0] instanceof Function) {
      namespace = undefined
      options = undefined
      callback = arguments[0]
    } else {
      namespace = arguments[0]
      if (arguments[1] instanceof Function) {
        callback = arguments[1]
        options = undefined
      } else {
        options = arguments[1]
        callback = arguments[2]
      }
    }

    if (!options) {
      options = {}
    }

    const obsReqHandler = new ObservableRequestHandler(
      ViewIndexMgmtOp.ViewIndexGetAll,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes()

    try {
      const timeout = options.timeout || this._cluster.managementTimeout
      const ns = namespace ?? DesignDocumentNamespace.Production

      return PromiseHelper.wrapAsync(async () => {
        const [err, resp] = await wrapObservableBindingCall(
          this._cluster.conn.managementViewIndexGetAll.bind(this._cluster.conn),
          {
            bucket_name: this._bucket.name,
            ns: designDocumentNamespaceToCpp(ns),
            timeout: timeout,
          },
          obsReqHandler
        )
        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }
        obsReqHandler.end()
        return resp.design_documents.map((ddoc) =>
          DesignDocument._fromCppData(ddoc)
        )
      }, callback)
    } catch (err) {
      obsReqHandler.endWithError(err)
      throw err
    }
  }

  /**
   * Returns the specified design document.
   *
   * @param designDocName The name of the design document to fetch.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   * @deprecated
   */
  async getDesignDocument(
    designDocName: string,
    options?: GetDesignDocumentOptions,
    callback?: NodeCallback<DesignDocument>
  ): Promise<DesignDocument>

  /**
   * Returns the specified design document.
   *
   * @param designDocName The name of the design document to fetch.
   * @param namespace The DesignDocument namespace.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getDesignDocument(
    designDocName: string,
    namespace: DesignDocumentNamespace,
    options?: GetDesignDocumentOptions,
    callback?: NodeCallback<DesignDocument>
  ): Promise<DesignDocument>

  /**
   * @internal
   */
  async getDesignDocument(): Promise<DesignDocument> {
    let designDocName: string = arguments[0]
    let namespace: DesignDocumentNamespace | undefined
    let options: GetDesignDocumentOptions | undefined
    let callback: NodeCallback<DesignDocument> | undefined
    if (typeof arguments[1] === 'object') {
      namespace = undefined
      options = arguments[1]
      callback = arguments[2]
    } else if (arguments[1] instanceof Function) {
      namespace = undefined
      options = undefined
      callback = arguments[1]
    } else {
      namespace = arguments[1]
      if (arguments[2] instanceof Function) {
        callback = arguments[2]
        options = undefined
      } else {
        options = arguments[2]
        callback = arguments[3]
      }
    }
    if (!options) {
      options = {}
    }

    const obsReqHandler = new ObservableRequestHandler(
      ViewIndexMgmtOp.ViewIndexGet,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes()

    try {
      const timeout = options.timeout || this._cluster.managementTimeout
      if (designDocName.startsWith('dev_')) {
        namespace = DesignDocumentNamespace.Development
        designDocName = designDocName.substring(4)
      }
      const ns = namespace ?? DesignDocumentNamespace.Production

      return PromiseHelper.wrapAsync(async () => {
        const [err, resp] = await wrapObservableBindingCall(
          this._cluster.conn.managementViewIndexGet.bind(this._cluster.conn),
          {
            bucket_name: this._bucket.name,
            document_name: designDocName,
            ns: designDocumentNamespaceToCpp(ns),
            timeout: timeout,
          },
          obsReqHandler
        )
        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }
        obsReqHandler.end()
        return DesignDocument._fromCppData(resp.document)
      }, callback)
    } catch (err) {
      obsReqHandler.endWithError(err)
      throw err
    }
  }

  /**
   * Creates or updates a design document.
   *
   * @param designDoc The DesignDocument to upsert.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   * @deprecated
   */
  async upsertDesignDocument(
    designDoc: DesignDocument,
    options?: UpsertDesignDocumentOptions,
    callback?: NodeCallback<void>
  ): Promise<void>

  /**
   * Creates or updates a design document.
   *
   * @param designDoc The DesignDocument to upsert.
   * @param namespace The DesignDocument namespace.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async upsertDesignDocument(
    designDoc: DesignDocument,
    namespace?: DesignDocumentNamespace,
    options?: UpsertDesignDocumentOptions,
    callback?: NodeCallback<void>
  ): Promise<void>

  /**
   * @internal
   */
  async upsertDesignDocument(): Promise<void> {
    const designDoc: DesignDocument = arguments[0]
    let namespace: DesignDocumentNamespace | undefined
    let options: UpsertDesignDocumentOptions | undefined
    let callback: NodeCallback<void> | undefined
    if (typeof arguments[1] === 'object') {
      namespace = undefined
      options = arguments[1]
      callback = arguments[2]
    } else if (arguments[1] instanceof Function) {
      namespace = undefined
      options = undefined
      callback = arguments[1]
    } else {
      namespace = arguments[1]
      if (arguments[2] instanceof Function) {
        callback = arguments[2]
        options = undefined
      } else {
        options = arguments[2]
        callback = arguments[3]
      }
    }
    if (!options) {
      options = {}
    }

    const obsReqHandler = new ObservableRequestHandler(
      ViewIndexMgmtOp.ViewIndexUpsert,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes()

    try {
      const timeout = options.timeout || this._cluster.managementTimeout
      if (designDoc.name.startsWith('dev_')) {
        namespace = DesignDocumentNamespace.Development
        designDoc.name = designDoc.name.substring(4)
      }
      const ns = namespace ?? DesignDocumentNamespace.Production

      return PromiseHelper.wrapAsync(async () => {
        const [err, _] = await wrapObservableBindingCall(
          this._cluster.conn.managementViewIndexUpsert.bind(this._cluster.conn),
          {
            bucket_name: this._bucket.name,
            document: DesignDocument._toCppData(designDoc, ns),
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
   * Drops an existing design document.
   *
   * @param designDocName The name of the design document to drop.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   * @deprecated
   */
  async dropDesignDocument(
    designDocName: string,
    options?: DropDesignDocumentOptions,
    callback?: NodeCallback<void>
  ): Promise<void>

  /**
   * Drops an existing design document.
   *
   * @param designDocName The name of the design document to drop.
   * @param namespace The DesignDocument namespace.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async dropDesignDocument(
    designDocName: string,
    namespace: DesignDocumentNamespace,
    options?: DropDesignDocumentOptions,
    callback?: NodeCallback<void>
  ): Promise<void>

  /**
   * @internal
   */
  async dropDesignDocument(): Promise<void> {
    let designDocName: string = arguments[0]
    let namespace: DesignDocumentNamespace | undefined
    let options: DropDesignDocumentOptions | undefined
    let callback: NodeCallback<void> | undefined
    if (typeof arguments[1] === 'object') {
      namespace = undefined
      options = arguments[1]
      callback = arguments[2]
    } else if (arguments[1] instanceof Function) {
      namespace = undefined
      options = undefined
      callback = arguments[1]
    } else {
      namespace = arguments[1]
      if (arguments[2] instanceof Function) {
        callback = arguments[2]
        options = undefined
      } else {
        options = arguments[2]
        callback = arguments[3]
      }
    }
    if (!options) {
      options = {}
    }

    const obsReqHandler = new ObservableRequestHandler(
      ViewIndexMgmtOp.ViewIndexDrop,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes()

    try {
      const timeout = options.timeout || this._cluster.managementTimeout
      if (designDocName.startsWith('dev_')) {
        namespace = DesignDocumentNamespace.Development
        designDocName = designDocName.substring(4)
      }
      const ns = namespace ?? DesignDocumentNamespace.Production

      return PromiseHelper.wrapAsync(async () => {
        const [err, _] = await wrapObservableBindingCall(
          this._cluster.conn.managementViewIndexDrop.bind(this._cluster.conn),
          {
            bucket_name: this._bucket.name,
            document_name: designDocName,
            ns: designDocumentNamespaceToCpp(ns),
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
   * Publishes a development design document to be a production design document.
   * It does this by fetching the design document by the passed name with `dev_`
   * appended, and then performs an upsert of the production name (no `dev_`)
   * with the data which was just fetched.
   *
   * @param designDocName The name of the design document to publish.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async publishDesignDocument(
    designDocName: string,
    options?: PublishDesignDocumentOptions,
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
      ViewIndexMgmtOp.ViewIndexPublish,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes()

    try {
      const timeout = options.timeout || this._cluster.managementTimeout
      const timer = new CompoundTimeout(timeout)

      return PromiseHelper.wrapAsync(async () => {
        const designDoc = await this.getDesignDocument(
          designDocName,
          DesignDocumentNamespace.Development,
          {
            timeout: timer.left(),
            parentSpan: obsReqHandler.wrappedSpan,
          }
        )

        await this.upsertDesignDocument(
          designDoc,
          DesignDocumentNamespace.Production,
          {
            timeout: timer.left(),
            parentSpan: obsReqHandler.wrappedSpan,
          }
        )
      }, callback)
    } catch (err) {
      obsReqHandler.endWithError(err)
      throw err
    }
  }
}
