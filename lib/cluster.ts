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
import { Connection, ConnectionOptions } from './connection'
import { DiagnoticsExecutor, PingExecutor } from './diagnosticsexecutor'
import {
  DiagnosticsOptions,
  DiagnosticsResult,
  PingOptions,
  PingResult,
} from './diagnosticstypes'
import { ClusterClosedError, NeedOpenBucketError } from './errors'
import { libLogger } from './logging'
import { LogFunc, defaultLogger } from './logging'
import { LoggingMeter, Meter } from './metrics'
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
import { RequestTracer, ThresholdLoggingTracer } from './tracing'
import { Transcoder, DefaultTranscoder } from './transcoders'
import { UserManager } from './usermanager'
import { PromiseHelper, NodeCallback } from './utilities'

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
   * Specifies the path to a trust store file to be used when validating the
   * authenticity of the server when connecting over SSL.
   */
  trustStorePath?: string

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

  /**
   * Specifies the default transcoder to use when encoding or decoding document values.
   */
  transcoder?: Transcoder

  /**
   * Specifies the tracer to use for diagnostics tracing.
   */
  tracer?: RequestTracer

  /**
   * Specifies the meter to use for diagnostics metrics.
   */
  meter?: Meter

  /**
   * Specifies a logging function to use when outputting logging.
   */
  logFunc?: LogFunc
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
  private _closed: boolean
  private _clusterConn: Connection | null
  private _conns: { [key: string]: Connection }
  private _transcoder: Transcoder
  private _tracer: RequestTracer
  private _meter: Meter
  private _logFunc: LogFunc

  /**
  @internal
  */
  get transcoder(): Transcoder {
    return this._transcoder
  }

  /**
  @internal
  @deprecated Use the static sdk-level {@link connect} method instead.
  */
  constructor(connStr: string, options?: ConnectOptions) {
    if (!options) {
      options = {}
    }

    this._connStr = connStr
    this._trustStorePath = options.trustStorePath || ''
    this._kvTimeout = options.kvTimeout || 0
    this._kvDurableTimeout = options.kvDurableTimeout || 0
    this._viewTimeout = options.viewTimeout || 0
    this._queryTimeout = options.queryTimeout || 0
    this._analyticsTimeout = options.analyticsTimeout || 0
    this._searchTimeout = options.searchTimeout || 0
    this._managementTimeout = options.managementTimeout || 0

    if (options.transcoder) {
      this._transcoder = options.transcoder
    } else {
      this._transcoder = new DefaultTranscoder()
    }

    if (options.tracer) {
      this._tracer = options.tracer
    } else {
      this._tracer = new ThresholdLoggingTracer({})
    }

    if (options.meter) {
      this._meter = options.meter
    } else {
      this._meter = new LoggingMeter({})
    }

    if (options.logFunc) {
      this._logFunc = options.logFunc
    } else {
      this._logFunc = defaultLogger
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

    this._closed = false
    this._clusterConn = null
    this._conns = {}
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
      await cluster._clusterConnect()
      return cluster
    }, callback)
  }

  /**
   * Creates a Bucket object reference to a specific bucket.
   *
   * @param bucketName The name of the bucket to reference.
   */
  bucket(bucketName: string): Bucket {
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
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const conn = this._getClusterConn()
    const exec = new QueryExecutor(conn)

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
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const conn = this._getClusterConn()
    const exec = new AnalyticsExecutor(conn)

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
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const conn = this._getClusterConn()
    const exec = new SearchExecutor(conn)

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

    let conns = Object.values(this._conns)
    if (this._clusterConn) {
      conns = [...conns, this._clusterConn]
    }

    const exec = new DiagnoticsExecutor(conns)

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

    const conn = this._getClusterConn()
    const exec = new PingExecutor(conn)

    const options_ = options
    return PromiseHelper.wrapAsync(() => exec.ping(options_), callback)
  }

  /**
   * Shuts down this cluster object.  Cleaning up all resources associated with it.
   *
   * @param callback A node-style callback to be invoked after execution.
   */
  close(callback?: NodeCallback<void>): Promise<void> {
    return PromiseHelper.wrapAsync(async () => {
      const closeOneConn = async (conn: Connection) => {
        return PromiseHelper.wrap<void>((wrapCallback) => {
          conn.close(wrapCallback)
        })
      }

      let allConns = Object.values(this._conns)
      this._conns = {}

      if (this._clusterConn) {
        allConns = [...allConns, this._clusterConn]
        this._clusterConn = null
      }

      this._closed = true

      await Promise.all(allConns.map((conn) => closeOneConn(conn)))
    }, callback)
  }

  private _buildConnOpts(
    extraOpts: Partial<ConnectionOptions>
  ): ConnectionOptions {
    const connOpts = {
      connStr: this._connStr,
      trustStorePath: this._trustStorePath,
      tracer: this._tracer,
      meter: this._meter,
      logFunc: this._logFunc,
      kvTimeout: this._kvTimeout,
      kvDurableTimeout: this._kvDurableTimeout,
      viewTimeout: this._viewTimeout,
      queryTimeout: this._queryTimeout,
      analyticsTimeout: this._analyticsTimeout,
      searchTimeout: this._searchTimeout,
      managementTimeout: this._managementTimeout,
      ...extraOpts,
    }

    if (this._auth) {
      const passAuth = this._auth as PasswordAuthenticator
      if (passAuth.username || passAuth.password) {
        connOpts.username = passAuth.username
        connOpts.password = passAuth.password
      }

      const certAuth = this._auth as CertificateAuthenticator
      if (certAuth.certificatePath || certAuth.keyPath) {
        connOpts.certificatePath = certAuth.certificatePath
        connOpts.keyPath = certAuth.keyPath
      }
    }

    return connOpts
  }

  private async _clusterConnect() {
    return new Promise((resolve, reject) => {
      const connOpts = this._buildConnOpts({})
      const conn = new Connection(connOpts)

      conn.connect((err) => {
        if (err) {
          return reject(err)
        }

        this._clusterConn = conn
        resolve(null)
      })
    })
  }

  /**
  @internal
  */
  _getClusterConn(): Connection {
    if (this._closed) {
      throw new ClusterClosedError()
    }

    if (this._clusterConn) {
      return this._clusterConn
    }

    const conns = Object.values(this._conns)
    if (conns.length === 0) {
      throw new NeedOpenBucketError()
    }

    return conns[0]
  }

  /**
   * @internal
   */
  _getConn(options: { bucketName: string }): Connection {
    if (this._closed) {
      throw new ClusterClosedError()
    }

    // Hijack the cluster-level connection if it is available
    if (this._clusterConn) {
      this._clusterConn.close(() => {
        // TODO(brett19): Handle the close error here...
      })
      this._clusterConn = null
      /*
      let conn = this._clusterConn;
      this._clusterConn = null;

      conn.selectBucket(opts.bucketName);

      this._conns[bucketName] = conn;
      return conn;
      */
    }

    // Build a new connection for this, since there is no
    // cluster-level connection available.
    const connOpts = this._buildConnOpts({
      bucketName: options.bucketName,
    })

    let conn = this._conns[options.bucketName]

    if (!conn) {
      conn = new Connection(connOpts)

      conn.connect((err: Error | null) => {
        if (err) {
          libLogger('failed to connect to bucket: %O', err)
          conn.close(() => undefined)
        }
      })

      this._conns[options.bucketName] = conn
    }

    return conn
  }
}
