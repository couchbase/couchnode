import {
  IncrementOptions,
  DecrementOptions,
  AppendOptions,
  PrependOptions,
  BinaryCollection,
} from './binarycollection'
import binding, { CppReplicaMode, CppSdOpFlag } from './binding'
import { CppStoreOpType } from './binding'
import { duraLevelToCppDuraMode, translateCppError } from './bindingutilities'
import { Connection } from './connection'
import {
  CounterResult,
  ExistsResult,
  GetReplicaResult,
  GetResult,
  LookupInResult,
  MutateInResult,
  MutationResult,
} from './crudoptypes'
import {
  CouchbaseList,
  CouchbaseMap,
  CouchbaseQueue,
  CouchbaseSet,
} from './datastructures'
import { PathNotFoundError } from './errors'
import { DurabilityLevel } from './generaltypes'
import { Scope } from './scope'
import { LookupInMacro, LookupInSpec, MutateInSpec } from './sdspecs'
import { SdUtils } from './sdutils'
import { StreamableReplicasPromise } from './streamablepromises'
import { Transcoder } from './transcoders'
import { NodeCallback, PromiseHelper, Cas } from './utilities'

/**
 * @category Key-Value
 */
export interface GetOptions {
  /**
   * Specifies a list of fields within the document which should be fetched.
   * This allows for easy retrieval of select fields without incurring the
   * overhead of fetching the whole document.
   */
  project?: string[]

  /**
   * Indicates that the expiry of the document should be fetched alongside
   * the data itself.
   */
  withExpiry?: boolean

  /**
   * Specifies an explicit transcoder to use for this specific operation.
   */
  transcoder?: Transcoder

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Key-Value
 */
export interface ExistsOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Key-Value
 */
export interface InsertOptions {
  /**
   * Specifies the expiry time for this document, specified in seconds.
   */
  expiry?: number

  /**
   * Specifies the level of synchronous durability for this operation.
   */
  durabilityLevel?: DurabilityLevel

  /**
   * Specifies the number of nodes this operation should be persisted to
   * before it is considered successful.  Note that this option is mutually
   * exclusive of {@link durabilityLevel}.
   */
  durabilityPersistTo?: number

  /**
   * Specifies the number of nodes this operation should be replicated to
   * before it is considered successful.  Note that this option is mutually
   * exclusive of {@link durabilityLevel}.
   */
  durabilityReplicateTo?: number

  /**
   * Specifies an explicit transcoder to use for this specific operation.
   */
  transcoder?: Transcoder

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Key-Value
 */
export interface UpsertOptions {
  /**
   * Specifies the expiry time for this document, specified in seconds.
   */
  expiry?: number

  /**
   * Specifies the level of synchronous durability for this operation.
   */
  durabilityLevel?: DurabilityLevel

  /**
   * Specifies the number of nodes this operation should be persisted to
   * before it is considered successful.  Note that this option is mutually
   * exclusive of {@link durabilityLevel}.
   */
  durabilityPersistTo?: number

  /**
   * Specifies the number of nodes this operation should be replicated to
   * before it is considered successful.  Note that this option is mutually
   * exclusive of {@link durabilityLevel}.
   */
  durabilityReplicateTo?: number

  /**
   * Specifies an explicit transcoder to use for this specific operation.
   */
  transcoder?: Transcoder

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Key-Value
 */
export interface ReplaceOptions {
  /**
   * Specifies the expiry time for this document, specified in seconds.
   */
  expiry?: number

  /**
   * If specified, indicates that operation should be failed if the CAS
   * has changed from this value, indicating that the document has changed.
   */
  cas?: Cas

  /**
   * Specifies the level of synchronous durability for this operation.
   */
  durabilityLevel?: DurabilityLevel

  /**
   * Specifies the number of nodes this operation should be persisted to
   * before it is considered successful.  Note that this option is mutually
   * exclusive of {@link durabilityLevel}.
   */
  durabilityPersistTo?: number

  /**
   * Specifies the number of nodes this operation should be replicated to
   * before it is considered successful.  Note that this option is mutually
   * exclusive of {@link durabilityLevel}.
   */
  durabilityReplicateTo?: number

  /**
   * Specifies an explicit transcoder to use for this specific operation.
   */
  transcoder?: Transcoder

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Key-Value
 */
export interface RemoveOptions {
  /**
   * If specified, indicates that operation should be failed if the CAS
   * has changed from this value, indicating that the document has changed.
   */
  cas?: Cas

  /**
   * Specifies the level of synchronous durability for this operation.
   */
  durabilityLevel?: DurabilityLevel

  /**
   * Specifies the number of nodes this operation should be persisted to
   * before it is considered successful.  Note that this option is mutually
   * exclusive of {@link durabilityLevel}.
   */
  durabilityPersistTo?: number

  /**
   * Specifies the number of nodes this operation should be replicated to
   * before it is considered successful.  Note that this option is mutually
   * exclusive of {@link durabilityLevel}.
   */
  durabilityReplicateTo?: number

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Key-Value
 */
export interface GetAnyReplicaOptions {
  /**
   * Specifies an explicit transcoder to use for this specific operation.
   */
  transcoder?: Transcoder

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Key-Value
 */
export interface GetAllReplicasOptions {
  /**
   * Specifies an explicit transcoder to use for this specific operation.
   */
  transcoder?: Transcoder

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Key-Value
 */
export interface TouchOptions {
  /**
   * Specifies the level of synchronous durability for this operation.
   */
  durabilityLevel?: DurabilityLevel

  /**
   * Specifies the number of nodes this operation should be persisted to
   * before it is considered successful.  Note that this option is mutually
   * exclusive of {@link durabilityLevel}.
   */
  durabilityPersistTo?: number

  /**
   * Specifies the number of nodes this operation should be replicated to
   * before it is considered successful.  Note that this option is mutually
   * exclusive of {@link durabilityLevel}.
   */
  durabilityReplicateTo?: number

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Key-Value
 */
export interface GetAndTouchOptions {
  /**
   * Specifies an explicit transcoder to use for this specific operation.
   */
  transcoder?: Transcoder

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Key-Value
 */
export interface GetAndLockOptions {
  /**
   * Specifies an explicit transcoder to use for this specific operation.
   */
  transcoder?: Transcoder

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Key-Value
 */
export interface UnlockOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Key-Value
 */
export interface LookupInOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Key-Value
 */
export interface MutateInOptions {
  /**
   * Specifies the expiry time for this document, specified in seconds.
   */
  expiry?: number

  /**
   * If specified, indicates that operation should be failed if the CAS
   * has changed from this value, indicating that the document has changed.
   */
  cas?: Cas

  /**
   * Specifies the level of synchronous durability for this operation.
   */
  durabilityLevel?: DurabilityLevel

  /**
   * Specifies the number of nodes this operation should be persisted to
   * before it is considered successful.  Note that this option is mutually
   * exclusive of {@link durabilityLevel}.
   */
  durabilityPersistTo?: number

  /**
   * Specifies the number of nodes this operation should be replicated to
   * before it is considered successful.  Note that this option is mutually
   * exclusive of {@link durabilityLevel}.
   */
  durabilityReplicateTo?: number

  /**
   * Specifies whether the operation should be performed with upsert semantics,
   * creating the document if it does not already exist.
   */
  upsertDocument?: boolean

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * Exposes the operations which are available to be performed against a collection.
 * Namely the ability to perform KV operations.
 *
 * @category Core
 */
export class Collection {
  /**
   * @internal
   */
  static get DEFAULT_NAME(): string {
    return '_default'
  }

  private _scope: Scope
  private _name: string
  private _conn: Connection

  /**
  @internal
  */
  constructor(scope: Scope, collectionName: string) {
    this._scope = scope
    this._name = collectionName
    this._conn = scope.conn
  }

  /**
  @internal
  */
  get conn(): Connection {
    return this._conn
  }

  /**
  @internal
  */
  get scope(): Scope {
    return this._scope
  }

  /**
  @internal
  */
  get transcoder(): Transcoder {
    return this._scope.transcoder
  }

  /**
   * The name of the collection this Collection object references.
   */
  get name(): string {
    return this._name
  }

  private get _lcbScopeColl(): [string, string] {
    // BUG(JSCBC-853): There is a bug in libcouchbase which causes non-blank scope
    // and collection names to fail the collections feature-check when they should not.
    const scopeName = this.scope.name || '_default'
    const collectionName = this.name || '_default'
    if (scopeName === '_default' && collectionName === '_default') {
      return ['', '']
    }
    return [scopeName, collectionName]
  }

  /**
   * Retrieves the value of a document from the collection.
   *
   * @param key The document key to retrieve.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  get(
    key: string,
    options?: GetOptions,
    callback?: NodeCallback<GetResult>
  ): Promise<GetResult> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    if (options.project || options.withExpiry) {
      return this._projectedGet(key, options, callback)
    }

    const transcoder = options.transcoder || this.transcoder
    const lcbTimeout = options.timeout ? options.timeout * 1000 : undefined

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.get(
        ...this._lcbScopeColl,
        key,
        transcoder,
        undefined,
        undefined,
        lcbTimeout,
        (err, cas, value) => {
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(
            null,
            new GetResult({
              content: value,
              cas: cas,
            })
          )
        }
      )
    }, callback)
  }

  private _projectedGet(
    key: string,
    options: GetOptions,
    callback?: NodeCallback<GetResult>
  ): Promise<GetResult> {
    let expiryStart = -1
    let projStart = -1
    let paths: string[] = []
    let spec: LookupInSpec[] = []
    let needReproject = false

    if (options.withExpiry) {
      expiryStart = spec.length
      spec.push(LookupInSpec.get(LookupInMacro.Expiry))
    }

    projStart = spec.length
    if (!options.project) {
      paths = ['']
      spec.push(LookupInSpec.get(''))
    } else {
      let projects = options.project
      if (!Array.isArray(projects)) {
        projects = [projects]
      }

      for (let i = 0; i < projects.length; ++i) {
        paths.push(projects[i])
        spec.push(LookupInSpec.get(projects[i]))
      }
    }

    // The following code relies on the projections being
    // the last segment of the specs array, this way we handle
    // an overburdened operation in a single area.
    if (spec.length > 16) {
      spec = spec.splice(0, projStart)
      spec.push(LookupInSpec.get(''))
      needReproject = true
    }

    return PromiseHelper.wrapAsync(async () => {
      const res = await this.lookupIn(key, spec, options)

      let content: any = null
      let expiry: number | undefined = undefined

      if (expiryStart >= 0) {
        const expiryRes = res.content[expiryStart]
        expiry = expiryRes.value
      }

      if (projStart >= 0) {
        if (!needReproject) {
          for (let i = 0; i < paths.length; ++i) {
            const projPath = paths[i]
            const projRes = res.content[projStart + i]
            if (!projRes.error) {
              content = SdUtils.insertByPath(content, projPath, projRes.value)
            }
          }
        } else {
          content = {}

          const reprojRes = res.content[projStart]
          for (let j = 0; j < paths.length; ++j) {
            const reprojPath = paths[j]
            const value = SdUtils.getByPath(reprojRes.value, reprojPath)
            content = SdUtils.insertByPath(content, reprojPath, value)
          }
        }
      }

      return new GetResult({
        content: content,
        cas: res.cas,
        expiry: expiry,
      })
    }, callback)
  }

  /**
   * Checks whether a specific document exists or not.
   *
   * @param key The document key to check for existence.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  exists(
    key: string,
    options?: ExistsOptions,
    callback?: NodeCallback<ExistsResult>
  ): Promise<ExistsResult> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const lcbTimeout = options.timeout ? options.timeout * 1000 : undefined

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.exists(
        ...this._lcbScopeColl,
        key,
        lcbTimeout,
        (err, cas, exists) => {
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(
            null,
            new ExistsResult({
              cas,
              exists,
            })
          )
        }
      )
    }, callback)
  }

  /**
   * Retrieves the value of the document from any of the available replicas.  This
   * will return as soon as the first response is received from any replica node.
   *
   * @param key The document key to retrieve.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  getAnyReplica(
    key: string,
    options?: GetAnyReplicaOptions,
    callback?: NodeCallback<GetReplicaResult>
  ): Promise<GetReplicaResult> {
    return PromiseHelper.wrapAsync(async () => {
      const replicas = await this._getReplica(
        binding.LCB_REPLICA_MODE_ANY,
        key,
        options
      )
      return replicas[0]
    }, callback)
  }

  /**
   * Retrieves the value of the document from all available replicas.  Note that
   * as replication is asynchronous, each node may return a different value.
   *
   * @param key The document key to retrieve.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  getAllReplicas(
    key: string,
    options?: GetAllReplicasOptions,
    callback?: NodeCallback<GetReplicaResult[]>
  ): Promise<GetReplicaResult[]> {
    return this._getReplica(
      binding.LCB_REPLICA_MODE_ALL,
      key,
      options,
      callback
    )
  }

  /**
   * Inserts a new document to the collection, failing if the document already exists.
   *
   * @param key The document key to insert.
   * @param value The value of the document to insert.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  insert(
    key: string,
    value: any,
    options?: InsertOptions,
    callback?: NodeCallback<MutationResult>
  ): Promise<MutationResult> {
    return this._store(binding.LCB_STORE_INSERT, key, value, options, callback)
  }

  /**
   * Upserts a document to the collection.  This operation succeeds whether or not the
   * document already exists.
   *
   * @param key The document key to upsert.
   * @param value The new value for the document.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  upsert(
    key: string,
    value: any,
    options?: UpsertOptions,
    callback?: NodeCallback<MutationResult>
  ): Promise<MutationResult> {
    return this._store(binding.LCB_STORE_UPSERT, key, value, options, callback)
  }

  /**
   * Replaces the value of an existing document.  Failing if the document does not exist.
   *
   * @param key The document key to replace.
   * @param value The new value for the document.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  replace(
    key: string,
    value: any,
    options?: ReplaceOptions,
    callback?: NodeCallback<MutationResult>
  ): Promise<MutationResult> {
    return this._store(binding.LCB_STORE_REPLACE, key, value, options, callback)
  }

  /**
   * Remove an existing document from the collection.
   *
   * @param key The document key to remove.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  remove(
    key: string,
    options?: RemoveOptions,
    callback?: NodeCallback<MutationResult>
  ): Promise<MutationResult> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const cas = options.cas || null
    const cppDuraMode = duraLevelToCppDuraMode(options.durabilityLevel)
    const persistTo = options.durabilityPersistTo
    const replicateTo = options.durabilityReplicateTo
    const cppTimeout = options.timeout ? options.timeout * 1000 : undefined

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.remove(
        ...this._lcbScopeColl,
        key,
        cas,
        cppDuraMode,
        persistTo,
        replicateTo,
        cppTimeout,
        (err, cas) => {
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(
            err,
            new MutationResult({
              cas: cas,
            })
          )
        }
      )
    }, callback)
  }

  /**
   * Retrieves the value of the document and simultanously updates the expiry time
   * for the same document.
   *
   * @param key The document to fetch and touch.
   * @param expiry The new expiry to apply to the document, specified in seconds.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  getAndTouch(
    key: string,
    expiry: number,
    options?: GetAndTouchOptions,
    callback?: NodeCallback<GetResult>
  ): Promise<GetResult> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const transcoder = options.transcoder || this.transcoder
    const lcbTimeout = options.timeout ? options.timeout * 1000 : undefined

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.get(
        ...this._lcbScopeColl,
        key,
        transcoder,
        expiry,
        undefined,
        lcbTimeout,
        (err, cas, value) => {
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(
            err,
            new GetResult({
              content: value,
              cas: cas,
            })
          )
        }
      )
    }, callback)
  }

  /**
   * Updates the expiry on an existing document.
   *
   * @param key The document key to touch.
   * @param expiry The new expiry to set for the document, specified in seconds.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  touch(
    key: string,
    expiry: number,
    options?: TouchOptions,
    callback?: NodeCallback<MutationResult>
  ): Promise<MutationResult> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const cppDuraMode = duraLevelToCppDuraMode(options.durabilityLevel)
    const persistTo = options.durabilityPersistTo
    const replicateTo = options.durabilityReplicateTo
    const cppTimeout = options.timeout ? options.timeout * 1000 : undefined

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.touch(
        ...this._lcbScopeColl,
        key,
        expiry,
        cppDuraMode,
        persistTo,
        replicateTo,
        cppTimeout,
        (err, cas) => {
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(
            err,
            new MutationResult({
              cas: cas,
            })
          )
        }
      )
    }, callback)
  }

  /**
   * Locks a document and retrieves the value of that document at the time it is locked.
   *
   * @param key The document key to retrieve and lock.
   * @param lockTime The amount of time to lock the document for, specified in seconds.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  getAndLock(
    key: string,
    lockTime: number,
    options?: GetAndLockOptions,
    callback?: NodeCallback<GetResult>
  ): Promise<GetResult> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const transcoder = options.transcoder || this.transcoder
    const cppTimeout = options.timeout ? options.timeout * 1000 : undefined

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.get(
        ...this._lcbScopeColl,
        key,
        transcoder,
        undefined,
        lockTime,
        cppTimeout,
        (err, cas, value) => {
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(
            err,
            new GetResult({
              cas: cas,
              content: value,
            })
          )
        }
      )
    }, callback)
  }

  /**
   * Unlocks a previously locked document.
   *
   * @param key The document key to unlock.
   * @param cas The CAS of the document, used to validate lock ownership.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  unlock(
    key: string,
    cas: Cas,
    options?: UnlockOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const cppTimeout = options.timeout ? options.timeout * 1000 : undefined

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.unlock(...this._lcbScopeColl, key, cas, cppTimeout, (err) => {
        if (err) {
          return wrapCallback(err)
        }

        wrapCallback(null)
      })
    }, callback)
  }

  /**
   * Performs a lookup-in operation against a document, fetching individual fields or
   * information about specific fields inside the document value.
   *
   * @param key The document key to look in.
   * @param specs A list of specs describing the data to fetch from the document.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  lookupIn(
    key: string,
    specs: LookupInSpec[],
    options?: LookupInOptions,
    callback?: NodeCallback<LookupInResult>
  ): Promise<LookupInResult> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const flags: CppSdOpFlag = 0

    let cmdData: any = []
    for (let i = 0; i < specs.length; ++i) {
      cmdData = [...cmdData, specs[i]._op, specs[i]._flags, specs[i]._path]
    }

    const cppTimeout = options.timeout ? options.timeout * 1000 : undefined

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.lookupIn(
        ...this._lcbScopeColl,
        key,
        flags,
        cmdData,
        cppTimeout,
        (err, res) => {
          if (res && res.content) {
            for (let i = 0; i < res.content.length; ++i) {
              const itemRes = res.content[i]
              itemRes.error = translateCppError(itemRes.error)
              if (itemRes.value && itemRes.value.length > 0) {
                itemRes.value = JSON.parse(itemRes.value)
              } else {
                itemRes.value = null
              }

              // TODO(brett19): BUG JSCBC-632 - This conversion logic should not be required,
              // it is expected that when JSCBC-632 is fixed, this code is removed as well.
              if (specs[i]._op === binding.LCBX_SDCMD_EXISTS) {
                if (!itemRes.error) {
                  itemRes.value = true
                } else if (itemRes.error instanceof PathNotFoundError) {
                  itemRes.error = null
                  itemRes.value = false
                }
              }
            }

            wrapCallback(
              err,
              new LookupInResult({
                content: res.content,
                cas: res.cas,
              })
            )
            return
          }

          wrapCallback(err, null)
        }
      )
    }, callback)
  }

  /**
   * Performs a mutate-in operation against a document.  Allowing atomic modification of
   * specific fields within a document.  Also enables access to document extended-attributes.
   *
   * @param key The document key to mutate.
   * @param specs A list of specs describing the operations to perform on the document.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  mutateIn(
    key: string,
    specs: MutateInSpec[],
    options?: MutateInOptions,
    callback?: NodeCallback<MutateInResult>
  ): Promise<MutateInResult> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    let flags: CppSdOpFlag = 0
    if (options.upsertDocument) {
      flags |= binding.LCBX_SDFLAG_UPSERT_DOC
    }

    let cmdData: any = []
    for (let i = 0; i < specs.length; ++i) {
      cmdData = [
        ...cmdData,
        specs[i]._op,
        specs[i]._flags,
        specs[i]._path,
        specs[i]._data,
      ]
    }

    const expiry = options.expiry || 0
    const cas = options.cas
    const cppDuraMode = duraLevelToCppDuraMode(options.durabilityLevel)
    const persistTo = options.durabilityPersistTo
    const replicateTo = options.durabilityReplicateTo
    const cppTimeout = options.timeout ? options.timeout * 1000 : undefined

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.mutateIn(
        ...this._lcbScopeColl,
        key,
        expiry,
        cas,
        flags,
        cmdData,
        cppDuraMode,
        persistTo,
        replicateTo,
        cppTimeout,
        (err, res) => {
          if (res && res.content) {
            for (let i = 0; i < res.content.length; ++i) {
              const itemRes = res.content[i]
              if (itemRes.value && itemRes.value.length > 0) {
                res.content[i] = {
                  value: JSON.parse(itemRes.value),
                }
              } else {
                res.content[i] = null
              }
            }

            wrapCallback(
              err,
              new MutateInResult({
                content: res.content,
                cas: res.cas,
              })
            )
            return
          }

          wrapCallback(err, null)
        }
      )
    }, callback)
  }

  /**
   * Returns a CouchbaseList permitting simple list storage in a document.
   *
   * @param key The document key the data-structure resides in.
   */
  list(key: string): CouchbaseList {
    return new CouchbaseList(this, key)
  }

  /**
   * Returns a CouchbaseQueue permitting simple queue storage in a document.
   *
   * @param key The document key the data-structure resides in.
   */
  queue(key: string): CouchbaseQueue {
    return new CouchbaseQueue(this, key)
  }

  /**
   * Returns a CouchbaseMap permitting simple map storage in a document.
   *
   * @param key The document key the data-structure resides in.
   */
  map(key: string): CouchbaseMap {
    return new CouchbaseMap(this, key)
  }

  /**
   * Returns a CouchbaseSet permitting simple set storage in a document.
   *
   * @param key The document key the data-structure resides in.
   */
  set(key: string): CouchbaseSet {
    return new CouchbaseSet(this, key)
  }

  /**
   * Returns a BinaryCollection object reference, allowing access to various
   * binary operations possible against a collection.
   */
  binary(): BinaryCollection {
    return new BinaryCollection(this)
  }

  private _getReplica(
    mode: CppReplicaMode,
    key: string,
    options?: {
      transcoder?: Transcoder
      timeout?: number
    },
    callback?: NodeCallback<GetReplicaResult[]>
  ): StreamableReplicasPromise<GetReplicaResult[], GetReplicaResult> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const emitter = new StreamableReplicasPromise<
      GetReplicaResult[],
      GetReplicaResult
    >((replicas) => replicas)

    const transcoder = options.transcoder || this.transcoder
    const cppTimeout = options.timeout ? options.timeout * 1000 : undefined

    this._conn.getReplica(
      ...this._lcbScopeColl,
      key,
      transcoder,
      mode,
      cppTimeout,
      (err, rflags, cas, value) => {
        if (!err) {
          emitter.emit(
            'replica',
            new GetReplicaResult({
              content: value,
              cas: cas,
              isReplica: true,
            })
          )
        }

        if (!(rflags & binding.LCBX_RESP_F_NONFINAL)) {
          emitter.emit('end')
        }
      }
    )

    return PromiseHelper.wrapAsync(() => emitter, callback)
  }

  private _store(
    opType: CppStoreOpType,
    key: string,
    value: any,
    options?: {
      expiry?: number
      cas?: Cas
      durabilityLevel?: DurabilityLevel
      durabilityPersistTo?: number
      durabilityReplicateTo?: number
      transcoder?: Transcoder
      timeout?: number
    },
    callback?: NodeCallback<MutationResult>
  ): Promise<MutationResult> {
    if (options instanceof Function) {
      callback = arguments[3]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const expiry = options.expiry
    const cas = options.cas
    const cppDuraMode = duraLevelToCppDuraMode(options.durabilityLevel)
    const persistTo = options.durabilityPersistTo
    const replicateTo = options.durabilityReplicateTo
    const transcoder = options.transcoder || this.transcoder
    const cppTimeout = options.timeout ? options.timeout * 1000 : undefined

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.store(
        ...this._lcbScopeColl,
        key,
        transcoder,
        value,
        expiry,
        cas,
        cppDuraMode,
        persistTo,
        replicateTo,
        cppTimeout,
        opType,
        (err, cas, token) => {
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(
            err,
            new MutationResult({
              cas: cas,
              token: token,
            })
          )
        }
      )
    }, callback)
  }

  private _counter(
    key: string,
    delta: number,
    options?: {
      initial?: number
      expiry?: number
      durabilityLevel?: DurabilityLevel
      durabilityPersistTo?: number
      durabilityReplicateTo?: number
      timeout?: number
    },
    callback?: NodeCallback<CounterResult>
  ): Promise<CounterResult> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const initial = options.initial
    const expiry = options.expiry
    const cppDuraMode = duraLevelToCppDuraMode(options.durabilityLevel)
    const persistTo = options.durabilityPersistTo
    const replicateTo = options.durabilityReplicateTo
    const cppTimeout = options.timeout ? options.timeout * 1000 : undefined

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.counter(
        ...this._lcbScopeColl,
        key,
        delta,
        initial,
        expiry,
        cppDuraMode,
        persistTo,
        replicateTo,
        cppTimeout,
        (err, cas, token, value) => {
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(
            err,
            new CounterResult({
              cas: cas,
              token: token,
              value: value,
            })
          )
        }
      )
    }, callback)
  }

  /**
   * @internal
   */
  _binaryIncrement(
    key: string,
    delta: number,
    options?: IncrementOptions,
    callback?: NodeCallback<CounterResult>
  ): Promise<CounterResult> {
    return this._counter(key, +delta, options, callback)
  }

  /**
   * @internal
   */
  _binaryDecrement(
    key: string,
    delta: number,
    options?: DecrementOptions,
    callback?: NodeCallback<CounterResult>
  ): Promise<CounterResult> {
    return this._counter(key, -delta, options, callback)
  }

  /**
   * @internal
   */
  _binaryAppend(
    key: string,
    value: string | Buffer,
    options?: AppendOptions,
    callback?: NodeCallback<MutationResult>
  ): Promise<MutationResult> {
    return this._store(binding.LCB_STORE_APPEND, key, value, options, callback)
  }

  /**
   * @internal
   */
  _binaryPrepend(
    key: string,
    value: string | Buffer,
    options?: PrependOptions,
    callback?: NodeCallback<MutationResult>
  ): Promise<MutationResult> {
    return this._store(binding.LCB_STORE_PREPEND, key, value, options, callback)
  }
}
