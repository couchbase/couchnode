import {
  CppDocumentId,
  CppGenericError,
  CppTransactions,
  CppTransaction,
  CppTransactionGetMultiReplicasFromPreferredServerGroupResult,
  CppTransactionGetMultiResult,
  CppTransactionGetResult,
  CppQueryResponse,
  CppTransactionLinks,
  CppTransactionGetMetaData,
} from './binding'
import binding from './binding'
import {
  durabilityToCpp,
  errorFromCpp,
  queryProfileToCpp,
  queryScanConsistencyToCpp,
  transactionGetMultiModeToCpp,
  transactionGetMultiReplicasFromPreferredServerGroupModeToCpp,
  transactionKeyspaceToCpp,
} from './bindingutilities'
import { Cluster } from './cluster'
import { Collection } from './collection'
import {
  DocumentNotFoundError,
  TransactionCommitAmbiguousError,
  TransactionExpiredError,
  TransactionFailedError,
  TransactionOperationFailedError,
} from './errors'
import { DurabilityLevel } from './generaltypes'
import { QueryExecutor } from './queryexecutor'
import {
  QueryMetaData,
  QueryProfileMode,
  QueryResult,
  QueryScanConsistency,
} from './querytypes'
import { Scope } from './scope'
import { DefaultTranscoder, Transcoder } from './transcoders'
import { Cas, PromiseHelper } from './utilities'

/**
 * Represents the path to a document.
 *
 * @category Transactions
 */
export class DocumentId {
  constructor() {
    this.bucket = ''
    this.scope = ''
    this.collection = ''
    this.key = ''
  }

  /**
   * The name of the bucket containing the document.
   */
  bucket: string

  /**
   * The name of the scope containing the document.
   */
  scope: string

  /**
   * The name of the collection containing the document.
   */
  collection: string

  /**
   * The key of the docuemnt.
   */
  key: string
}

/**
 * Specifies the configuration options for a Transaction Keyspace.
 *
 * @category Transactions
 */
export interface TransactionKeyspace {
  /**
   * The name of the bucket for the Keyspace.
   */
  bucket: string

  /**
   * The name of the scope for the Keyspace.
   */
  scope?: string

  /**
   * The name of the collection for the Keyspace.
   */
  collection?: string
}

/**
 * Represents the mode of the Transactional GetMulti operation.
 *
 * @category Transactions
 */
export enum TransactionGetMultiMode {
  /**
   * Indicates that the Transactional GetMulti op should prioritise latency.
   */
  PrioritiseLatency = 'prioritise_latency',
  /**
   * Indicates that the Transactional GetMulti op should disable read skew detection.
   */
  DisableReadSkewDetection = 'disable_read_skew_detection',
  /**
   * Indicates that the Transactional GetMulti op should prioritise read skew detection.
   */
  PrioritiseReadSkewDetection = 'prioritise_read_skew_detection',
}

/**
 * Represents the mode of the Transactional GetMultiReplicasFromPreferredServerGroup operation.
 *
 * @category Transactions
 */
export enum TransactionGetMultiReplicasFromPreferredServerGroupMode {
  /**
   * Indicates that the Transactional GetMultiReplicasFromPreferredServerGroup op should prioritise latency.
   */
  PrioritiseLatency = 'prioritise_latency',
  /**
   * Indicates that the Transactional GetMultiReplicasFromPreferredServerGroup op should disable read skew detection.
   */
  DisableReadSkewDetection = 'disable_read_skew_detection',
  /**
   * Indicates that the Transactional GetMultiReplicasFromPreferredServerGroup op should prioritise read skew detection.
   */
  PrioritiseReadSkewDetection = 'prioritise_read_skew_detection',
}

/**
 * Specifies the configuration options for Transactions cleanup.
 *
 * @category Transactions
 */
export interface TransactionsCleanupConfig {
  /**
   * Specifies the period of the cleanup system.
   */
  cleanupWindow?: number

  /**
   * Specifies whether or not the cleanup system should clean lost attempts.
   */
  disableLostAttemptCleanup?: boolean

  /**
   * Specifies whether or not the cleanup system should clean client attempts.
   */
  disableClientAttemptCleanup?: boolean
}

/**
 * Specifies the configuration options for Transactions queries.
 *
 * @category Transactions
 */
export interface TransactionsQueryConfig {
  /**
   * Specifies the default scan consistency level for queries.
   */
  scanConsistency?: QueryScanConsistency
}

/**
 * Specifies the configuration options for Transactions.
 *
 * @category Transactions
 */
export interface TransactionsConfig {
  /**
   * Specifies the level of synchronous durability level.
   */
  durabilityLevel?: DurabilityLevel

  /**
   * Specifies the default timeout for KV operations, specified in millseconds.
   *
   * @deprecated Currently a no-op.  CXXCBC-391: Adds support for ExtSDKIntegration which uses KV durable timeout internally.
   */
  kvTimeout?: number

  /**
   * Specifies the default timeout for transactions.
   */
  timeout?: number

  /**
   * Specifies the configuration for queries.
   */
  queryConfig?: TransactionsQueryConfig

  /**
   * Specifies the configuration for the cleanup system.
   */
  cleanupConfig?: TransactionsCleanupConfig

  /**
   * Specifies the Keyspace (bucket, scope & collection) for the transaction metadata.
   */
  metadataCollection?: TransactionKeyspace
}

/**
 * Specifies the configuration options for a Transaction.
 *
 * @category Transactions
 */
export interface TransactionOptions {
  /**
   * Specifies the level of synchronous durability level.
   */
  durabilityLevel?: DurabilityLevel

  /**
   * Specifies the timeout for the transaction.
   */
  timeout?: number
}

/**
 * Represents the path to a document.
 *
 * @category Transactions
 */
export class TransactionGetMultiSpec {
  constructor(collection: Collection, id: string, transcoder?: Transcoder) {
    this.collection = collection
    this.id = id
    this.transcoder = transcoder
  }

  /**
   * The Collection where the document belongs.
   */
  collection: Collection

  /**
   * The id (or key) of the document.
   */
  id: string

  /**
   * The Transcoder to encode/decode the document.
   */
  transcoder?: Transcoder

  /**
   * @internal
   */
  _toCppDocumentId(): CppDocumentId {
    return {
      bucket: this.collection.scope.bucket.name,
      scope: this.collection.scope.name || '_default',
      collection: this.collection.name || '_default',
      key: this.id,
    }
  }
}

/**
 * Represents the path to a document.
 *
 * @category Transactions
 */
export class TransactionGetMultiReplicasFromPreferredServerGroupSpec {
  constructor(collection: Collection, id: string, transcoder?: Transcoder) {
    this.collection = collection
    this.id = id
    this.transcoder = transcoder
  }

  /**
   * The Collection where the document belongs.
   */
  collection: Collection

  /**
   * The id (or key) of the document.
   */
  id: string

  /**
   * The Transcoder to encode/decode the document.
   */
  transcoder?: Transcoder

  /**
   * @internal
   */
  _toCppDocumentId(): CppDocumentId {
    return {
      bucket: this.collection.scope.bucket.name,
      scope: this.collection.scope.name || '_default',
      collection: this.collection.name || '_default',
      key: this.id,
    }
  }
}

/**
 * Contains the results of a Transaction.
 *
 * @category Transactions
 */
export class TransactionResult {
  /**
   * @internal
   */
  constructor(data: { transactionId: string; unstagingComplete: boolean }) {
    this.transactionId = data.transactionId
    this.unstagingComplete = data.unstagingComplete
  }

  /**
   * The ID of the completed transaction.
   */
  transactionId: string

  /**
   * Whether all documents were successfully unstaged and are now available
   * for non-transactional operations to see.
   */
  unstagingComplete: boolean
}

/**
 * Contains the results of a transactional Get operation.
 *
 * @category Transactions
 */
export class TransactionGetResult {
  /**
   * @internal
   */
  constructor(data: TransactionGetResult) {
    this.id = data.id
    this.content = data.content
    this.cas = data.cas
    this._links = data._links
    this._metadata = data._metadata
  }

  /**
   * The id of the document.
   */
  id: DocumentId

  /**
   * The content of the document.
   */
  content: any

  /**
   * The CAS of the document.
   */
  cas: Cas

  /**
   * @internal
   */
  _links: CppTransactionLinks

  /**
   * @internal
   */
  _metadata: CppTransactionGetMetaData
}

/**
 * Contains the results of a specific sub-operation within a transactional GetMulti operation.
 *
 * @category Transactions
 */
export class TransactionGetMultiResultEntry {
  /**
   * The error, if any, which occured when attempting to perform this sub-operation.
   */
  error: Error | null

  /**
   * The value returned by the sub-operation.
   */
  value?: any

  /**
   * @internal
   */
  constructor(data: { value?: any; error?: Error }) {
    this.error = data.error || null
    this.value = data.value
  }
}

/**
 * Contains the results of a transactional GetMulti operation.
 *
 * @category Transactions
 */
export class TransactionGetMultiResult {
  /**
   * @internal
   */
  constructor(data: { content: TransactionGetMultiResultEntry[] }) {
    this.content = data.content
  }

  /**
   * The content of the document.
   */
  content: TransactionGetMultiResultEntry[]

  /**
   * Indicates whether the document at the specified index exists.
   *
   * @param index The result index to check.
   */
  exists(index: number): boolean {
    if (index < 0 || index >= this.content.length) {
      throw new Error(`Index (${index}) out of bounds.`)
    }
    return (
      this.content[index].error === undefined ||
      this.content[index].error === null
    )
  }

  /**
   * Provides the content at the specified index, if it exists.
   *
   * @param index The result index to check.
   */
  contentAt(index: number): any {
    if (!this.exists(index)) {
      throw (
        this.content[index].error ||
        new DocumentNotFoundError(
          new Error(`Document does not exist at index=${index}.`)
        )
      )
    }
    return this.content[index].value
  }
}

/**
 * Contains the results of a specific sub-operation within
 * a transactional GetMultiReplicasFromPreferredServerGroup operation.
 *
 * @category Transactions
 */
export class TransactionGetMultiReplicasFromPreferredServerGroupResultEntry {
  /**
   * The error, if any, which occured when attempting to access the document.
   */
  error: Error | null

  /**
   * The value of the document.
   */
  value?: any

  /**
   * @internal
   */
  constructor(data: { value?: any; error?: Error }) {
    this.error = data.error || null
    this.value = data.value
  }
}

/**
 * Contains the results of a transactional GetMultiReplicasFromPreferredServerGroup operation.
 *
 * @category Transactions
 */
export class TransactionGetMultiReplicasFromPreferredServerGroupResult {
  /**
   * @internal
   */
  constructor(data: {
    content: TransactionGetMultiReplicasFromPreferredServerGroupResultEntry[]
  }) {
    this.content = data.content
  }

  /**
   * The content of the document.
   */
  content: TransactionGetMultiReplicasFromPreferredServerGroupResultEntry[]

  /**
   * Indicates whether the document at the specified index exists.
   *
   * @param index The result index to check.
   */
  exists(index: number): boolean {
    if (index < 0 || index >= this.content.length) {
      throw new Error(`Index (${index}) out of bounds.`)
    }
    return (
      this.content[index].error === undefined ||
      this.content[index].error === null
    )
  }

  /**
   * Provides the content at the specified index, if it exists.
   *
   * @param index The result index to check.
   */
  contentAt(index: number): any {
    if (!this.exists(index)) {
      throw (
        this.content[index].error ||
        new DocumentNotFoundError(
          new Error(`Document does not exist at index=${index}.`)
        )
      )
    }
    return this.content[index].value
  }
}

/**
 * Contains the results of a transactional Query operation.
 *
 * @category Transactions
 */
export class TransactionQueryResult<TRow = any> {
  /**
   * The rows which have been returned by the query.
   */
  rows: TRow[]

  /**
   * The meta-data which has been returned by the query.
   */
  meta: QueryMetaData

  /**
   * @internal
   */
  constructor(data: QueryResult) {
    this.rows = data.rows
    this.meta = data.meta
  }
}

/**
 * @category Transactions
 */
export interface TransactionQueryOptions {
  /**
   * Values to be used for the placeholders within the query.
   */
  parameters?: { [key: string]: any } | any[]

  /**
   * Specifies the consistency requirements when executing the query.
   *
   * @see QueryScanConsistency
   */
  scanConsistency?: QueryScanConsistency

  /**
   * Specifies whether this is an ad-hoc query, or if it should be prepared
   * for faster execution in the future.
   */
  adhoc?: boolean

  /**
   * The returned client context id for this query.
   */
  clientContextId?: string

  /**
   * This is an advanced option, see the query service reference for more
   * information on the proper use and tuning of this option.
   */
  maxParallelism?: number

  /**
   * This is an advanced option, see the query service reference for more
   * information on the proper use and tuning of this option.
   */
  pipelineBatch?: number

  /**
   * This is an advanced option, see the query service reference for more
   * information on the proper use and tuning of this option.
   */
  pipelineCap?: number

  /**
   * This is an advanced option, see the query service reference for more
   * information on the proper use and tuning of this option.  Specified
   * in milliseconds.
   */
  scanWait?: number

  /**
   * This is an advanced option, see the query service reference for more
   * information on the proper use and tuning of this option.
   */
  scanCap?: number

  /**
   * Specifies that this query should be executed in read-only mode, disabling
   * the ability for the query to make any changes to the data.
   */
  readOnly?: boolean

  /**
   * Specifies the level of profiling that should be used for the query.
   */
  profile?: QueryProfileMode

  /**
   * Specifies whether metrics should be captured as part of the execution of
   * the query.
   */
  metrics?: boolean

  /**
   * Specifies any additional parameters which should be passed to the query engine
   * when executing the query.
   */
  raw?: { [key: string]: any }

  /**
   * Specifies the scope to run this query in.
   */
  scope?: Scope
}

/**
 * @category Transactions
 */
export interface TransactionGetOptions {
  /**
   * Specifies an explicit transcoder to use for this specific operation.
   */
  transcoder?: Transcoder
}

/**
 * @category Transactions
 */
export interface TransactionGetReplicaFromPreferredServerGroupOptions {
  /**
   * Specifies an explicit transcoder to use for this specific operation.
   */
  transcoder?: Transcoder
}

/**
 * @category Transactions
 */
export interface TransactionGetMultiOptions {
  /**
   * Specifies a mode to use for this specific operation.
   */
  mode?: TransactionGetMultiMode
}

/**
 * @category Transactions
 */
export interface TransactionGetMultiReplicasFromPreferredServerGroupOptions {
  /**
   * Specifies a mode to use for this specific operation.
   */
  mode?: TransactionGetMultiReplicasFromPreferredServerGroupMode
}

/**
 * @category Transactions
 */
export interface TransactionInsertOptions {
  /**
   * Specifies an explicit transcoder to use for this specific operation.
   */
  transcoder?: Transcoder
}

/**
 * @category Transactions
 */
export interface TransactionReplaceOptions {
  /**
   * Specifies an explicit transcoder to use for this specific operation.
   */
  transcoder?: Transcoder
}

/**
 * @internal
 */
function translateGetResult(
  cppRes: CppTransactionGetResult | null,
  transcoder: Transcoder
): TransactionGetResult | null {
  if (!cppRes) {
    return null
  }

  let content
  if (cppRes.content && cppRes.content.data && cppRes.content.data.length > 0) {
    content = transcoder.decode(cppRes.content.data, cppRes.content.flags)
  }

  return new TransactionGetResult({
    id: cppRes.id,
    content: content,
    cas: cppRes.cas,
    _links: cppRes.links,
    _metadata: cppRes.metadata,
  })
}

/**
 * @internal
 */
function translateGetMultiResult(
  cppRes: CppTransactionGetMultiResult | null,
  transcoders: Transcoder[]
): TransactionGetMultiResult | null {
  if (!cppRes) {
    return null
  }
  const content: TransactionGetMultiResultEntry[] = []
  for (let i = 0; i < cppRes.content.length; ++i) {
    const cppEntry = cppRes.content[i]
    let resultEntry, resultError
    if (cppEntry && cppEntry.data && cppEntry.data.length > 0) {
      resultEntry = transcoders[i].decode(cppEntry.data, cppEntry.flags)
    } else {
      resultError = new DocumentNotFoundError(
        new Error(`Document not found at index=${i}.`)
      )
    }
    content.push(
      new TransactionGetMultiResultEntry({
        value: resultEntry,
        error: resultError,
      })
    )
  }
  return new TransactionGetMultiResult({
    content,
  })
}

/**
 * @internal
 */
function translateGetMultiReplicasFromPreferredServerGroupResult(
  cppRes: CppTransactionGetMultiReplicasFromPreferredServerGroupResult | null,
  transcoders: Transcoder[]
): TransactionGetMultiReplicasFromPreferredServerGroupResult | null {
  if (!cppRes) {
    return null
  }
  const content: TransactionGetMultiReplicasFromPreferredServerGroupResultEntry[] =
    []
  for (let i = 0; i < cppRes.content.length; ++i) {
    const cppEntry = cppRes.content[i]
    let resultEntry, resultError
    if (cppEntry && cppEntry.data && cppEntry.data.length > 0) {
      resultEntry = transcoders[i].decode(cppEntry.data, cppEntry.flags)
    } else {
      resultError = new DocumentNotFoundError(
        new Error(`Document not found at index=${i}.`)
      )
    }
    content.push(
      new TransactionGetMultiReplicasFromPreferredServerGroupResultEntry({
        value: resultEntry,
        error: resultError,
      })
    )
  }
  return new TransactionGetMultiReplicasFromPreferredServerGroupResult({
    content,
  })
}

/**
 * Provides an interface to preform transactional operations in a transaction.
 *
 * @category Transactions
 */
export class TransactionAttemptContext {
  private _impl: CppTransaction
  private _transcoder: DefaultTranscoder

  /**
   * @internal
   */
  constructor(txns: Transactions, config?: TransactionOptions) {
    if (!config) {
      config = {}
    }
    this._impl = new binding.Transaction(txns.impl, {
      durability_level: durabilityToCpp(config.durabilityLevel),
      timeout: config.timeout,
      query_scan_consistency: queryScanConsistencyToCpp(undefined),
    })
    this._transcoder = new DefaultTranscoder()
  }

  /**
  @internal
  */
  get impl(): CppTransaction {
    return this._impl
  }

  /**
   * @internal
   */
  _newAttempt(): Promise<void> {
    return PromiseHelper.wrap((wrapCallback) => {
      this._impl.newAttempt((cppErr) => {
        const err = errorFromCpp(cppErr)
        wrapCallback(err)
      })
    })
  }

  /**
   * Retrieves the value of a document from the collection.
   *
   * @param collection The collection the document lives in.
   * @param key The document key to retrieve.
   * @param options Optional parameters for this operation.
   */
  async get(
    collection: Collection,
    key: string,
    options?: TransactionGetOptions
  ): Promise<TransactionGetResult> {
    const transcoder = options?.transcoder || this._transcoder
    return PromiseHelper.wrap((wrapCallback) => {
      const id = collection._cppDocId(key)
      this._impl.get(
        {
          id,
        },
        (cppErr, cppRes) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(err, translateGetResult(cppRes, transcoder))
        }
      )
    })
  }

  /**
   * Retrieves the value of a document from the collection.
   *
   * @param collection The collection the document lives in.
   * @param key The document key to retrieve.
   * @param options Optional parameters for this operation.
   */
  async getReplicaFromPreferredServerGroup(
    collection: Collection,
    key: string,
    options?: TransactionGetReplicaFromPreferredServerGroupOptions
  ): Promise<TransactionGetResult> {
    const transcoder = options?.transcoder || this._transcoder
    return PromiseHelper.wrap((wrapCallback) => {
      const id = collection._cppDocId(key)
      this._impl.getReplicaFromPreferredServerGroup(
        {
          id,
        },
        (cppErr, cppRes) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(err, translateGetResult(cppRes, transcoder))
        }
      )
    })
  }

  /**
   * Retrieves the documents specified in the list of specs.
   *
   * @param specs The documents to retrieve.
   * @param options Optional parameters for this operation.
   */
  async getMultiReplicasFromPreferredServerGroup(
    specs: TransactionGetMultiReplicasFromPreferredServerGroupSpec[],
    options?: TransactionGetMultiReplicasFromPreferredServerGroupOptions
  ): Promise<TransactionGetMultiReplicasFromPreferredServerGroupResult> {
    const ids = specs.map((spec) => spec._toCppDocumentId())
    const transcoders = specs.map((spec) => spec.transcoder || this._transcoder)
    return PromiseHelper.wrap((wrapCallback) => {
      this._impl.getMultiReplicasFromPreferredServerGroup(
        {
          ids,
          mode: transactionGetMultiReplicasFromPreferredServerGroupModeToCpp(
            options?.mode
          ),
        },
        (cppErr, cppRes) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(
            err,
            translateGetMultiReplicasFromPreferredServerGroupResult(
              cppRes,
              transcoders
            )
          )
        }
      )
    })
  }

  /**
   * Retrieves the documents specified in the list of specs.
   *
   * @param specs The documents to retrieve.
   * @param options Optional parameters for this operation.
   */
  async getMulti(
    specs: TransactionGetMultiSpec[],
    options?: TransactionGetMultiOptions
  ): Promise<TransactionGetMultiResult> {
    const ids = specs.map((spec) => spec._toCppDocumentId())
    const transcoders = specs.map((spec) => spec.transcoder || this._transcoder)
    return PromiseHelper.wrap((wrapCallback) => {
      this._impl.getMulti(
        {
          ids,
          mode: transactionGetMultiModeToCpp(options?.mode),
        },
        (cppErr, cppRes) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(err, translateGetMultiResult(cppRes, transcoders))
        }
      )
    })
  }

  /**
   * Inserts a new document to the collection, failing if the document already exists.
   *
   * @param collection The collection the document lives in.
   * @param key The document key to insert.
   * @param content The document content to insert.
   * @param options Optional parameters for this operation.
   */
  async insert(
    collection: Collection,
    key: string,
    content: any,
    options?: TransactionInsertOptions
  ): Promise<TransactionGetResult> {
    return PromiseHelper.wrap((wrapCallback) => {
      const id = collection._cppDocId(key)
      const transcoder = options?.transcoder || this._transcoder
      const [data, flags] = transcoder.encode(content)
      this._impl.insert(
        {
          id,
          content: {
            data,
            flags,
          },
        },
        (cppErr, cppRes) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(err, translateGetResult(cppRes, transcoder))
        }
      )
    })
  }

  /**
   * Replaces a document in a collection.
   *
   * @param doc The document to replace.
   * @param content The document content to insert.
   * @param options Optional parameters for this operation.
   */
  async replace(
    doc: TransactionGetResult,
    content: any,
    options?: TransactionReplaceOptions
  ): Promise<TransactionGetResult> {
    return PromiseHelper.wrap((wrapCallback) => {
      const transcoder = options?.transcoder || this._transcoder
      const [data, flags] = transcoder.encode(content)
      this._impl.replace(
        {
          doc: {
            id: doc.id,
            content: {
              data: Buffer.from(''),
              flags: 0,
            },
            cas: doc.cas,
            links: doc._links,
            metadata: doc._metadata,
          },
          content: {
            data,
            flags,
          },
        },
        (cppErr, cppRes) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }

          wrapCallback(err, translateGetResult(cppRes, transcoder))
        }
      )
    })
  }

  /**
   * Removes a document from a collection.
   *
   * @param doc The document to remove.
   */
  async remove(doc: TransactionGetResult): Promise<void> {
    return PromiseHelper.wrap((wrapCallback) => {
      this._impl.remove(
        {
          doc: {
            id: doc.id,
            content: {
              data: Buffer.from(''),
              flags: 0,
            },
            cas: doc.cas,
            links: doc._links,
            metadata: doc._metadata,
          },
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          wrapCallback(err, null)
        }
      )
    })
  }

  /**
   * Executes a query in the context of this transaction.
   *
   * @param statement The statement to execute.
   * @param options Optional parameters for this operation.
   */
  async query<TRow = any>(
    statement: string,
    options?: TransactionQueryOptions
  ): Promise<TransactionQueryResult<TRow>> {
    // This await statement is explicit here to ensure our query is completely
    // processed before returning the result to the user (no row streaming).
    const syncQueryRes = await QueryExecutor.execute((callback) => {
      if (!options) {
        options = {}
      }

      this._impl.query(
        statement,
        {
          scan_consistency: queryScanConsistencyToCpp(options.scanConsistency),
          ad_hoc: options.adhoc === false ? false : true,
          client_context_id: options.clientContextId,
          pipeline_batch: options.pipelineBatch,
          pipeline_cap: options.pipelineCap,
          max_parallelism: options.maxParallelism,
          scan_wait: options.scanWait,
          scan_cap: options.scanCap,
          readonly: options.readOnly || false,
          profile: queryProfileToCpp(options.profile),
          metrics: options.metrics || false,
          raw: options.raw
            ? Object.fromEntries(
                Object.entries(options.raw)
                  .filter(([, v]) => v !== undefined)
                  .map(([k, v]) => [k, Buffer.from(JSON.stringify(v))])
              )
            : {},
          positional_parameters:
            options.parameters && Array.isArray(options.parameters)
              ? options.parameters.map((v) =>
                  Buffer.from(JSON.stringify(v ?? null))
                )
              : [],
          named_parameters:
            options.parameters && !Array.isArray(options.parameters)
              ? Object.fromEntries(
                  Object.entries(options.parameters as { [key: string]: any })
                    .filter(([, v]) => v !== undefined)
                    .map(([k, v]) => [k, Buffer.from(JSON.stringify(v))])
                )
              : {},
        },
        (cppErr, resp) => {
          callback(cppErr, resp as CppQueryResponse)
        }
      )
    })
    return new TransactionQueryResult({
      rows: syncQueryRes.rows,
      meta: syncQueryRes.meta,
    })
  }

  /**
   * @internal
   */
  async _commit(): Promise<TransactionResult> {
    return PromiseHelper.wrap((wrapCallback) => {
      this._impl.commit((cppErr, cppRes) => {
        const err = errorFromCpp(cppErr)
        let res: TransactionResult | null = null
        if (cppRes) {
          res = new TransactionResult({
            transactionId: cppRes.transaction_id,
            unstagingComplete: cppRes.unstaging_complete,
          })
        }
        wrapCallback(err, res)
      })
    })
  }

  /**
   * @internal
   */
  async _rollback(): Promise<void> {
    return PromiseHelper.wrap((wrapCallback) => {
      this._impl.rollback((cppErr) => {
        const err = errorFromCpp(cppErr)
        wrapCallback(err)
      })
    })
  }
}

/**
 * Provides an interface to access transactions.
 *
 * @category Transactions
 */
export class Transactions {
  private _cluster: Cluster
  private _impl: CppTransactions

  /**
  @internal
  */
  constructor(cluster: Cluster, config?: TransactionsConfig) {
    if (!config) {
      config = {}
    }
    if (!config.cleanupConfig) {
      config.cleanupConfig = {}
    }
    if (!config.queryConfig) {
      config.queryConfig = {}
    }

    const connImpl = cluster.conn
    try {
      const txnsImpl = new binding.Transactions(connImpl, {
        durability_level: durabilityToCpp(config.durabilityLevel),
        timeout: config.timeout,
        query_scan_consistency: queryScanConsistencyToCpp(
          config.queryConfig.scanConsistency
        ),
        cleanup_window: config.cleanupConfig.cleanupWindow,
        cleanup_lost_attempts: !config.cleanupConfig.disableLostAttemptCleanup,
        cleanup_client_attempts:
          !config.cleanupConfig.disableClientAttemptCleanup,
        metadata_collection: transactionKeyspaceToCpp(
          config.metadataCollection
        ),
      })

      this._cluster = cluster
      this._impl = txnsImpl
    } catch (err) {
      throw errorFromCpp(err as CppGenericError)
    }
  }

  /**
  @internal
  */
  get impl(): CppTransactions {
    return this._impl
  }

  /**
  @internal
  */
  _close(): Promise<void> {
    return PromiseHelper.wrap((wrapCallback) => {
      this._impl.close((cppErr) => {
        const err = errorFromCpp(cppErr)
        wrapCallback(err, null)
      })
    })
  }

  /**
   * Executes a transaction.
   *
   * @param logicFn The transaction lambda to execute.
   * @param config Configuration operations for the transaction.
   */
  async run(
    logicFn: (attempt: TransactionAttemptContext) => Promise<void>,
    config?: TransactionOptions
  ): Promise<TransactionResult> {
    const txn = new TransactionAttemptContext(this, config)

    for (;;) {
      await txn._newAttempt()

      try {
        await logicFn(txn)
      } catch (e) {
        await txn._rollback()
        if (e instanceof TransactionOperationFailedError) {
          throw new TransactionFailedError(e.cause, e.context)
        } else if (
          e instanceof TransactionExpiredError ||
          e instanceof TransactionCommitAmbiguousError
        ) {
          throw e
        }
        throw new TransactionFailedError(e as Error)
      }

      try {
        const txnResult = await txn._commit() // this is actually finalize internally
        if (!txnResult) {
          // no result and no error, try again
          continue
        }

        return txnResult
      } catch (e) {
        // commit failed, retry...
      }
    }
  }
}
