import { AnalyticsExecutor } from './analyticsexecutor'
import { AnalyticsIndexManager } from './analyticsindexmanager'
import {
  AnalyticsMetaData,
  AnalyticsQueryOptions,
  AnalyticsResult,
} from './analyticstypes'
import {
  Authenticator,
  PasswordAuthenticator,
  CertificateAuthenticator,
} from './authenticators'
import { Bucket } from './bucket'
import { BucketManager } from './bucketmanager'
import { Connection } from './connection'
import { ConnSpec } from './connspec'
import { DiagnoticsExecutor, PingExecutor } from './diagnosticsexecutor'
import {
  DiagnosticsOptions,
  DiagnosticsResult,
  PingOptions,
  PingResult,
} from './diagnosticstypes'
import { EventingFunctionManager } from './eventingfunctionmanager'
import { QueryExecutor } from './queryexecutor'
import { QueryIndexManager } from './queryindexmanager'
import { QueryMetaData, QueryOptions, QueryResult } from './querytypes'
import { SearchExecutor } from './searchexecutor'
import { SearchIndexManager } from './searchindexmanager'
import { SearchQuery } from './searchquery'
import {
  SearchMetaData,
  SearchQueryOptions,
  SearchResult,
  SearchRow,
} from './searchtypes'
import { StreamableRowPromise } from './streamablepromises'
import { Transactions, TransactionsConfig } from './transactions'
import { Transcoder, DefaultTranscoder } from './transcoders'
import { UserManager } from './usermanager'
import { PromiseHelper, NodeCallback } from './utilities'
import { generateClientString } from './utilities_internal'

/**
 * Specifies the timeout options for the client.
 *
 * @category Core
 */
export interface TimeoutConfig {
  /**
   * Specifies the default timeout for KV operations, specified in millseconds.
   */
  kvTimeout?: number

  /**
   * Specifies the default timeout for durable KV operations, specified in millseconds.
   */
  kvDurableTimeout?: number

  /**
   * Specifies the default timeout for views operations, specified in millseconds.
   */
  viewTimeout?: number

  /**
   * Specifies the default timeout for query operations, specified in millseconds.
   */
  queryTimeout?: number

  /**
   * Specifies the default timeout for analytics query operations, specified in millseconds.
   */
  analyticsTimeout?: number

  /**
   * Specifies the default timeout for search query operations, specified in millseconds.
   */
  searchTimeout?: number

  /**
   * Specifies the default timeout for management operations, specified in millseconds.
   */
  managementTimeout?: number
}

/**
 * Specifies security options for the client.
 *
 * @category Core
 */
export interface SecurityConfig {
  /**
   * Specifies the path to a trust store file to be used when validating the
   * authenticity of the server when connecting over SSL.
   */
  trustStorePath?: string
}

/**
 * Specifies the options which can be specified when connecting
 * to a cluster.
 *
 * @category Core
 */
export interface ConnectOptions {
  /**
   * Specifies a username to use for an implicitly created IPasswordAuthenticator
   * used for authentication with the cluster.
   */
  username?: string

  /**
   * Specifies a password to be used in concert with username for authentication.
   *
   * @see ConnectOptions.username
   */
  password?: string

  /**
   * Specifies a specific authenticator to use when connecting to the cluster.
   */
  authenticator?: Authenticator

  /**
   * Specifies the security config for connections of this cluster.
   */
  security?: SecurityConfig

  /**
   * Specifies the default timeouts for various operations performed by the SDK.
   */
  timeouts?: TimeoutConfig

  /**
   * Specifies the default transcoder to use when encoding or decoding document values.
   */
  transcoder?: Transcoder

  /**
   * Specifies the options for transactions.
   */
  transactions?: TransactionsConfig
}

/**
 * Exposes the operations which are available to be performed against a cluster.
 * Namely the ability to access to Buckets as well as performing management
 * operations against the cluster.
 *
 * @category Core
 */
export class Cluster {
  private _connStr: string
  private _trustStorePath: string
  private _kvTimeout: number
  private _kvDurableTimeout: number
  private _viewTimeout: number
  private _queryTimeout: number
  private _analyticsTimeout: number
  private _searchTimeout: number
  private _managementTimeout: number
  private _auth: Authenticator
  private _conn: Connection
  private _transcoder: Transcoder
  private _txnConfig: TransactionsConfig
  private _transactions?: Transactions
  private _openBuckets: string[]

  /**
   * @internal
   */
  get conn(): Connection {
    return this._conn
  }

  /**
  @internal
  */
  get transcoder(): Transcoder {
    return this._transcoder
  }

  /**
  @internal
  */
  get kvTimeout(): number {
    return this._kvTimeout
  }

  /**
  @internal
  */
  get kvDurableTimeout(): number {
    return this._kvDurableTimeout
  }

  /**
  @internal
  */
  get viewTimeout(): number {
    return this._viewTimeout
  }

  /**
  @internal
  */
  get queryTimeout(): number {
    return this._queryTimeout
  }

  /**
  @internal
  */
  get analyticsTimeout(): number {
    return this._analyticsTimeout
  }

  /**
  @internal
  */
  get searchTimeout(): number {
    return this._searchTimeout
  }

  /**
  @internal
  */
  get managementTimeout(): number {
    return this._managementTimeout
  }

  /**
  @internal
  @deprecated Use the static sdk-level {@link connect} method instead.
  */
  constructor(connStr: string, options?: ConnectOptions) {
    if (!options) {
      options = {}
    }

    if (!options.security) {
      options.security = {}
    }
    if (!options.timeouts) {
      options.timeouts = {}
    }

    this._connStr = connStr
    this._trustStorePath = options.security.trustStorePath || ''
    this._kvTimeout = options.timeouts.kvTimeout || 2500
    this._kvDurableTimeout = options.timeouts.kvDurableTimeout || 10000
    this._viewTimeout = options.timeouts.viewTimeout || 75000
    this._queryTimeout = options.timeouts.queryTimeout || 75000
    this._analyticsTimeout = options.timeouts.analyticsTimeout || 75000
    this._searchTimeout = options.timeouts.searchTimeout || 75000
    this._managementTimeout = options.timeouts.managementTimeout || 75000

    if (options.transcoder) {
      this._transcoder = options.transcoder
    } else {
      this._transcoder = new DefaultTranscoder()
    }

    if (options.transactions) {
      this._txnConfig = options.transactions
    } else {
      this._txnConfig = {}
    }

    if (options.username || options.password) {
      if (options.authenticator) {
        throw new Error(
          'Cannot specify authenticator along with username/password.'
        )
      }

      this._auth = {
        username: options.username || '',
        password: options.password || '',
      }
    } else if (options.authenticator) {
      this._auth = options.authenticator
    } else {
      this._auth = {
        username: '',
        password: '',
      }
    }

    this._openBuckets = []
    this._conn = new Connection()
  }

  /**
  @internal
  */
  static async connect(
    connStr: string,
    options?: ConnectOptions,
    callback?: NodeCallback<Cluster>
  ): Promise<Cluster> {
    return PromiseHelper.wrapAsync(async () => {
      const cluster = new Cluster(connStr, options)
      await cluster._connect()
      return cluster
    }, callback)
  }

  /**
   * Creates a Bucket object reference to a specific bucket.
   *
   * @param bucketName The name of the bucket to reference.
   */
  bucket(bucketName: string): Bucket {
    if (!this._openBuckets.includes(bucketName)) {
      this._conn.openBucket(bucketName, (err) => {
        if (err) {
          // BUG(JSCBC-1011): Move this to log framework once it is implemented.
          console.error('failed to open bucket: %O', err)
        }
      })
      this._openBuckets.push(bucketName)
    }

    return new Bucket(this, bucketName)
  }

  /**
   * Returns a UserManager which can be used to manage the users
   * of this cluster.
   */
  users(): UserManager {
    return new UserManager(this)
  }

  /**
   * Returns a BucketManager which can be used to manage the buckets
   * of this cluster.
   */
  buckets(): BucketManager {
    return new BucketManager(this)
  }

  /**
   * Returns a QueryIndexManager which can be used to manage the query indexes
   * of this cluster.
   */
  queryIndexes(): QueryIndexManager {
    return new QueryIndexManager(this)
  }

  /**
   * Returns a AnalyticsIndexManager which can be used to manage the analytics
   * indexes of this cluster.
   */
  analyticsIndexes(): AnalyticsIndexManager {
    return new AnalyticsIndexManager(this)
  }

  /**
   * Returns a SearchIndexManager which can be used to manage the search
   * indexes of this cluster.
   */
  searchIndexes(): SearchIndexManager {
    return new SearchIndexManager(this)
  }

  /**
   * Returns a EventingFunctionManager which can be used to manage the eventing
   * functions of this cluster.
   * Volatile: This API is subject to change at any time.
   */
  eventingFunctions(): EventingFunctionManager {
    return new EventingFunctionManager(this)
  }

  /**
   * Returns a Transactions object which can be used to perform transactions
   * on this cluster.
   */
  transactions(): Transactions {
    if (!this._transactions) {
      this._transactions = new Transactions(this, this._txnConfig)
    }
    return this._transactions
  }

  /**
   * Executes a N1QL query against the cluster.
   *
   * @param statement The N1QL statement to execute.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  query<TRow = any>(
    statement: string,
    options?: QueryOptions,
    callback?: NodeCallback<QueryResult<TRow>>
  ): StreamableRowPromise<QueryResult<TRow>, TRow, QueryMetaData> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const exec = new QueryExecutor(this)

    const options_ = options
    return PromiseHelper.wrapAsync(
      () => exec.query<TRow>(statement, options_),
      callback
    )
  }

  /**
   * Executes an analytics query against the cluster.
   *
   * @param statement The analytics statement to execute.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  analyticsQuery<TRow = any>(
    statement: string,
    options?: AnalyticsQueryOptions,
    callback?: NodeCallback<AnalyticsResult<TRow>>
  ): StreamableRowPromise<AnalyticsResult<TRow>, TRow, AnalyticsMetaData> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const exec = new AnalyticsExecutor(this)

    const options_ = options
    return PromiseHelper.wrapAsync(
      () => exec.query<TRow>(statement, options_),
      callback
    )
  }

  /**
   * Executes a search query against the cluster.
   *
   * @param indexName The name of the index to query.
   * @param query The SearchQuery describing the query to execute.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  searchQuery(
    indexName: string,
    query: SearchQuery,
    options?: SearchQueryOptions,
    callback?: NodeCallback<SearchResult>
  ): StreamableRowPromise<SearchResult, SearchRow, SearchMetaData> {
    if (options instanceof Function) {
      callback = arguments[2]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const exec = new SearchExecutor(this)

    const options_ = options
    return PromiseHelper.wrapAsync(
      () => exec.query(indexName, query, options_),
      callback
    )
  }

  /**
   * Returns a diagnostics report about the currently active connections with the
   * cluster.  Includes information about remote and local addresses, last activity,
   * and other diagnostics information.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  diagnostics(
    options?: DiagnosticsOptions,
    callback?: NodeCallback<DiagnosticsResult>
  ): Promise<DiagnosticsResult> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const exec = new DiagnoticsExecutor(this)

    const options_ = options
    return PromiseHelper.wrapAsync(() => exec.diagnostics(options_), callback)
  }

  /**
   * Performs a ping operation against the cluster.  Pinging the services which
   * are specified (or all services if none are specified).  Returns a report
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

    const exec = new PingExecutor(this)

    const options_ = options
    return PromiseHelper.wrapAsync(() => exec.ping(options_), callback)
  }

  /**
   * Shuts down this cluster object.  Cleaning up all resources associated with it.
   *
   * @param callback A node-style callback to be invoked after execution.
   */
  async close(callback?: NodeCallback<void>): Promise<void> {
    if (this._transactions) {
      await this._transactions._close()
      this._transactions = undefined
    }

    return PromiseHelper.wrap((wrapCallback) => {
      this._conn.shutdown(wrapCallback)
    }, callback)
  }

  private async _connect() {
    return new Promise((resolve, reject) => {
      const dsnObj = ConnSpec.parse(this._connStr)

      dsnObj.options.user_agent_extra = generateClientString()
      dsnObj.options.trust_certificate = this._trustStorePath

      const connStr = dsnObj.toString()

      const authOpts = {
        username: undefined as string | undefined,
        password: undefined as string | undefined,
        certificate_path: undefined as string | undefined,
        key_path: undefined as string | undefined,
        allowed_sasl_mechanisms: [
          'SCRAM-SHA512',
          'SCRAM-SHA256',
          'SCRAM-SHA1',
          'PLAIN',
        ],
      }

      if (this._auth) {
        const passAuth = this._auth as PasswordAuthenticator
        if (passAuth.username || passAuth.password) {
          authOpts.username = passAuth.username
          authOpts.password = passAuth.password
        }

        const certAuth = this._auth as CertificateAuthenticator
        if (certAuth.certificatePath || certAuth.keyPath) {
          authOpts.certificate_path = certAuth.certificatePath
          authOpts.key_path = certAuth.keyPath
        }
      }

      this._conn.connect(connStr, authOpts, (err) => {
        if (err) {
          return reject(err)
        }

        resolve(null)
      })
    })
  }
}
