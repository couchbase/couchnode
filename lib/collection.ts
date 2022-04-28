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
  CppProtocolLookupInRequestBodyLookupInSpecsEntry,
  CppProtocolMutateInRequestBodyMutateInSpecsEntry,
} from './binding'
import {
  durabilityToCpp,
  errorFromCpp,
  storeSemanticToCpp,
} from './bindingutilities'
import { Cluster } from './cluster'
import {
  CounterResult,
  ExistsResult,
  GetResult,
  LookupInResult,
  LookupInResultEntry,
  MutateInResult,
  MutateInResultEntry,
  MutationResult,
} from './crudoptypes'
import {
  CouchbaseList,
  CouchbaseMap,
  CouchbaseQueue,
  CouchbaseSet,
} from './datastructures'
import { DocumentNotFoundError } from './errors'
import { DurabilityLevel, StoreSemantics } from './generaltypes'
import { Scope } from './scope'
import { LookupInMacro, LookupInSpec, MutateInSpec } from './sdspecs'
import { SdUtils } from './sdutils'
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
    callback: (err: Error | null, bytes: string, flags: number) => void
  ): void {
    try {
      // BUG(JSCBC-1054): We should avoid doing buffer conversion.
      const [bytesBuf, flagsOut] = transcoder.encode(value)
      const bytesStr = bytesBuf.toString('binary')
      callback(null, bytesStr, flagsOut)
    } catch (e) {
      return callback(e as Error, '', 0)
    }
  }

  /**
   * @internal
   */
  _decodeDoc(
    transcoder: Transcoder,
    bytesStr: string,
    flags: number,
    callback: (err: Error | null, content: any) => void
  ): void {
    try {
      // BUG(JSCBC-1054): We should avoid doing buffer conversion.
      const bytes = Buffer.from(bytesStr, 'binary')
      const content = transcoder.decode(bytes, flags)
      callback(null, content)
    } catch (e) {
      return callback(e as Error, null)
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

          // BUG(JSCBC-1006): Remove this workaround when the underlying bug is resolved.
          if (err instanceof DocumentNotFoundError) {
            return wrapCallback(
              null,
              new ExistsResult({
                cas: undefined,
                exists: false,
              })
            )
          }

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
              exists: true,
            })
          )
        }
      )
    }, callback)
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
      callback = arguments[3]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const expiry = options.expiry
    const transcoder = options.transcoder || this.transcoder
    const durabilityLevel = options.durabilityLevel
    const timeout = options.timeout || this._mutationTimeout(durabilityLevel)

    return PromiseHelper.wrap((wrapCallback) => {
      this._encodeDoc(transcoder, value, (err, bytes, flags) => {
        if (err) {
          return wrapCallback(err, null)
        }

        this._conn.insert(
          {
            id: this._cppDocId(key),
            value: bytes,
            flags,
            expiry: expiry || 0,
            durability_level: durabilityToCpp(durabilityLevel),
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
                token: resp.token,
              })
            )
          }
        )
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
      callback = arguments[3]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const expiry = options.expiry
    const preserve_expiry = options.preserveExpiry
    const transcoder = options.transcoder || this.transcoder
    const durabilityLevel = options.durabilityLevel
    const timeout = options.timeout || this._mutationTimeout(durabilityLevel)

    return PromiseHelper.wrap((wrapCallback) => {
      let bytes, flags
      try {
        // BUG(JSCBC-1054): We should avoid doing buffer conversion.
        const [bytesStr, flagsOut] = transcoder.encode(value)
        flags = flagsOut
        bytes = bytesStr.toString('binary')
      } catch (e) {
        return wrapCallback(e as Error, null)
      }

      this._conn.upsert(
        {
          id: this._cppDocId(key),
          value: bytes,
          flags,
          expiry: expiry || 0,
          preserve_expiry: preserve_expiry || false,
          durability_level: durabilityToCpp(durabilityLevel),
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
              token: resp.token,
            })
          )
        }
      )
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
      callback = arguments[3]
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
    const timeout = options.timeout || this._mutationTimeout(durabilityLevel)

    return PromiseHelper.wrap((wrapCallback) => {
      this._encodeDoc(transcoder, value, (err, bytes, flags) => {
        if (err) {
          return wrapCallback(err, null)
        }

        this._conn.replace(
          {
            id: this._cppDocId(key),
            value: bytes,
            flags,
            expiry,
            cas: cas || zeroCas,
            preserve_expiry: preserve_expiry || false,
            durability_level: durabilityToCpp(durabilityLevel),
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
                token: resp.token,
              })
            )
          }
        )
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
    const timeout = options.timeout || this._mutationTimeout(durabilityLevel)

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.remove(
        {
          id: this._cppDocId(key),
          cas: cas || zeroCas,
          durability_level: durabilityToCpp(durabilityLevel),
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

    const cppSpecs: CppProtocolLookupInRequestBodyLookupInSpecsEntry[] = []
    for (let i = 0; i < specs.length; ++i) {
      cppSpecs.push({
        opcode: specs[i]._op,
        flags: specs[i]._flags,
        path: specs[i]._path,
        original_index: i,
      })
    }

    const timeout = options.timeout || this.cluster.kvTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.lookupIn(
        {
          id: this._cppDocId(key),
          specs: {
            entries: cppSpecs,
          },
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
                value = JSON.parse(itemRes.value)
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

    const cppSpecs: CppProtocolMutateInRequestBodyMutateInSpecsEntry[] = []
    for (let i = 0; i < specs.length; ++i) {
      cppSpecs.push({
        opcode: specs[i]._op,
        flags: specs[i]._flags,
        path: specs[i]._path,
        param: specs[i]._data,
        original_index: 0,
      })
    }

    const storeSemantics = options.upsertDocument
      ? StoreSemantics.Upsert
      : options.storeSemantics
    const expiry = options.expiry
    const preserveExpiry = options.preserveExpiry
    const cas = options.cas
    const durabilityLevel = options.durabilityLevel
    const timeout = options.timeout || this._mutationTimeout(durabilityLevel)

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.mutateIn(
        {
          id: this._cppDocId(key),
          store_semantics: storeSemanticToCpp(storeSemantics),
          specs: {
            entries: cppSpecs,
          },
          expiry,
          preserve_expiry: preserveExpiry || false,
          cas: cas || zeroCas,
          durability_level: durabilityToCpp(durabilityLevel),
          timeout,
          partition: 0,
          opaque: 0,
          access_deleted: false,
          create_as_deleted: false,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)

          if (resp && resp.fields) {
            const content: MutateInResultEntry[] = []

            for (let i = 0; i < resp.fields.length; ++i) {
              const itemRes = resp.fields[i]

              let value: any = undefined
              if (itemRes.value && itemRes.value.length > 0) {
                value = JSON.parse(itemRes.value)
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
    const timeout = options.timeout || this.cluster.kvTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.increment(
        {
          id: this._cppDocId(key),
          delta,
          initial_value,
          expiry: expiry || 0,
          durability_level: durabilityToCpp(durabilityLevel),
          timeout,
          preserve_expiry: false,
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
            new CounterResult({
              cas: resp.cas,
              token: resp.token,
              value: resp.content,
            })
          )
        }
      )
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
    const timeout = options.timeout || this.cluster.kvTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.decrement(
        {
          id: this._cppDocId(key),
          delta,
          initial_value,
          expiry: expiry || 0,
          durability_level: durabilityToCpp(durabilityLevel),
          timeout,
          preserve_expiry: false,
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
            new CounterResult({
              cas: resp.cas,
              token: resp.token,
              value: resp.content,
            })
          )
        }
      )
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
      callback = arguments[3]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const durabilityLevel = options.durabilityLevel
    const timeout = options.timeout || this.cluster.kvTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      // BUG(JSCBC-1054): We should avoid doing buffer conversion.
      const bytesStr = value.toString('binary')

      this._conn.append(
        {
          id: this._cppDocId(key),
          value: bytesStr,
          durability_level: durabilityToCpp(durabilityLevel),
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
              token: resp.token,
            })
          )
        }
      )
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
      callback = arguments[3]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const durabilityLevel = options.durabilityLevel
    const timeout = options.timeout || this.cluster.kvTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      // BUG(JSCBC-1054): We should avoid doing buffer conversion.
      const bytesStr = value.toString('binary')

      this._conn.prepend(
        {
          id: this._cppDocId(key),
          value: bytesStr,
          durability_level: durabilityToCpp(durabilityLevel),
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
              token: resp.token,
            })
          )
        }
      )
    }, callback)
  }
}
