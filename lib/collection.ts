import {
  IncrementOptions,
  DecrementOptions,
  AppendOptions,
  PrependOptions,
  BinaryCollection,
} from './binarycollection'
import binding, {
  CppDocumentId,
  CppConnection,
  zeroCas,
  CppImplSubdocCommand,
  CppScanIterator,
  CppRangeScanOrchestratorOptions,
} from './binding'
import {
  durabilityToCpp,
  errorFromCpp,
  mutationStateToCpp,
  persistToToCpp,
  readPreferenceToCpp,
  replicateToToCpp,
  scanTypeToCpp,
  storeSemanticToCpp,
} from './bindingutilities'
import { Cluster } from './cluster'
import {
  CounterResult,
  ExistsResult,
  GetReplicaResult,
  GetResult,
  LookupInResult,
  LookupInResultEntry,
  LookupInReplicaResult,
  MutateInResult,
  MutateInResultEntry,
  MutationResult,
  ScanResult,
} from './crudoptypes'
import {
  CouchbaseList,
  CouchbaseMap,
  CouchbaseQueue,
  CouchbaseSet,
} from './datastructures'
import { InvalidArgumentError } from './errors'
import { DurabilityLevel, ReadPreference, StoreSemantics } from './generaltypes'
import { MutationState } from './mutationstate'
import { wrapObservableBindingCall } from './observability'
import { ObservableRequestHandler } from './observabilityhandler'
import { KeyValueOp, ObservabilityInstruments } from './observabilitytypes'
import { CollectionQueryIndexManager } from './queryindexmanager'
import { RangeScan, SamplingScan, PrefixScan } from './rangeScan'
import { Scope } from './scope'
import { LookupInMacro, LookupInSpec, MutateInSpec } from './sdspecs'
import { SdUtils } from './sdutils'
import {
  StreamableReplicasPromise,
  StreamableScanPromise,
} from './streamablepromises'
import { RequestSpan } from './tracing'
import { Transcoder } from './transcoders'
import { parseExpiry, NodeCallback, PromiseHelper, CasInput } from './utilities'

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

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 * @category Key-Value
 */
export interface ExistsOptions {
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
 * @category Key-Value
 */
export interface InsertOptions {
  /**
   * Specifies the expiry time for the document.
   *
   * The expiry can be provided as:
   * - A `number` of seconds relative to the current time.
   * - A `Date` object for an absolute expiry time.
   *
   * **IMPORTANT:** To use a Unix timestamp for expiry, construct a Date from it ( new Date(UNIX_TIMESTAMP * 1000) ).
   */
  expiry?: number | Date

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

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 * @category Key-Value
 */
export interface UpsertOptions {
  /**
   * Specifies the expiry time for the document.
   *
   * The expiry can be provided as:
   * - A `number` of seconds relative to the current time.
   * - A `Date` object for an absolute expiry time.
   *
   * **IMPORTANT:** To use a Unix timestamp for expiry, construct a Date from it ( new Date(UNIX_TIMESTAMP * 1000) ).
   */
  expiry?: number | Date

  /**
   * Specifies that any existing expiry on the document should be preserved.
   */
  preserveExpiry?: boolean

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

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 * @category Key-Value
 */
export interface ReplaceOptions {
  /**
   * Specifies the expiry time for the document.
   *
   * The expiry can be provided as:
   * - A `number` of seconds relative to the current time (recommended).
   * - A `Date` object for an absolute expiry time.
   *
   * **IMPORTANT:** To use a Unix timestamp for expiry, construct a Date from it ( new Date(UNIX_TIMESTAMP * 1000) ).
   */
  expiry?: number | Date

  /**
   * Specifies that any existing expiry on the document should be preserved.
   */
  preserveExpiry?: boolean

  /**
   * If specified, indicates that operation should be failed if the CAS
   * has changed from this value, indicating that the document has changed.
   */
  cas?: CasInput

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

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 * @category Key-Value
 */
export interface RemoveOptions {
  /**
   * If specified, indicates that operation should be failed if the CAS
   * has changed from this value, indicating that the document has changed.
   */
  cas?: CasInput

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

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
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

  /**
   * Specifies how replica nodes will be filtered.
   */
  readPreference?: ReadPreference

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
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

  /**
   * Specifies how replica nodes will be filtered.
   */
  readPreference?: ReadPreference

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
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
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
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

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
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

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 * @category Key-Value
 */
export interface UnlockOptions {
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
 * @category Key-Value
 */
export interface LookupInOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number

  /**
   * For internal use only - allows access to deleted documents that are in 'tombstone' form
   *
   * @internal
   */
  accessDeleted?: boolean

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 * @category Key-Value
 */
export interface LookupInAnyReplicaOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number

  /**
   * Specifies how replica nodes will be filtered.
   */
  readPreference?: ReadPreference

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 * @category Key-Value
 */
export interface LookupInAllReplicasOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number

  /**
   * Specifies how replica nodes will be filtered.
   */
  readPreference?: ReadPreference

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 * @category Key-Value
 */
export interface MutateInOptions {
  /**
   * Specifies the expiry time for the document.
   *
   * The expiry can be provided as:
   * - A `number` of seconds relative to the current time (recommended).
   * - A `Date` object for an absolute expiry time.
   *
   * **IMPORTANT:** To use a Unix timestamp for expiry, construct a Date from it ( new Date(UNIX_TIMESTAMP * 1000) ).
   */
  expiry?: number | Date

  /**
   * Specifies that any existing expiry on the document should be preserved.
   */
  preserveExpiry?: boolean

  /**
   * If specified, indicates that operation should be failed if the CAS
   * has changed from this value, indicating that the document has changed.
   */
  cas?: CasInput

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
   * Specifies the store semantics to use for this operation.
   */
  storeSemantics?: StoreSemantics

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number

  /**
   * Specifies whether the operation should be performed with upsert semantics,
   * creating the document if it does not already exist.
   *
   * @deprecated Use {@link MutateInOptions.storeSemantics} instead.
   */
  upsertDocument?: boolean

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 * @category Key-Value
 */
export interface ScanOptions {
  /**
   * Specifies an explicit transcoder to use for this specific operation.
   */
  transcoder?: Transcoder

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number

  /**
   * If the scan should only return document ids.
   */
  idsOnly?: boolean

  /**
   * The limit applied to the number of bytes returned from the server
   * for each partition batch.
   */
  batchByteLimit?: number

  /**
   * The limit applied to the number of items returned from the server
   * for each partition batch.
   */
  batchItemLimit?: number

  /**
   * Specifies a MutationState which the scan should be consistent with.
   *
   * @see {@link MutationState}
   */
  consistentWith?: MutationState

  /**
   * Specifies the number of vBuckets which the client should scan in parallel.
   */
  concurrency?: number
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
  private _conn: CppConnection
  private _kvScanTimeout: number
  private _scanBatchItemLimit: number
  private _scanBatchByteLimit: number

  /**
  @internal
  */
  constructor(scope: Scope, collectionName: string) {
    this._scope = scope
    this._name = collectionName
    this._conn = scope.conn
    this._kvScanTimeout = 75000
    this._scanBatchByteLimit = 15000
    this._scanBatchItemLimit = 50
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
    return this._scope.bucket.cluster
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
   * @internal
   */
  get observabilityInstruments(): ObservabilityInstruments {
    return this._scope.bucket.cluster.observabilityInstruments
  }

  /**
  @internal
  */
  _mutationTimeout(durabilityLevel?: DurabilityLevel): number {
    if (
      durabilityLevel !== undefined &&
      durabilityLevel !== null &&
      durabilityLevel !== DurabilityLevel.None
    ) {
      return this.cluster.kvDurableTimeout
    }
    return this.cluster.kvTimeout
  }

  /**
   * @internal
   */
  _cppDocId(key: string): CppDocumentId {
    return {
      bucket: this.scope.bucket.name,
      scope: this.scope.name || '_default',
      collection: this.name || '_default',
      key: key,
    }
  }

  /**
   * @internal
   */
  _encodeDoc(
    transcoder: Transcoder,
    value: any,
    callback: (err: Error | null, bytes: Buffer, flags: number) => void
  ): void {
    try {
      const [bytesBuf, flagsOut] = transcoder.encode(value)
      callback(null, bytesBuf, flagsOut)
    } catch (e) {
      return callback(e as Error, Buffer.alloc(0), 0)
    }
  }

  /**
   * @internal
   */
  _decodeDoc(
    transcoder: Transcoder,
    bytes: Buffer,
    flags: number,
    callback: (err: Error | null, content: any) => void
  ): void {
    try {
      const content = transcoder.decode(bytes, flags)
      callback(null, content)
    } catch (e) {
      return callback(e as Error, null)
    }
  }

  /**
   * @internal
   */
  _subdocEncode(value: any): any {
    return Buffer.from(value)
  }

  /**
   * @internal
   */
  _subdocDecode(bytes: Buffer): any {
    try {
      return JSON.parse(bytes.toString('utf8'))
    } catch (_e) {
      // If we encounter a parse error, assume that we need
      // to return bytes instead of an object.
      return bytes
    }
  }

  /**
   * The name of the collection this Collection object references.
   */
  get name(): string {
    return this._name
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

    const obsReqHandler = new ObservableRequestHandler(
      KeyValueOp.Get,
      this.observabilityInstruments,
      options?.parentSpan
    )

    try {
      const cppDocId = this._cppDocId(key)
      obsReqHandler.setRequestKeyValueAttributes(cppDocId)
      if (options.project || options.withExpiry) {
        options.parentSpan = obsReqHandler.wrappedSpan
        return this._projectedGet(key, options, obsReqHandler, callback)
      }

      const transcoder = options.transcoder || this.transcoder
      const timeout = options.timeout || this.cluster.kvTimeout

      return PromiseHelper.wrapAsync(async () => {
        const [err, resp] = await wrapObservableBindingCall(
          this._conn.get.bind(this._conn),
          {
            id: cppDocId,
            timeout,
            partition: 0,
            opaque: 0,
          },
          obsReqHandler
        )

        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }

        const content = transcoder.decode(resp.value, resp.flags)
        obsReqHandler.end()
        return new GetResult({
          content: content,
          cas: resp.cas,
        })
      }, callback)
    } catch (e) {
      obsReqHandler.endWithError(e)
      throw e
    }
  }

  private _projectedGet(
    key: string,
    options: GetOptions,
    obsReqHandler: ObservableRequestHandler,
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
      let res
      try {
        res = await this.lookupIn(key, spec, {
          ...options,
        })
      } catch (e) {
        obsReqHandler.endWithError(e)
        throw e
      }

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

      // The parent span is created w/in the get() operation
      obsReqHandler.end()
      return new GetResult({
        content: content,
        cas: res.cas,
        expiryTime: expiry,
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

    const obsReqHandler = new ObservableRequestHandler(
      KeyValueOp.Exists,
      this.observabilityInstruments,
      options?.parentSpan
    )
    try {
      const cppDocId = this._cppDocId(key)
      const timeout = options.timeout || this.cluster.kvTimeout
      obsReqHandler.setRequestKeyValueAttributes(cppDocId)

      return PromiseHelper.wrapAsync(async () => {
        const [err, resp] = await wrapObservableBindingCall(
          this._conn.exists.bind(this._conn),
          {
            id: cppDocId,
            partition: 0,
            opaque: 0,
            timeout,
          },
          obsReqHandler
        )
        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }

        obsReqHandler.end()
        if (resp.deleted) {
          return new ExistsResult({
            cas: undefined,
            exists: false,
          })
        }

        return new ExistsResult({
          cas: resp.cas,
          exists: resp.document_exists,
        })
      }, callback)
    } catch (e) {
      obsReqHandler.endWithError(e)
      throw e
    }
  }

  /**
   * @internal
   */
  _getReplica(
    key: string,
    obsReqHandler: ObservableRequestHandler,
    options: {
      transcoder?: Transcoder
      timeout?: number
      readPreference?: ReadPreference
      parentSpan?: RequestSpan
    },
    callback?: NodeCallback<GetReplicaResult[]>
  ): StreamableReplicasPromise<GetReplicaResult[], GetReplicaResult> {
    const cppDocId = this._cppDocId(key)
    obsReqHandler.setRequestKeyValueAttributes(cppDocId)

    const emitter = new StreamableReplicasPromise<
      GetReplicaResult[],
      GetReplicaResult
    >((replicas: GetReplicaResult[]) => replicas)

    const transcoder = options.transcoder || this.transcoder
    const timeout = options.timeout || this.cluster.kvTimeout

    if (obsReqHandler.opType == KeyValueOp.GetAllReplicas) {
      PromiseHelper.wrapAsync(async () => {
        const [err, resp] = await wrapObservableBindingCall(
          this._conn.getAllReplicas.bind(this._conn),
          {
            id: cppDocId,
            timeout: timeout,
            read_preference: readPreferenceToCpp(options.readPreference),
          },
          obsReqHandler
        )

        if (err) {
          obsReqHandler.endWithError(err)
          emitter.emit('error', err)
          emitter.emit('end')
          return
        }

        resp.entries.forEach((replica) => {
          try {
            const content = transcoder.decode(replica.value, replica.flags)
            emitter.emit(
              'replica',
              new GetReplicaResult({
                content: content,
                cas: replica.cas,
                isReplica: replica.replica,
              })
            )
          } catch (err) {
            obsReqHandler.endWithError(err)
            emitter.emit('error', err)
            emitter.emit('end')
            return
          }
        })
        obsReqHandler.end()
        emitter.emit('end')
      })
    } else {
      PromiseHelper.wrapAsync(async () => {
        const [err, resp] = await wrapObservableBindingCall(
          this._conn.getAnyReplica.bind(this._conn),
          {
            id: cppDocId,
            timeout: timeout,
            read_preference: readPreferenceToCpp(options.readPreference),
          },
          obsReqHandler
        )

        if (err) {
          obsReqHandler.endWithError(err)
          emitter.emit('error', err)
          emitter.emit('end')
          return
        }

        try {
          const content = transcoder.decode(resp.value, resp.flags)
          emitter.emit(
            'replica',
            new GetReplicaResult({
              content: content,
              cas: resp.cas,
              isReplica: resp.replica,
            })
          )
        } catch (err) {
          obsReqHandler.endWithError(err)
          emitter.emit('error', err)
        }
        obsReqHandler.end()
        emitter.emit('end')
      })
    }
    return PromiseHelper.wrapAsync(() => emitter, callback)
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
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }
    const obsReqHandler = new ObservableRequestHandler(
      KeyValueOp.GetAnyReplica,
      this.observabilityInstruments,
      options?.parentSpan
    )
    try {
      return PromiseHelper.wrapAsync(async () => {
        const replicas = await this._getReplica(key, obsReqHandler, options)
        return replicas[0]
      }, callback)
    } catch (e) {
      obsReqHandler.endWithError(e)
      throw e
    }
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
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }
    const obsReqHandler = new ObservableRequestHandler(
      KeyValueOp.GetAllReplicas,
      this.observabilityInstruments,
      options?.parentSpan
    )
    try {
      return this._getReplica(key, obsReqHandler, options, callback)
    } catch (e) {
      obsReqHandler.endWithError(e)
      throw e
    }
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
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const obsReqHandler = new ObservableRequestHandler(
      KeyValueOp.Insert,
      this.observabilityInstruments,
      options?.parentSpan
    )

    try {
      const cppDocId = this._cppDocId(key)
      const cppDurability = durabilityToCpp(options.durabilityLevel)
      const expiry = parseExpiry(options.expiry)
      const transcoder = options.transcoder || this.transcoder
      const persistTo = options.durabilityPersistTo
      const replicateTo = options.durabilityReplicateTo
      const timeout =
        options.timeout || this._mutationTimeout(options.durabilityLevel)

      obsReqHandler.setRequestKeyValueAttributes(cppDocId, cppDurability)
      const [bytesBuf, flags] = obsReqHandler.maybeCreateEncodingSpan(() => {
        return transcoder.encode(value)
      })

      const insertReq = {
        id: cppDocId,
        value: bytesBuf,
        flags: flags,
        expiry: expiry,
        timeout,
        partition: 0,
        opaque: 0,
      }

      return PromiseHelper.wrapAsync(async () => {
        let err = null
        let resp = null
        if (persistTo || replicateTo) {
          ;[err, resp] = await wrapObservableBindingCall(
            this._conn.insertWithLegacyDurability.bind(this._conn),
            {
              ...insertReq,
              persist_to: persistToToCpp(persistTo),
              replicate_to: replicateToToCpp(replicateTo),
            },
            obsReqHandler
          )
        } else {
          ;[err, resp] = await wrapObservableBindingCall(
            this._conn.insert.bind(this._conn),
            {
              ...insertReq,
              durability_level: cppDurability,
            },
            obsReqHandler
          )
        }

        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }
        obsReqHandler.end()
        return new MutationResult({
          cas: resp.cas,
          token: resp.token,
        })
      }, callback)
    } catch (e) {
      obsReqHandler.endWithError(e)
      throw e
    }
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
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const obsReqHandler = new ObservableRequestHandler(
      KeyValueOp.Upsert,
      this.observabilityInstruments,
      options?.parentSpan
    )

    try {
      const cppDocId = this._cppDocId(key)
      const cppDurability = durabilityToCpp(options.durabilityLevel)
      const expiry = parseExpiry(options.expiry)
      const preserve_expiry = options.preserveExpiry
      const transcoder = options.transcoder || this.transcoder
      const persistTo = options.durabilityPersistTo
      const replicateTo = options.durabilityReplicateTo
      const timeout =
        options.timeout || this._mutationTimeout(options.durabilityLevel)

      obsReqHandler.setRequestKeyValueAttributes(cppDocId, cppDurability)
      const [bytesBuf, flags] = obsReqHandler.maybeCreateEncodingSpan(() => {
        return transcoder.encode(value)
      })

      const upsertReq = {
        id: cppDocId,
        value: bytesBuf,
        flags: flags,
        expiry: expiry,
        preserve_expiry: preserve_expiry || false,
        timeout,
        partition: 0,
        opaque: 0,
      }

      return PromiseHelper.wrapAsync(async () => {
        let err = null
        let resp = null
        if (persistTo || replicateTo) {
          ;[err, resp] = await wrapObservableBindingCall(
            this._conn.upsertWithLegacyDurability.bind(this._conn),
            {
              ...upsertReq,
              persist_to: persistToToCpp(persistTo),
              replicate_to: replicateToToCpp(replicateTo),
            },
            obsReqHandler
          )
        } else {
          ;[err, resp] = await wrapObservableBindingCall(
            this._conn.upsert.bind(this._conn),
            {
              ...upsertReq,
              durability_level: cppDurability,
            },
            obsReqHandler
          )
        }

        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }
        obsReqHandler.end()
        return new MutationResult({
          cas: resp.cas,
          token: resp.token,
        })
      }, callback)
    } catch (e) {
      obsReqHandler.endWithError(e)
      throw e
    }
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
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const obsReqHandler = new ObservableRequestHandler(
      KeyValueOp.Replace,
      this.observabilityInstruments,
      options?.parentSpan
    )

    try {
      const cppDocId = this._cppDocId(key)
      const cppDurability = durabilityToCpp(options.durabilityLevel)
      const expiry = parseExpiry(options.expiry)
      const cas = options.cas
      const preserve_expiry = options.preserveExpiry
      const transcoder = options.transcoder || this.transcoder
      const persistTo = options.durabilityPersistTo
      const replicateTo = options.durabilityReplicateTo
      const timeout =
        options.timeout || this._mutationTimeout(options.durabilityLevel)

      obsReqHandler.setRequestKeyValueAttributes(cppDocId, cppDurability)
      const [bytesBuf, flags] = obsReqHandler.maybeCreateEncodingSpan(() => {
        return transcoder.encode(value)
      })

      const replaceReq = {
        id: cppDocId,
        value: bytesBuf,
        flags: flags,
        expiry,
        cas: cas || zeroCas,
        preserve_expiry: preserve_expiry || false,
        timeout,
        partition: 0,
        opaque: 0,
      }

      return PromiseHelper.wrapAsync(async () => {
        let err = null
        let resp = null
        if (persistTo || replicateTo) {
          ;[err, resp] = await wrapObservableBindingCall(
            this._conn.replaceWithLegacyDurability.bind(this._conn),
            {
              ...replaceReq,
              persist_to: persistToToCpp(persistTo),
              replicate_to: replicateToToCpp(replicateTo),
            },
            obsReqHandler
          )
        } else {
          ;[err, resp] = await wrapObservableBindingCall(
            this._conn.replace.bind(this._conn),
            {
              ...replaceReq,
              durability_level: cppDurability,
            },
            obsReqHandler
          )
        }
        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }
        obsReqHandler.end()
        return new MutationResult({
          cas: resp.cas,
          token: resp.token,
        })
      }, callback)
    } catch (e) {
      obsReqHandler.endWithError(e)
      throw e
    }
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

    const obsReqHandler = new ObservableRequestHandler(
      KeyValueOp.Remove,
      this.observabilityInstruments,
      options?.parentSpan
    )

    try {
      const cppDocId = this._cppDocId(key)
      const cppDurability = durabilityToCpp(options.durabilityLevel)
      const cas = options.cas
      const persistTo = options.durabilityPersistTo
      const replicateTo = options.durabilityReplicateTo
      const timeout =
        options.timeout || this._mutationTimeout(options.durabilityLevel)

      obsReqHandler.setRequestKeyValueAttributes(cppDocId, cppDurability)

      const removeReq = {
        id: cppDocId,
        cas: cas || zeroCas,
        timeout,
        partition: 0,
        opaque: 0,
      }

      return PromiseHelper.wrapAsync(async () => {
        let err = null
        let resp = null
        if (persistTo || replicateTo) {
          ;[err, resp] = await wrapObservableBindingCall(
            this._conn.removeWithLegacyDurability.bind(this._conn),
            {
              ...removeReq,
              persist_to: persistToToCpp(persistTo),
              replicate_to: replicateToToCpp(replicateTo),
            },
            obsReqHandler
          )
        } else {
          ;[err, resp] = await wrapObservableBindingCall(
            this._conn.remove.bind(this._conn),
            {
              ...removeReq,
              durability_level: cppDurability,
            },
            obsReqHandler
          )
        }
        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }
        obsReqHandler.end()
        return new MutationResult({
          cas: resp.cas,
          token: resp.token,
        })
      }, callback)
    } catch (e) {
      obsReqHandler.endWithError(e)
      throw e
    }
  }

  /**
   * Retrieves the value of the document and simultanously updates the expiry time
   * for the same document.
   *
   * @param key The document to fetch and touch.
   * @param expiry The new expiry to apply to the document.
   *   The expiry can be provided as:
   *   - A `number` of seconds relative to the current time.
   *   - A `Date` object for an absolute expiry time.
   *
   *   **IMPORTANT:** To use a Unix timestamp for expiry, construct a Date from it ( new Date(UNIX_TIMESTAMP * 1000) ).
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  getAndTouch(
    key: string,
    expiry: number | Date,
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

    const obsReqHandler = new ObservableRequestHandler(
      KeyValueOp.GetAndTouch,
      this.observabilityInstruments,
      options?.parentSpan
    )

    try {
      const cppDocId = this._cppDocId(key)
      const transcoder = options.transcoder || this.transcoder
      const timeout = options.timeout || this.cluster.kvTimeout

      obsReqHandler.setRequestKeyValueAttributes(cppDocId)
      return PromiseHelper.wrapAsync(async () => {
        const [err, resp] = await wrapObservableBindingCall(
          this._conn.getAndTouch.bind(this._conn),
          {
            id: cppDocId,
            expiry: parseExpiry(expiry),
            timeout,
            partition: 0,
            opaque: 0,
          },
          obsReqHandler
        )

        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }

        const content = transcoder.decode(resp.value, resp.flags)

        obsReqHandler.end()
        return new GetResult({
          content: content,
          cas: resp.cas,
        })
      }, callback)
    } catch (e) {
      obsReqHandler.endWithError(e)
      throw e
    }
  }

  /**
   * Updates the expiry on an existing document.
   *
   * @param key The document key to touch.
   * @param expiry The new expiry to set for the document, specified in seconds.
   *   The expiry can be provided as:
   *   - A `number` of seconds relative to the current time.
   *   - A `Date` object for an absolute expiry time.
   *
   *   **IMPORTANT:** To use a Unix timestamp for expiry, construct a Date from it ( new Date(UNIX_TIMESTAMP * 1000) ).
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  touch(
    key: string,
    expiry: number | Date,
    options?: TouchOptions,
    callback?: NodeCallback<MutationResult>
  ): Promise<MutationResult> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const obsReqHandler = new ObservableRequestHandler(
      KeyValueOp.Touch,
      this.observabilityInstruments,
      options?.parentSpan
    )

    try {
      const cppDocId = this._cppDocId(key)
      const timeout = options.timeout || this.cluster.kvTimeout

      obsReqHandler.setRequestKeyValueAttributes(cppDocId)
      return PromiseHelper.wrapAsync(async () => {
        const [err, resp] = await wrapObservableBindingCall(
          this._conn.touch.bind(this._conn),
          {
            id: cppDocId,
            expiry: parseExpiry(expiry),
            timeout,
            partition: 0,
            opaque: 0,
          },
          obsReqHandler
        )

        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }

        obsReqHandler.end()
        return new MutationResult({
          cas: resp.cas,
        })
      }, callback)
    } catch (e) {
      obsReqHandler.endWithError(e)
      throw e
    }
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

    const obsReqHandler = new ObservableRequestHandler(
      KeyValueOp.GetAndLock,
      this.observabilityInstruments,
      options?.parentSpan
    )

    try {
      const cppDocId = this._cppDocId(key)
      const transcoder = options.transcoder || this.transcoder
      const timeout = options.timeout || this.cluster.kvTimeout

      obsReqHandler.setRequestKeyValueAttributes(cppDocId)
      return PromiseHelper.wrapAsync(async () => {
        const [err, resp] = await wrapObservableBindingCall(
          this._conn.getAndLock.bind(this._conn),
          {
            id: cppDocId,
            lock_time: lockTime,
            timeout,
            partition: 0,
            opaque: 0,
          },
          obsReqHandler
        )

        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }

        const content = transcoder.decode(resp.value, resp.flags)

        obsReqHandler.end()
        return new GetResult({
          content: content,
          cas: resp.cas,
        })
      }, callback)
    } catch (e) {
      obsReqHandler.endWithError(e)
      throw e
    }
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
    cas: CasInput,
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

    const obsReqHandler = new ObservableRequestHandler(
      KeyValueOp.Unlock,
      this.observabilityInstruments,
      options?.parentSpan
    )

    try {
      const cppDocId = this._cppDocId(key)
      const timeout = options.timeout || this.cluster.kvTimeout

      obsReqHandler.setRequestKeyValueAttributes(cppDocId)
      return PromiseHelper.wrapAsync(async () => {
        const [err, _] = await wrapObservableBindingCall(
          this._conn.unlock.bind(this._conn),
          {
            id: cppDocId,
            cas,
            timeout,
            partition: 0,
            opaque: 0,
          },
          obsReqHandler
        )
        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }
        obsReqHandler.end()
      }, callback)
    } catch (e) {
      obsReqHandler.endWithError(e)
      throw e
    }
  }

  /**
   * @internal
   */
  _continueScan(
    iterator: CppScanIterator,
    transcoder: Transcoder,
    emitter: StreamableScanPromise<ScanResult[], ScanResult>
  ): void {
    iterator.next((cppErr, resp) => {
      const err = errorFromCpp(cppErr)
      if (err) {
        emitter.emit('error', err)
        emitter.emit('end')
        return
      }

      if (typeof resp === 'undefined') {
        emitter.emit('end')
        return
      }

      const key = resp.key
      if (typeof resp.body !== 'undefined') {
        const cas = resp.body.cas
        const expiry = resp.body.expiry
        this._decodeDoc(
          transcoder,
          resp.body.value,
          resp.body.flags,
          (err, content) => {
            if (err) {
              emitter.emit('error', err)
              emitter.emit('end')
              return
            }

            emitter.emit(
              'result',
              new ScanResult({
                id: key,
                content: content,
                cas: cas,
                expiryTime: expiry,
              })
            )
          }
        )
      } else {
        emitter.emit(
          'result',
          new ScanResult({
            id: key,
          })
        )
      }

      if (emitter.cancelRequested && !iterator.cancelled) {
        iterator.cancel()
      }

      this._continueScan(iterator, transcoder, emitter)
      return
    })
  }

  /**
   * @internal
   */
  _doScan(
    scanType: RangeScan | SamplingScan | PrefixScan,
    options: CppRangeScanOrchestratorOptions,
    transcoder: Transcoder,
    callback?: NodeCallback<ScanResult[]>
  ): StreamableScanPromise<ScanResult[], ScanResult> {
    const bucketName = this._scope.bucket.name
    const scopeName = this._scope.name
    const collectionName = this._name

    return PromiseHelper.wrapAsync(() => {
      const { cppErr, result } = this._conn.scan(
        bucketName,
        scopeName,
        collectionName,
        scanType.getScanType(),
        scanTypeToCpp(scanType),
        options
      )

      const err = errorFromCpp(cppErr)
      if (err) {
        throw err
      }

      const emitter = new StreamableScanPromise<ScanResult[], ScanResult>(
        (results: ScanResult[]) => results
      )

      this._continueScan(result, transcoder, emitter)

      return emitter
    }, callback)
  }
  /**
   * Performs a key-value scan operation.
   *
   * Use this API for low concurrency batch queries where latency is not a critical as the system
   * may have to scan a lot of documents to find the matching documents.
   * For low latency range queries, it is recommended that you use SQL++ with the necessary indexes.
   *
   * @param scanType The type of scan to execute.
   * @param options Optional parameters for the scan operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  scan(
    scanType: RangeScan | SamplingScan | PrefixScan,
    options?: ScanOptions,
    callback?: NodeCallback<ScanResult[]>
  ): Promise<ScanResult[]> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const transcoder = options.transcoder || this.transcoder
    const timeout = options.timeout || this._kvScanTimeout
    const idsOnly = options.idsOnly || false
    const batchByteLimit = options.batchByteLimit || this._scanBatchByteLimit
    const batchItemLimit = options.batchByteLimit || this._scanBatchItemLimit

    if (typeof options.concurrency !== 'undefined' && options.concurrency < 1) {
      throw new InvalidArgumentError(
        new Error('Concurrency option must be positive')
      )
    }
    const concurrency = options.concurrency || 1

    if (scanType instanceof SamplingScan && scanType.limit < 1) {
      throw new InvalidArgumentError(
        new Error('Sampling scan limit must be positive')
      )
    }

    const orchestratorOptions = {
      ids_only: idsOnly,
      consistent_with: mutationStateToCpp(options.consistentWith),
      batch_item_limit: batchItemLimit,
      batch_byte_limit: batchByteLimit,
      concurrency: concurrency,
      timeout: timeout,
    }

    return this._doScan(scanType, orchestratorOptions, transcoder, callback)
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

    const obsReqHandler = new ObservableRequestHandler(
      KeyValueOp.LookupIn,
      this.observabilityInstruments,
      options?.parentSpan
    )

    try {
      if (specs.length === 0) {
        throw new InvalidArgumentError(
          new Error('At least one lookup spec must be provided.')
        )
      }
      const cppDocId = this._cppDocId(key)
      const cppSpecs: CppImplSubdocCommand[] = []
      for (let i = 0; i < specs.length; ++i) {
        cppSpecs.push({
          opcode_: specs[i]._op,
          flags_: specs[i]._flags,
          path_: specs[i]._path,
          original_index_: i,
        })
      }

      const timeout = options.timeout || this.cluster.kvTimeout
      const accessDeleted = options.accessDeleted || false

      obsReqHandler.setRequestKeyValueAttributes(cppDocId)
      return PromiseHelper.wrapAsync(async () => {
        const [err, resp] = await wrapObservableBindingCall(
          this._conn.lookupIn.bind(this._conn),
          {
            id: cppDocId,
            specs: cppSpecs,
            timeout,
            partition: 0,
            opaque: 0,
            access_deleted: accessDeleted,
          },
          obsReqHandler
        )
        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }

        const content: LookupInResultEntry[] = []

        for (let i = 0; i < resp.fields.length; ++i) {
          const itemRes = resp.fields[i]

          const error = errorFromCpp(itemRes.ec)

          let value: any = undefined
          if (itemRes.value && itemRes.value.length > 0) {
            value = this._subdocDecode(itemRes.value)
          }

          if (itemRes.opcode === binding.protocol_subdoc_opcode.exists) {
            value = itemRes.exists
          }

          content.push(
            new LookupInResultEntry({
              error,
              value,
            })
          )
        }
        obsReqHandler.end()
        return new LookupInResult({
          content: content,
          cas: resp.cas,
        })
      }, callback)
    } catch (e) {
      obsReqHandler.endWithError(e)
      throw e
    }
  }

  /**
   * @internal
   */
  _lookupInReplica(
    key: string,
    obsReqHandler: ObservableRequestHandler,
    specs: LookupInSpec[],
    options: {
      timeout?: number
      readPreference?: ReadPreference
      parentSpan?: RequestSpan
    },
    callback?: NodeCallback<LookupInReplicaResult[]>
  ): StreamableReplicasPromise<LookupInReplicaResult[], LookupInReplicaResult> {
    if (specs.length === 0) {
      throw new InvalidArgumentError(
        new Error('At least one lookup spec must be provided.')
      )
    }
    const cppDocId = this._cppDocId(key)
    obsReqHandler.setRequestKeyValueAttributes(cppDocId)
    const emitter = new StreamableReplicasPromise<
      LookupInReplicaResult[],
      LookupInReplicaResult
    >((replicas: LookupInReplicaResult[]) => replicas)

    const cppSpecs: CppImplSubdocCommand[] = []
    for (let i = 0; i < specs.length; ++i) {
      cppSpecs.push({
        opcode_: specs[i]._op,
        flags_: specs[i]._flags,
        path_: specs[i]._path,
        original_index_: i,
      })
    }

    const timeout = options.timeout || this.cluster.kvTimeout

    if (obsReqHandler.opType == KeyValueOp.LookupInAllReplicas) {
      PromiseHelper.wrapAsync(async () => {
        const [err, resp] = await wrapObservableBindingCall(
          this._conn.lookupInAllReplicas.bind(this._conn),
          {
            id: cppDocId,
            specs: cppSpecs,
            timeout: timeout,
            read_preference: readPreferenceToCpp(options.readPreference),
            access_deleted: false, // only used in core transactions; false otherwise
          },
          obsReqHandler
        )

        if (err) {
          obsReqHandler.endWithError(err)
          emitter.emit('error', err)
          emitter.emit('end')
          return
        }

        resp.entries.forEach((replica) => {
          const content: LookupInResultEntry[] = []

          for (let i = 0; i < replica.fields.length; ++i) {
            const itemRes = replica.fields[i]

            const error = errorFromCpp(itemRes.ec)

            let value: any = undefined
            if (itemRes.value && itemRes.value.length > 0) {
              value = this._subdocDecode(itemRes.value)
            }

            if (itemRes.opcode === binding.protocol_subdoc_opcode.exists) {
              value = itemRes.exists
            }

            content.push(
              new LookupInResultEntry({
                error,
                value,
              })
            )
          }
          emitter.emit(
            'replica',
            new LookupInReplicaResult({
              content: content,
              cas: replica.cas,
              isReplica: replica.is_replica,
            })
          )
        })
        obsReqHandler.end()
        emitter.emit('end')
      })
    } else {
      PromiseHelper.wrapAsync(async () => {
        const [err, resp] = await wrapObservableBindingCall(
          this._conn.lookupInAnyReplica.bind(this._conn),
          {
            id: cppDocId,
            specs: cppSpecs,
            timeout: timeout,
            read_preference: readPreferenceToCpp(options.readPreference),
            access_deleted: false, // only used in core transactions; false otherwise
          },
          obsReqHandler
        )

        if (err) {
          obsReqHandler.endWithError(err)
          emitter.emit('error', err)
          emitter.emit('end')
          return
        }

        const content: LookupInResultEntry[] = []

        for (let i = 0; i < resp.fields.length; ++i) {
          const itemRes = resp.fields[i]

          const error = errorFromCpp(itemRes.ec)

          let value: any = undefined
          if (itemRes.value && itemRes.value.length > 0) {
            value = this._subdocDecode(itemRes.value)
          }

          if (itemRes.opcode === binding.protocol_subdoc_opcode.exists) {
            value = itemRes.exists
          }

          content.push(
            new LookupInResultEntry({
              error,
              value,
            })
          )
        }
        emitter.emit(
          'replica',
          new LookupInReplicaResult({
            content: content,
            cas: resp.cas,
            isReplica: resp.is_replica,
          })
        )
        obsReqHandler.end()
        emitter.emit('end')
      })
    }
    return PromiseHelper.wrapAsync(() => emitter, callback)
  }

  /**
   * Performs a lookup-in operation against a document, fetching individual fields or
   * information about specific fields inside the document value from any of the available
   * replicas in the cluster.
   *
   * @param key The document key to look in.
   * @param specs A list of specs describing the data to fetch from the document.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  lookupInAnyReplica(
    key: string,
    specs: LookupInSpec[],
    options?: LookupInAnyReplicaOptions,
    callback?: NodeCallback<LookupInReplicaResult>
  ): Promise<LookupInReplicaResult> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }
    const obsReqHandler = new ObservableRequestHandler(
      KeyValueOp.LookupInAnyReplica,
      this.observabilityInstruments,
      options?.parentSpan
    )
    try {
      return PromiseHelper.wrapAsync(async () => {
        const replicas = await this._lookupInReplica(
          key,
          obsReqHandler,
          specs,
          options
        )
        return replicas[0]
      }, callback)
    } catch (e) {
      obsReqHandler.endWithError(e)
      throw e
    }
  }

  /**
   * Performs a lookup-in operation against a document, fetching individual fields or
   * information about specific fields inside the document value from all available replicas.
   * Note that as replication is asynchronous, each node may return a different value.
   *
   * @param key The document key to look in.
   * @param specs A list of specs describing the data to fetch from the document.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  lookupInAllReplicas(
    key: string,
    specs: LookupInSpec[],
    options?: LookupInAllReplicasOptions,
    callback?: NodeCallback<LookupInReplicaResult[]>
  ): Promise<LookupInReplicaResult[]> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }
    const obsReqHandler = new ObservableRequestHandler(
      KeyValueOp.LookupInAllReplicas,
      this.observabilityInstruments,
      options?.parentSpan
    )
    try {
      return this._lookupInReplica(key, obsReqHandler, specs, options, callback)
    } catch (e) {
      obsReqHandler.endWithError(e)
      throw e
    }
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

    const obsReqHandler = new ObservableRequestHandler(
      KeyValueOp.MutateIn,
      this.observabilityInstruments,
      options?.parentSpan
    )

    try {
      if (specs.length === 0) {
        throw new InvalidArgumentError(
          new Error('At least one lookup spec must be provided.')
        )
      }

      const cppDocId = this._cppDocId(key)
      const cppDurability = durabilityToCpp(options.durabilityLevel)

      const cppSpecs: CppImplSubdocCommand[] = []
      for (let i = 0; i < specs.length; ++i) {
        let value: Buffer | undefined = undefined
        if (specs[i]._data) {
          const [bytesValue, _] = obsReqHandler.maybeAddEncodingSpan(() => {
            const encoded = this._subdocEncode(specs[i]._data)
            return [encoded, 0] // Flags are not needed for subdoc mutations
          })
          value = bytesValue
        }
        cppSpecs.push({
          opcode_: specs[i]._op,
          flags_: specs[i]._flags,
          path_: specs[i]._path,
          value_: value,
          original_index_: 0,
        })
      }

      const storeSemantics = options.upsertDocument
        ? StoreSemantics.Upsert
        : options.storeSemantics
      const expiry = parseExpiry(options.expiry)
      const preserveExpiry = options.preserveExpiry
      const cas = options.cas
      const persistTo = options.durabilityPersistTo
      const replicateTo = options.durabilityReplicateTo
      const timeout =
        options.timeout || this._mutationTimeout(options.durabilityLevel)

      obsReqHandler.setRequestKeyValueAttributes(cppDocId, cppDurability)

      const mutateInReq = {
        id: cppDocId,
        store_semantics: storeSemanticToCpp(storeSemantics),
        specs: cppSpecs,
        expiry,
        preserve_expiry: preserveExpiry || false,
        cas: cas || zeroCas,
        timeout,
        partition: 0,
        opaque: 0,
        access_deleted: false,
        create_as_deleted: false,
      }

      return PromiseHelper.wrapAsync(async () => {
        let err = null
        let resp = null
        if (persistTo || replicateTo) {
          ;[err, resp] = await wrapObservableBindingCall(
            this._conn.mutateInWithLegacyDurability.bind(this._conn),
            {
              ...mutateInReq,
              persist_to: persistToToCpp(persistTo),
              replicate_to: replicateToToCpp(replicateTo),
            },
            obsReqHandler
          )
        } else {
          ;[err, resp] = await wrapObservableBindingCall(
            this._conn.mutateIn.bind(this._conn),
            {
              ...mutateInReq,
              durability_level: cppDurability,
            },
            obsReqHandler
          )
        }
        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }
        const content: MutateInResultEntry[] = []

        for (let i = 0; i < resp.fields.length; ++i) {
          const itemRes = resp.fields[i]

          let value: any = undefined
          if (itemRes.value && itemRes.value.length > 0) {
            value = this._subdocDecode(itemRes.value)
          }

          content.push(
            new MutateInResultEntry({
              value,
            })
          )
        }
        obsReqHandler.end()
        return new MutateInResult({
          content: content,
          cas: resp.cas,
          token: resp.token,
        })
      }, callback)
    } catch (e) {
      obsReqHandler.endWithError(e)
      throw e
    }
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

  /**
   * @internal
   */
  _binaryIncrement(
    key: string,
    delta: number,
    options?: IncrementOptions,
    callback?: NodeCallback<CounterResult>
  ): Promise<CounterResult> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const obsReqHandler = new ObservableRequestHandler(
      KeyValueOp.Increment,
      this.observabilityInstruments,
      options?.parentSpan
    )

    try {
      const cppDocId = this._cppDocId(key)
      const cppDurability = durabilityToCpp(options.durabilityLevel)
      const initial_value = options.initial
      const expiry = parseExpiry(options.expiry)
      const persistTo = options.durabilityPersistTo
      const replicateTo = options.durabilityReplicateTo
      const timeout = options.timeout || this.cluster.kvTimeout
      obsReqHandler.setRequestKeyValueAttributes(cppDocId, cppDurability)

      const incrementReq = {
        id: cppDocId,
        delta,
        initial_value,
        expiry: expiry,
        timeout,
        partition: 0,
        opaque: 0,
      }

      return PromiseHelper.wrapAsync(async () => {
        let err = null
        let resp = null
        if (persistTo || replicateTo) {
          ;[err, resp] = await wrapObservableBindingCall(
            this._conn.incrementWithLegacyDurability.bind(this._conn),
            {
              ...incrementReq,
              persist_to: persistToToCpp(persistTo),
              replicate_to: replicateToToCpp(replicateTo),
            },
            obsReqHandler
          )
        } else {
          ;[err, resp] = await wrapObservableBindingCall(
            this._conn.increment.bind(this._conn),
            {
              ...incrementReq,
              durability_level: cppDurability,
            },
            obsReqHandler
          )
        }

        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }

        obsReqHandler.end()
        return new CounterResult({
          cas: resp.cas,
          token: resp.token,
          value: resp.content,
        })
      }, callback)
    } catch (e) {
      obsReqHandler.endWithError(e)
      throw e
    }
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
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const obsReqHandler = new ObservableRequestHandler(
      KeyValueOp.Decrement,
      this.observabilityInstruments,
      options?.parentSpan
    )

    try {
      const cppDocId = this._cppDocId(key)
      const cppDurability = durabilityToCpp(options.durabilityLevel)
      const initial_value = options.initial
      const expiry = parseExpiry(options.expiry)
      const persistTo = options.durabilityPersistTo
      const replicateTo = options.durabilityReplicateTo
      const timeout = options.timeout || this.cluster.kvTimeout
      obsReqHandler.setRequestKeyValueAttributes(cppDocId, cppDurability)

      const decrementReq = {
        id: cppDocId,
        delta,
        initial_value,
        expiry: expiry,
        timeout,
        partition: 0,
        opaque: 0,
      }

      return PromiseHelper.wrapAsync(async () => {
        let err = null
        let resp = null
        if (persistTo || replicateTo) {
          ;[err, resp] = await wrapObservableBindingCall(
            this._conn.decrementWithLegacyDurability.bind(this._conn),
            {
              ...decrementReq,
              persist_to: persistToToCpp(persistTo),
              replicate_to: replicateToToCpp(replicateTo),
            },
            obsReqHandler
          )
        } else {
          ;[err, resp] = await wrapObservableBindingCall(
            this._conn.decrement.bind(this._conn),
            {
              ...decrementReq,
              durability_level: cppDurability,
            },
            obsReqHandler
          )
        }

        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }

        obsReqHandler.end()
        return new CounterResult({
          cas: resp.cas,
          token: resp.token,
          value: resp.content,
        })
      }, callback)
    } catch (e) {
      obsReqHandler.endWithError(e)
      throw e
    }
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
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const obsReqHandler = new ObservableRequestHandler(
      KeyValueOp.Append,
      this.observabilityInstruments,
      options?.parentSpan
    )

    try {
      const cppDocId = this._cppDocId(key)
      const cppDurability = durabilityToCpp(options.durabilityLevel)
      const persistTo = options.durabilityPersistTo
      const replicateTo = options.durabilityReplicateTo
      const cas = options.cas
      const timeout = options.timeout || this.cluster.kvTimeout
      obsReqHandler.setRequestKeyValueAttributes(cppDocId, cppDurability)

      if (!Buffer.isBuffer(value)) {
        value = Buffer.from(value)
      }

      const appendReq = {
        id: cppDocId,
        value,
        cas: cas || zeroCas,
        timeout,
        partition: 0,
        opaque: 0,
      }

      return PromiseHelper.wrapAsync(async () => {
        let err = null
        let resp = null
        if (persistTo || replicateTo) {
          ;[err, resp] = await wrapObservableBindingCall(
            this._conn.appendWithLegacyDurability.bind(this._conn),
            {
              ...appendReq,
              persist_to: persistToToCpp(persistTo),
              replicate_to: replicateToToCpp(replicateTo),
            },
            obsReqHandler
          )
        } else {
          ;[err, resp] = await wrapObservableBindingCall(
            this._conn.append.bind(this._conn),
            {
              ...appendReq,
              durability_level: cppDurability,
            },
            obsReqHandler
          )
        }

        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }

        obsReqHandler.end()
        return new MutationResult({
          cas: resp.cas,
          token: resp.token,
        })
      }, callback)
    } catch (e) {
      obsReqHandler.endWithError(e)
      throw e
    }
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
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const obsReqHandler = new ObservableRequestHandler(
      KeyValueOp.Prepend,
      this.observabilityInstruments,
      options?.parentSpan
    )

    try {
      const cppDocId = this._cppDocId(key)
      const cppDurability = durabilityToCpp(options.durabilityLevel)
      const persistTo = options.durabilityPersistTo
      const replicateTo = options.durabilityReplicateTo
      const cas = options.cas
      const timeout = options.timeout || this.cluster.kvTimeout
      obsReqHandler.setRequestKeyValueAttributes(cppDocId, cppDurability)

      if (!Buffer.isBuffer(value)) {
        value = Buffer.from(value)
      }

      const prependReq = {
        id: cppDocId,
        value,
        cas: cas || zeroCas,
        timeout,
        partition: 0,
        opaque: 0,
      }

      return PromiseHelper.wrapAsync(async () => {
        let err = null
        let resp = null
        if (persistTo || replicateTo) {
          ;[err, resp] = await wrapObservableBindingCall(
            this._conn.prependWithLegacyDurability.bind(this._conn),
            {
              ...prependReq,
              persist_to: persistToToCpp(persistTo),
              replicate_to: replicateToToCpp(replicateTo),
            },
            obsReqHandler
          )
        } else {
          ;[err, resp] = await wrapObservableBindingCall(
            this._conn.prepend.bind(this._conn),
            {
              ...prependReq,
              durability_level: cppDurability,
            },
            obsReqHandler
          )
        }

        if (err) {
          obsReqHandler.endWithError(err)
          throw err
        }

        obsReqHandler.end()
        return new MutationResult({
          cas: resp.cas,
          token: resp.token,
        })
      }, callback)
    } catch (e) {
      obsReqHandler.endWithError(e)
      throw e
    }
  }

  /**
   * Returns a CollectionQueryIndexManager which can be used to manage the query indexes
   * of this collection.
   */
  queryIndexes(): CollectionQueryIndexManager {
    return new CollectionQueryIndexManager(this)
  }
}
