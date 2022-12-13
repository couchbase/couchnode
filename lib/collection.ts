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
  CppError,
  zeroCas,
  CppImplSubdocCommand,
  CppInsertResponse,
  CppUpsertResponse,
  CppRemoveResponse,
  CppReplaceResponse,
  CppMutateInResponse,
  CppAppendResponse,
  CppPrependResponse,
  CppIncrementResponse,
  CppDecrementResponse,
  CppScanIterator,
  CppRangeScanOrchestratorOptions,
} from './binding'
import {
  durabilityToCpp,
  errorFromCpp,
  mutationStateToCpp,
  persistToToCpp,
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
import { DurabilityLevel, StoreSemantics } from './generaltypes'
import { MutationState } from './mutationstate'
import { CollectionQueryIndexManager } from './queryindexmanager'
import { RangeScan, SamplingScan, PrefixScan } from './rangeScan'
import { Scope } from './scope'
import { LookupInMacro, LookupInSpec, MutateInSpec } from './sdspecs'
import { SdUtils } from './sdutils'
import {
  StreamableReplicasPromise,
  StreamableScanPromise,
} from './streamablepromises'
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
   * Specifies that any existing expiry on the document should be preserved.
   */
  preserveExpiry?: boolean

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
   * Specifies that any existing expiry on the document should be preserved.
   */
  preserveExpiry?: boolean

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
}

/**
 * Volatile: This API is subject to change at any time.
 *
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
      // BUG(JSCBC-1054): We should avoid doing buffer conversion.
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
    } catch (e) {
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

    if (options.project || options.withExpiry) {
      return this._projectedGet(key, options, callback)
    }

    const transcoder = options.transcoder || this.transcoder
    const timeout = options.timeout || this.cluster.kvTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.get(
        {
          id: this._cppDocId(key),
          timeout,
          partition: 0,
          opaque: 0,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }

          this._decodeDoc(
            transcoder,
            resp.value,
            resp.flags,
            (err, content) => {
              if (err) {
                return wrapCallback(err, null)
              }

              wrapCallback(
                null,
                new GetResult({
                  content: content,
                  cas: resp.cas,
                })
              )
            }
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
      const res = await this.lookupIn(key, spec, {
        ...options,
      })

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

    const timeout = options.timeout || this.cluster.kvTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.exists(
        {
          id: this._cppDocId(key),
          partition: 0,
          opaque: 0,
          timeout,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)

          if (err) {
            return wrapCallback(err, null)
          }

          if (resp.deleted) {
            return wrapCallback(
              null,
              new ExistsResult({
                cas: undefined,
                exists: false,
              })
            )
          }

          wrapCallback(
            null,
            new ExistsResult({
              cas: resp.cas,
              exists: resp.document_exists,
            })
          )
        }
      )
    }, callback)
  }

  /**
   * @internal
   */
  _getReplica(
    key: string,
    getAllReplicas: boolean,
    options?: {
      transcoder?: Transcoder
      timeout?: number
    },
    callback?: NodeCallback<GetReplicaResult[]>
  ): StreamableReplicasPromise<GetReplicaResult[], GetReplicaResult> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const emitter = new StreamableReplicasPromise<
      GetReplicaResult[],
      GetReplicaResult
    >((replicas: GetReplicaResult[]) => replicas)

    const transcoder = options.transcoder || this.transcoder
    const timeout = options.timeout || this.cluster.kvTimeout

    if (getAllReplicas) {
      this._conn.getAllReplicas(
        {
          id: this._cppDocId(key),
          timeout: timeout,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            emitter.emit('error', err)
            emitter.emit('end')
            return
          }

          resp.entries.forEach((replica) => {
            this._decodeDoc(
              transcoder,
              replica.value,
              replica.flags,
              (err, content) => {
                if (err) {
                  emitter.emit('error', err)
                  emitter.emit('end')
                  return
                }

                emitter.emit(
                  'replica',
                  new GetReplicaResult({
                    content: content,
                    cas: replica.cas,
                    isReplica: replica.replica,
                  })
                )
              }
            )
          })

          emitter.emit('end')
          return
        }
      )
    } else {
      this._conn.getAnyReplica(
        {
          id: this._cppDocId(key),
          timeout: timeout,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            emitter.emit('error', err)
            emitter.emit('end')
            return
          }

          this._decodeDoc(
            transcoder,
            resp.value,
            resp.flags,
            (err, content) => {
              if (err) {
                emitter.emit('error', err)
                emitter.emit('end')
                return
              }

              emitter.emit(
                'replica',
                new GetReplicaResult({
                  content: content,
                  cas: resp.cas,
                  isReplica: resp.replica,
                })
              )
            }
          )

          emitter.emit('end')
          return
        }
      )
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
    return PromiseHelper.wrapAsync(async () => {
      const replicas = await this._getReplica(key, false, options)
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
    return this._getReplica(key, true, options, callback)
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

    const expiry = options.expiry
    const transcoder = options.transcoder || this.transcoder
    const durabilityLevel = options.durabilityLevel
    const persistTo = options.durabilityPersistTo
    const replicateTo = options.durabilityReplicateTo
    const timeout = options.timeout || this._mutationTimeout(durabilityLevel)

    return PromiseHelper.wrap((wrapCallback) => {
      this._encodeDoc(transcoder, value, (err, bytes, flags) => {
        if (err) {
          return wrapCallback(err, null)
        }

        const insertReq = {
          id: this._cppDocId(key),
          value: bytes,
          flags,
          expiry: expiry || 0,
          timeout,
          partition: 0,
          opaque: 0,
        }

        const insertCallback = (
          cppErr: CppError | null,
          resp: CppInsertResponse
        ) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(
            err,
            new MutationResult({
              cas: resp.cas,
              token: resp.token,
            })
          )
        }

        if (persistTo || replicateTo) {
          this._conn.insertWithLegacyDurability(
            {
              ...insertReq,
              persist_to: persistToToCpp(persistTo),
              replicate_to: replicateToToCpp(replicateTo),
            },
            insertCallback
          )
        } else {
          this._conn.insert(
            {
              ...insertReq,
              durability_level: durabilityToCpp(durabilityLevel),
            },
            insertCallback
          )
        }
      })
    }, callback)
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

    const expiry = options.expiry
    const preserve_expiry = options.preserveExpiry
    const transcoder = options.transcoder || this.transcoder
    const durabilityLevel = options.durabilityLevel
    const persistTo = options.durabilityPersistTo
    const replicateTo = options.durabilityReplicateTo
    const timeout = options.timeout || this._mutationTimeout(durabilityLevel)

    return PromiseHelper.wrap((wrapCallback) => {
      this._encodeDoc(transcoder, value, (err, bytes, flags) => {
        if (err) {
          return wrapCallback(err, null)
        }

        const upsertReq = {
          id: this._cppDocId(key),
          value: bytes,
          flags,
          expiry: expiry || 0,
          preserve_expiry: preserve_expiry || false,
          timeout,
          partition: 0,
          opaque: 0,
        }

        const upsertCallback = (
          cppErr: CppError | null,
          resp: CppUpsertResponse
        ) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(
            err,
            new MutationResult({
              cas: resp.cas,
              token: resp.token,
            })
          )
        }

        if (persistTo || replicateTo) {
          this._conn.upsertWithLegacyDurability(
            {
              ...upsertReq,
              persist_to: persistToToCpp(persistTo),
              replicate_to: replicateToToCpp(replicateTo),
            },
            upsertCallback
          )
        } else {
          this._conn.upsert(
            {
              ...upsertReq,
              durability_level: durabilityToCpp(durabilityLevel),
            },
            upsertCallback
          )
        }
      })
    }, callback)
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

    const expiry = options.expiry || 0
    const cas = options.cas
    const preserve_expiry = options.preserveExpiry
    const transcoder = options.transcoder || this.transcoder
    const durabilityLevel = options.durabilityLevel
    const persistTo = options.durabilityPersistTo
    const replicateTo = options.durabilityReplicateTo
    const timeout = options.timeout || this._mutationTimeout(durabilityLevel)

    return PromiseHelper.wrap((wrapCallback) => {
      this._encodeDoc(transcoder, value, (err, bytes, flags) => {
        if (err) {
          return wrapCallback(err, null)
        }

        const replaceReq = {
          id: this._cppDocId(key),
          value: bytes,
          flags,
          expiry,
          cas: cas || zeroCas,
          preserve_expiry: preserve_expiry || false,
          timeout,
          partition: 0,
          opaque: 0,
        }

        const replaceCallback = (
          cppErr: CppError | null,
          resp: CppReplaceResponse
        ) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(
            err,
            new MutationResult({
              cas: resp.cas,
              token: resp.token,
            })
          )
        }

        if (persistTo || replicateTo) {
          this._conn.replaceWithLegacyDurability(
            {
              ...replaceReq,
              persist_to: persistToToCpp(persistTo),
              replicate_to: replicateToToCpp(replicateTo),
            },
            replaceCallback
          )
        } else {
          this._conn.replace(
            {
              ...replaceReq,
              durability_level: durabilityToCpp(durabilityLevel),
            },
            replaceCallback
          )
        }
      })
    }, callback)
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

    const cas = options.cas
    const durabilityLevel = options.durabilityLevel
    const persistTo = options.durabilityPersistTo
    const replicateTo = options.durabilityReplicateTo
    const timeout = options.timeout || this._mutationTimeout(durabilityLevel)

    return PromiseHelper.wrap((wrapCallback) => {
      const removeReq = {
        id: this._cppDocId(key),
        cas: cas || zeroCas,
        timeout,
        partition: 0,
        opaque: 0,
      }

      const removeCallback = (
        cppErr: CppError | null,
        resp: CppRemoveResponse
      ) => {
        const err = errorFromCpp(cppErr)
        if (err) {
          return wrapCallback(err, null)
        }

        wrapCallback(
          err,
          new MutationResult({
            cas: resp.cas,
            token: resp.token,
          })
        )
      }

      if (persistTo || replicateTo) {
        this._conn.removeWithLegacyDurability(
          {
            ...removeReq,
            persist_to: persistToToCpp(persistTo),
            replicate_to: replicateToToCpp(replicateTo),
          },
          removeCallback
        )
      } else {
        this._conn.remove(
          {
            ...removeReq,
            durability_level: durabilityToCpp(durabilityLevel),
          },
          removeCallback
        )
      }
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
    const timeout = options.timeout || this.cluster.kvTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.getAndTouch(
        {
          id: this._cppDocId(key),
          expiry,
          timeout,
          partition: 0,
          opaque: 0,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }

          this._decodeDoc(
            transcoder,
            resp.value,
            resp.flags,
            (err, content) => {
              if (err) {
                return wrapCallback(err, null)
              }

              wrapCallback(
                err,
                new GetResult({
                  content: content,
                  cas: resp.cas,
                })
              )
            }
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
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this.cluster.kvTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.touch(
        {
          id: this._cppDocId(key),
          expiry,
          timeout,
          partition: 0,
          opaque: 0,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(
            err,
            new MutationResult({
              cas: resp.cas,
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
    const timeout = options.timeout || this.cluster.kvTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.getAndLock(
        {
          id: this._cppDocId(key),
          lock_time: lockTime,
          timeout,
          partition: 0,
          opaque: 0,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }

          this._decodeDoc(
            transcoder,
            resp.value,
            resp.flags,
            (err, content) => {
              if (err) {
                return wrapCallback(err, null)
              }

              wrapCallback(
                err,
                new GetResult({
                  cas: resp.cas,
                  content: content,
                })
              )
            }
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

    const timeout = options.timeout || this.cluster.kvTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.unlock(
        {
          id: this._cppDocId(key),
          cas,
          timeout,
          partition: 0,
          opaque: 0,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err)
          }

          wrapCallback(null)
        }
      )
    }, callback)
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
   * Volatile: This API is subject to change at any time.
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

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.lookupIn(
        {
          id: this._cppDocId(key),
          specs: cppSpecs,
          timeout,
          partition: 0,
          opaque: 0,
          access_deleted: false,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)

          if (resp && resp.fields) {
            const content: LookupInResultEntry[] = []

            for (let i = 0; i < resp.fields.length; ++i) {
              const itemRes = resp.fields[i]

              let error = errorFromCpp(itemRes.ec)

              let value: any = undefined
              if (itemRes.value && itemRes.value.length > 0) {
                value = this._subdocDecode(itemRes.value)
              }

              // BUG(JSCBC-1016): Should remove this workaround when the underlying bug is resolved.
              if (itemRes.opcode === binding.protocol_subdoc_opcode.exists) {
                error = null
                value = itemRes.exists
              }

              content.push(
                new LookupInResultEntry({
                  error,
                  value,
                })
              )
            }

            wrapCallback(
              err,
              new LookupInResult({
                content: content,
                cas: resp.cas,
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

    const cppSpecs: CppImplSubdocCommand[] = []
    for (let i = 0; i < specs.length; ++i) {
      cppSpecs.push({
        opcode_: specs[i]._op,
        flags_: specs[i]._flags,
        path_: specs[i]._path,
        value_: specs[i]._data
          ? this._subdocEncode(specs[i]._data)
          : specs[i]._data,
        original_index_: 0,
      })
    }

    const storeSemantics = options.upsertDocument
      ? StoreSemantics.Upsert
      : options.storeSemantics
    const expiry = options.expiry
    const preserveExpiry = options.preserveExpiry
    const cas = options.cas
    const durabilityLevel = options.durabilityLevel
    const persistTo = options.durabilityPersistTo
    const replicateTo = options.durabilityReplicateTo
    const timeout = options.timeout || this._mutationTimeout(durabilityLevel)

    return PromiseHelper.wrap((wrapCallback) => {
      const mutateInReq = {
        id: this._cppDocId(key),
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

      const mutateInCallback = (
        cppErr: CppError | null,
        resp: CppMutateInResponse
      ) => {
        const err = errorFromCpp(cppErr)

        if (resp && resp.fields) {
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

          wrapCallback(
            err,
            new MutateInResult({
              content: content,
              cas: resp.cas,
              token: resp.token,
            })
          )
          return
        }

        wrapCallback(err, null)
      }

      if (persistTo || replicateTo) {
        this._conn.mutateInWithLegacyDurability(
          {
            ...mutateInReq,
            persist_to: persistToToCpp(persistTo),
            replicate_to: replicateToToCpp(replicateTo),
          },
          mutateInCallback
        )
      } else {
        this._conn.mutateIn(
          {
            ...mutateInReq,
            durability_level: durabilityToCpp(durabilityLevel),
          },
          mutateInCallback
        )
      }
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

    const initial_value = options.initial
    const expiry = options.expiry
    const durabilityLevel = options.durabilityLevel
    const persistTo = options.durabilityPersistTo
    const replicateTo = options.durabilityReplicateTo
    const timeout = options.timeout || this.cluster.kvTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      const incrementReq = {
        id: this._cppDocId(key),
        delta,
        initial_value,
        expiry: expiry || 0,
        timeout,
        partition: 0,
        opaque: 0,
      }

      const incrementCallback = (
        cppErr: CppError | null,
        resp: CppIncrementResponse
      ) => {
        const err = errorFromCpp(cppErr)
        if (err) {
          return wrapCallback(err, null)
        }

        wrapCallback(
          err,
          new CounterResult({
            cas: resp.cas,
            token: resp.token,
            value: resp.content,
          })
        )
      }

      if (persistTo || replicateTo) {
        this._conn.incrementWithLegacyDurability(
          {
            ...incrementReq,
            persist_to: persistToToCpp(persistTo),
            replicate_to: replicateToToCpp(replicateTo),
          },
          incrementCallback
        )
      } else {
        this._conn.increment(
          {
            ...incrementReq,
            durability_level: durabilityToCpp(durabilityLevel),
          },
          incrementCallback
        )
      }
    }, callback)
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

    const initial_value = options.initial
    const expiry = options.expiry
    const durabilityLevel = options.durabilityLevel
    const persistTo = options.durabilityPersistTo
    const replicateTo = options.durabilityReplicateTo
    const timeout = options.timeout || this.cluster.kvTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      const decrementReq = {
        id: this._cppDocId(key),
        delta,
        initial_value,
        expiry: expiry || 0,
        timeout,
        partition: 0,
        opaque: 0,
      }

      const decrementCallback = (
        cppErr: CppError | null,
        resp: CppDecrementResponse
      ) => {
        const err = errorFromCpp(cppErr)
        if (err) {
          return wrapCallback(err, null)
        }

        wrapCallback(
          err,
          new CounterResult({
            cas: resp.cas,
            token: resp.token,
            value: resp.content,
          })
        )
      }

      if (persistTo || replicateTo) {
        this._conn.decrementWithLegacyDurability(
          {
            ...decrementReq,
            persist_to: persistToToCpp(persistTo),
            replicate_to: replicateToToCpp(replicateTo),
          },
          decrementCallback
        )
      } else {
        this._conn.decrement(
          {
            ...decrementReq,
            durability_level: durabilityToCpp(durabilityLevel),
          },
          decrementCallback
        )
      }
    }, callback)
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

    const durabilityLevel = options.durabilityLevel
    const persistTo = options.durabilityPersistTo
    const replicateTo = options.durabilityReplicateTo
    const timeout = options.timeout || this.cluster.kvTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      if (!Buffer.isBuffer(value)) {
        value = Buffer.from(value)
      }

      const appendReq = {
        id: this._cppDocId(key),
        value,
        timeout,
        partition: 0,
        opaque: 0,
      }

      const appendCallback = (
        cppErr: CppError | null,
        resp: CppAppendResponse
      ) => {
        const err = errorFromCpp(cppErr)
        if (err) {
          return wrapCallback(err, null)
        }

        wrapCallback(
          err,
          new MutationResult({
            cas: resp.cas,
            token: resp.token,
          })
        )
      }

      if (persistTo || replicateTo) {
        this._conn.appendWithLegacyDurability(
          {
            ...appendReq,
            persist_to: persistToToCpp(persistTo),
            replicate_to: replicateToToCpp(replicateTo),
          },
          appendCallback
        )
      } else {
        this._conn.append(
          {
            ...appendReq,
            durability_level: durabilityToCpp(durabilityLevel),
          },
          appendCallback
        )
      }
    }, callback)
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

    const durabilityLevel = options.durabilityLevel
    const persistTo = options.durabilityPersistTo
    const replicateTo = options.durabilityReplicateTo
    const timeout = options.timeout || this.cluster.kvTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      if (!Buffer.isBuffer(value)) {
        value = Buffer.from(value)
      }

      const prependReq = {
        id: this._cppDocId(key),
        value,
        timeout,
        partition: 0,
        opaque: 0,
      }

      const prependCallback = (
        cppErr: CppError | null,
        resp: CppPrependResponse
      ) => {
        const err = errorFromCpp(cppErr)
        if (err) {
          return wrapCallback(err, null)
        }

        wrapCallback(
          err,
          new MutationResult({
            cas: resp.cas,
            token: resp.token,
          })
        )
      }

      if (persistTo || replicateTo) {
        this._conn.prependWithLegacyDurability(
          {
            ...prependReq,
            persist_to: persistToToCpp(persistTo),
            replicate_to: replicateToToCpp(replicateTo),
          },
          prependCallback
        )
      } else {
        this._conn.prepend(
          {
            ...prependReq,
            durability_level: durabilityToCpp(durabilityLevel),
          },
          prependCallback
        )
      }
    }, callback)
  }

  /**
   * Returns a CollectionQueryIndexManager which can be used to manage the query indexes
   * of this collection.
   */
  queryIndexes(): CollectionQueryIndexManager {
    return new CollectionQueryIndexManager(this)
  }
}
