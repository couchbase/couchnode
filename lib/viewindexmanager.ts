import { Bucket } from './bucket'
import { CompoundTimeout, NodeCallback, PromiseHelper } from './utilities'
import { DesignDocumentNamespace } from './viewtypes'
import {
  CppManagementViewsDesignDocument,
  CppManagementViewsDesignDocumentView,
} from './binding'
import {
  errorFromCpp,
  designDocumentNamespaceFromCpp,
  designDocumentNamespaceToCpp,
} from './bindingutilities'

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
}

/**
 * @category Management
 */
export interface GetDesignDocumentOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface UpsertDesignDocumentOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DropDesignDocumentOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface PublishDesignDocumentOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * ViewIndexManager is an interface which enables the management
 * of view indexes on the cluster.
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
    // deprecated path: options and maybe callback passed in
    if (typeof arguments[0] === 'object') {
      namespace = undefined
      options = arguments[0]
      callback = arguments[1]
    } else if (arguments[0] instanceof Function) {
      // deprecated path: no options, only callback passed in
      namespace = undefined
      options = undefined
      callback = arguments[0]
    } else {
      // either no args passed in or desired path (namespace is 1st arg)
      namespace = arguments[0]
      // still need to handle possible no options, but callback passed in
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

    const timeout = options.timeout || this._cluster.managementTimeout
    const ns = namespace ?? DesignDocumentNamespace.Production

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementViewIndexGetAll(
        {
          bucket_name: this._bucket.name,
          ns: designDocumentNamespaceToCpp(ns),
          timeout: timeout,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          const ddocs = []
          for (const ddoc of resp.design_documents) {
            ddocs.push(DesignDocument._fromCppData(ddoc))
          }
          wrapCallback(null, ddocs)
        }
      )
    }, callback)
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
    // deprecated path: options and maybe callback passed in
    if (typeof arguments[1] === 'object') {
      namespace = undefined
      options = arguments[1]
      callback = arguments[2]
    } else if (arguments[1] instanceof Function) {
      // deprecated path: no options, only callback passed in
      namespace = undefined
      options = undefined
      callback = arguments[1]
    } else {
      // either no other args passed in or desired path (namespace is 2nd arg)
      namespace = arguments[1]
      // still need to handle possible no options, but callback passed in
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

    const timeout = options.timeout || this._cluster.managementTimeout
    // for compatibility with older SDK versions (i.e. deprecated getDesignDocument())
    if (designDocName.startsWith('dev_')) {
      namespace = DesignDocumentNamespace.Development
      designDocName = designDocName.substring(4)
    }
    const ns = namespace ?? DesignDocumentNamespace.Production

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementViewIndexGet(
        {
          bucket_name: this._bucket.name,
          document_name: designDocName,
          ns: designDocumentNamespaceToCpp(ns),
          timeout: timeout,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          const ddoc = DesignDocument._fromCppData(resp.document)
          wrapCallback(null, ddoc)
        }
      )
    }, callback)
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
    // deprecated path: options and maybe callback passed in
    if (typeof arguments[1] === 'object') {
      namespace = undefined
      options = arguments[1]
      callback = arguments[2]
    } else if (arguments[1] instanceof Function) {
      // deprecated path: no options, only callback passed in
      namespace = undefined
      options = undefined
      callback = arguments[1]
    } else {
      // either no other args passed in or desired path (namespace is 2nd arg)
      namespace = arguments[1]
      // still need to handle possible no options, but callback passed in
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

    const timeout = options.timeout || this._cluster.managementTimeout
    // for compatibility with older SDK versions (i.e. deprecated upsertDesignDocument())
    if (designDoc.name.startsWith('dev_')) {
      namespace = DesignDocumentNamespace.Development
      designDoc.name = designDoc.name.substring(4)
    }
    const ns = namespace ?? DesignDocumentNamespace.Production

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementViewIndexUpsert(
        {
          bucket_name: this._bucket.name,
          document: DesignDocument._toCppData(designDoc, ns),
          timeout: timeout,
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
    // deprecated path: options and maybe callback passed in
    if (typeof arguments[1] === 'object') {
      namespace = undefined
      options = arguments[1]
      callback = arguments[2]
    } else if (arguments[1] instanceof Function) {
      // deprecated path: no options, only callback passed in
      namespace = undefined
      options = undefined
      callback = arguments[1]
    } else {
      // either no other args passed in or desired path (namespace is 2nd arg)
      namespace = arguments[1]
      // still need to handle possible no options, but callback passed in
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

    const timeout = options.timeout || this._cluster.managementTimeout
    // for compatibility with older SDK versions (i.e. deprecated dropDesignDocument())
    if (designDocName.startsWith('dev_')) {
      namespace = DesignDocumentNamespace.Development
      designDocName = designDocName.substring(4)
    }
    const ns = namespace ?? DesignDocumentNamespace.Production

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementViewIndexDrop(
        {
          bucket_name: this._bucket.name,
          document_name: designDocName,
          ns: designDocumentNamespaceToCpp(ns),
          timeout: timeout,
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

    const timeout = options.timeout || this._cluster.managementTimeout
    const timer = new CompoundTimeout(timeout)

    return PromiseHelper.wrapAsync(async () => {
      const designDoc = await this.getDesignDocument(
        designDocName,
        DesignDocumentNamespace.Development,
        {
          timeout: timer.left(),
        }
      )

      await this.upsertDesignDocument(
        designDoc,
        DesignDocumentNamespace.Production,
        {
          timeout: timer.left(),
        }
      )
    }, callback)
  }
}
