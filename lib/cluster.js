'use strict';

const debug = require('debug')('couchnode');
const AnalyticsExecutor = require('./analyticsexecutor');
const Bucket = require('./bucket');
const BucketManager = require('./bucketmanager');
const Connection = require('./connection');
const QueryExecutor = require('./queryexecutor');
const PromiseHelper = require('./promisehelper');
const SearchExecutor = require('./searchexecutor');
const QueryIndexManager = require('./queryindexmanager');
const AnalyticsIndexManager = require('./analyticsindexmanager');
const PingExecutor = require('./pingexecutor');
const SearchIndexManager = require('./searchindexmanager');
const UserManager = require('./usermanager');
const DefaultTranscoder = require('./defaulttranscoder');

/**
 * Cluster represents an entire Couchbase Server cluster.
 */
class Cluster {
  /**
   * @hideconstructor
   */
  constructor(connStr, options) {
    if (!options) {
      options = {};
    }

    this._connStr = connStr;
    this._trustStorePath = options.trustStorePath;
    this._kvTimeout = options.kvTimeout;
    this._kvDurableTimeout = options.kvDurableTimeout;
    this._viewTimeout = options.viewTimeout;
    this._queryTimeout = options.queryTimeout;
    this._analyticsTimeout = options.analyticsTimeout;
    this._searchTimeout = options.searchTimeout;
    this._managementTimeout = options.managementTimeout;

    this._auth = options.authenticator;
    if (options.username || options.password) {
      if (this._auth) {
        throw new Error(
          'Cannot specify authenticator along with username/password.'
        );
      }

      this._auth = {
        username: options.username,
        password: options.password,
      };
    }

    this._closed = false;
    this._clusterConn = null;
    this._conns = {};

    var transcoder = options.transcoder;
    if (!transcoder) {
      transcoder = new DefaultTranscoder();
    }
    this._transcoder = transcoder;

    this._logFunc = options.logFunc;
  }

  _buildConnOpts(extraOpts) {
    var connOpts = {
      connStr: this._connStr,
      trustStorePath: this._trustStorePath,
      logFunc: this._logFunc,
      kvTimeout: this._kvTimeout,
      kvDurableTimeout: this._kvDurableTimeout,
      viewTimeout: this._viewTimeout,
      queryTimeout: this._queryTimeout,
      analyticsTimeout: this._analyticsTimeout,
      searchTimeout: this._searchTimeout,
      managementTimeout: this._managementTimeout,
      ...extraOpts,
    };

    if (this._auth) {
      if (this._auth.username || this._auth.password) {
        connOpts.username = this._auth.username;
        connOpts.password = this._auth.password;
      }

      if (this._auth.certificatePath || this._auth.keyPath) {
        connOpts.certificatePath = this._auth.certificatePath;
        connOpts.keyPath = this._auth.keyPath;
      }
    }

    return connOpts;
  }

  async _connect() {
    var connOpts = this._buildConnOpts({});
    var conn = new Connection(connOpts);
    try {
      await conn.connect();
      this._clusterConn = conn;
    } catch (e) {
      debug('failed to connect to cluster: %O', e);
    }
  }

  /**
   * @typedef ConnectCallback
   * @type {function}
   * @param {Error} err
   * @param {Cluster} cluster
   */
  /**
   * Connect establishes a connection to the cluster and is the entry
   * point for all SDK operations.
   *
   * @param {string} connStr
   * @param {Object} [options]
   * @param {string} [options.username]
   * @param {string} [options.password]
   * @param {string} [options.authenticator]
   * @param {string} [options.trustStorePath]
   * @param {number} [options.kvTimeout]
   * @param {number} [options.kvDurableTimeout]
   * @param {number} [options.viewTimeout]
   * @param {number} [options.queryTimeout]
   * @param {number} [options.analyticsTimeout]
   * @param {number} [options.searchTimeout]
   * @param {number} [options.managementTimeout]
   * @param {Transcoder} [options.transcoder]
   * @param {LoggingCallback} [options.logFunc]
   * @param {ConnectCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<Cluster>}
   */
  static async connect(connStr, options, callback) {
    return PromiseHelper.wrapAsync(async () => {
      var cluster = new Cluster(connStr, options);
      await cluster._connect();
      return cluster;
    }, callback);
  }

  /**
   * Contains the results from a previously executed Diagnostics operation.
   *
   * @typedef DiagnosticsResult
   * @type {Object}
   * @property {string} id
   * @property {number} version
   * @property {string} sdk
   * @property {*} services
   */
  /**
   * @typedef DiagnosticsCallback
   * @type {function}
   * @param {Error} err
   * @param {DiagnosticsResult} res
   */
  /**
   * Diagnostics returns stateful data about the current SDK connections.
   *
   * @param {Object} [options]
   * @param {string} [options.reportId]
   * @param {DiagnosticsCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<DiagnosticsResult>}
   */
  async diagnostics(options, callback) {
    if (options instanceof Function) {
      callback = arguments[0];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var connDiag = (conn) => {
        return new Promise((resolve, reject) => {
          conn.diag(null, (err, bytes) => {
            if (err) {
              return reject(err);
            }

            resolve(JSON.parse(bytes));
          });
        });
      };

      var conns = Object.values(this._conns);
      if (this._clusterConn) {
        conns.push(this._clusterConn);
      }
      if (conns.length == 0) {
        throw new Error('found no connections to test');
      }

      var diagProms = [];
      for (var i = 0; i < conns.length; ++i) {
        diagProms.push(connDiag(conns[i]));
      }
      var diagRes = await Promise.all(diagProms);

      var report = {
        id: diagRes[0].id,
        version: diagRes[0].version,
        sdk: diagRes[0].sdk,
        services: [],
      };

      if (options.reportId) {
        report.id = options.reportId;
      }

      for (var connIdx = 0; connIdx < diagRes.length; ++connIdx) {
        var connDiagRes = diagRes[connIdx];
        if (connDiagRes.config) {
          for (var svcIdx = 0; svcIdx < connDiagRes.config.length; ++svcIdx) {
            var svcDiagRes = connDiagRes.config[svcIdx];

            report.services.push({
              id: svcDiagRes.id,
              type: svcDiagRes.type,
              local: svcDiagRes.local,
              remote: svcDiagRes.remote,
              lastActivity: svcDiagRes.last_activity_us,
              status: svcDiagRes.status,
            });
          }
        }
      }

      return report;
    }, callback);
  }

  /**
   * Contains the results from a previously executed Diagnostics operation.
   *
   * @typedef PingResult
   * @type {Object}
   * @property {string} id
   * @property {number} version
   * @property {string} sdk
   * @property {*} services
   */
  /**
   * @typedef PingCallback
   * @type {function}
   * @param {Error} err
   * @param {PingResult} res
   */
  /**
   * Ping returns information from pinging the connections for this cluster.
   *
   * @param {Object} [options]
   * @param {string} [options.reportId]
   * @param {ServiceType[]} [options.serviceTypes]
   * @param {number} [options.timeout]
   * @param {PingCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<PingResult>}
   */
  async ping(options, callback) {
    if (options instanceof Function) {
      callback = arguments[0];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    var conn = this._getClusterConn();
    var exec = new PingExecutor(conn);
    return PromiseHelper.wrapAsync(async () => {
      var res = await exec.ping(options);

      return res;
    }, callback);
  }

  /**
   * @typedef QueryResult
   * @type {Object}
   * @property {Object[]} rows
   * @property {*} meta
   */
  /**
   * @typedef QueryCallback
   * @type {function}
   * @param {Error} err
   * @param {QueryResult} res
   */
  /**
   *
   * @param {string} query
   * The query string to execute.
   * @param {Object} [options]
   * @param {Object|Array} [options.parameters]
   * parameters specifies a list of values to substitute within the query
   * statement during execution.
   * @param {QueryScanConsistency} [options.scanConsistency]
   * scanConsistency specifies the level of consistency that is required for
   * the results of the query.
   * @param {MutationState} [options.consistentWith]
   * consistentWith specifies a MutationState object to use when determining
   * the level of consistency needed for the results of the query.
   * @param {boolean} [options.adhoc]
   * adhoc specifies that the query is an adhoc query and should not be
   * prepared and cached within the SDK.
   * @param {boolean} [options.flexIndex]
   * flexIndex specifies to enable the use of FTS indexes when selecting
   * indexes to use for the query.
   * @param {string} [options.clientContextId]
   * clientContextId specifies a unique identifier for the execution of this
   * query to enable various tools to correlate the query.
   * @param {number} [options.maxParallelism]
   * @param {number} [options.pipelineBatch]
   * @param {number} [options.pipelineCap]
   * @param {number} [options.scanWait]
   * @param {number} [options.scanCap]
   * @param {boolean} [options.readOnly]
   * readOnly specifies that query should not be permitted to mutate any data.
   * This option also enables a few minor performance improvements and the
   * ability to automatically retry the query on failure.
   * @param {QueryProfileMode} [options.profile]
   * profile enables the return of profiling data from the server.
   * @param {boolean} [options.metrics]
   * metrics enables the return of metrics data from the server
   * @param {Object} [options.raw]
   * raw specifies an object represent raw key value pairs that should be
   * included with the query.
   * @param {number} [options.timeout]
   * timeout specifies the number of ms to wait for completion before
   * cancelling the operation and returning control to the application.
   * @param {QueryCallback} [callback]
   * @throws {CouchbaseError}
   * @returns {Promise<QueryResult>}
   */
  async query(query, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    var conn = this._getClusterConn();
    var exec = new QueryExecutor(conn);
    var emitter = exec.query(query, options);

    return PromiseHelper.wrapRowEmitter(emitter, callback);
  }

  /**
   * @typedef AnalyticsResult
   * @type {Object}
   * @property {Object[]} rows
   * @property {*} meta
   */
  /**
   * @typedef AnalyticsQueryCallback
   * @type {function}
   * @param {Error} err
   * @param {AnalyticsResult} res
   */
  /**
   *
   * @param {string} query
   * The query string to execute.
   * @param {Object} [options]
   * @param {Object|Array} [options.parameters]
   * parameters specifies a list of values to substitute within the query
   * statement during execution.
   * @param {AnalyticsScanConsistency} [options.scanConsistency]
   * scanConsistency specifies the level of consistency that is required for
   * the results of the query.
   * @param {string} [options.clientContextId]
   * clientContextId specifies a unique identifier for the execution of this
   * query to enable various tools to correlate the query.
   * @param {boolean} [options.priority]
   * priority specifies that this query should be executed with a higher
   * priority than others, causing it to receive extra resources.
   * @param {boolean} [options.readOnly]
   * readOnly specifies that query should not be permitted to mutate any data.
   * This option also enables a few minor performance improvements and the
   * ability to automatically retry the query on failure.
   * @param {Object} [options.raw]
   * raw specifies an object represent raw key value pairs that should be
   * included with the query.
   * @param {number} [options.timeout]
   * timeout specifies the number of ms to wait for completion before
   * cancelling the operation and returning control to the application.
   * @param {AnalyticsQueryCallback} [callback]
   * @throws {CouchbaseError}
   * @returns {Promise<AnalyticsResult>}
   */
  async analyticsQuery(query, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    var conn = this._getClusterConn();
    var exec = new AnalyticsExecutor(conn);
    var emitter = exec.query(query, options);

    return PromiseHelper.wrapRowEmitter(emitter, callback);
  }

  /**
   * @typedef SearchQueryResult
   * @type {Object}
   * @property {Object[]} rows
   * @property {*} meta
   */
  /**
   * @typedef SearchQueryCallback
   * @type {function}
   * @param {Error} err
   * @param {SearchQueryResult} res
   */
  /**
   *
   * @param {string} indexName
   * The name of the index to execute the query against.
   * @param {SearchQuery} query
   * The search query object describing the requested search.
   * @param {Object} [options]
   * @param {number} [options.skip]
   * @param {number} [options.limit]
   * @param {boolean} [options.explain]
   * @param {Object} [options.highlight]
   * @param {HighlightStyle} [options.highlight.style]
   * @param {string[]} [options.highlight.fields]
   * @param {string[]} [options.fields]
   * @param {SearchFacet[]} [options.facets]
   * @param {SearchSort} [options.sort]
   * @param {boolean} [options.disableScoring]
   * @param {SearchScanConsistency} [options.consistency]
   * @param {MutationState} [options.consistentWith]
   * @param {number} [options.timeout]
   * @param {SearchQueryCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<SearchQueryResult>}
   */
  async searchQuery(indexName, query, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    var conn = this._getClusterConn();
    var exec = new SearchExecutor(conn);
    var emitter = exec.query(indexName, query, options);

    return PromiseHelper.wrapRowEmitter(emitter, callback);
  }

  /**
   * Gets a reference to a bucket.
   *
   * @param {string} bucketName
   *
   * @throws Never
   * @returns {Bucket}
   */
  bucket(bucketName) {
    return new Bucket(this, bucketName);
  }

  /**
   * Closes all connections associated with this cluster.  Any
   * running operations will be cancelled.  Further operations
   * will cause new connections to be established.
   *
   * @throws Never
   */
  async close() {
    if (this._clusterConn) {
      this._clusterConn.close();
      this._clusterConn = null;
    }

    for (var i in this._conns) {
      if (Object.prototype.hasOwnProperty.call(this._conns, i)) {
        this._conns[i].close();
      }
    }
    this._conns = [];

    this._closed = true;

    return true;
  }

  /**
   * Gets a user manager for this cluster
   *
   * @throws Never
   * @returns {UserManager}
   */
  users() {
    return new UserManager(this);
  }

  /**
   * Gets a bucket manager for this cluster
   *
   * @throws Never
   * @returns {BucketManager}
   */
  buckets() {
    return new BucketManager(this);
  }

  /**
   * Gets a query index manager for this cluster
   *
   * @throws Never
   * @returns {QueryIndexManager}
   */
  queryIndexes() {
    return new QueryIndexManager(this);
  }

  /**
   * Gets an analytics index manager for this cluster
   *
   * @throws Never
   * @returns {AnalyticsIndexManager}
   */
  analyticsIndexes() {
    return new AnalyticsIndexManager(this);
  }

  /**
   * Gets a search index manager for this cluster
   *
   * @throws Never
   * @returns {SearchIndexManager}
   */
  searchIndexes() {
    return new SearchIndexManager(this);
  }

  _getClusterConn() {
    if (this._closed) {
      throw new Error('parent cluster object has been closed');
    }

    if (this._clusterConn) {
      return this._clusterConn;
    }

    var conns = Object.values(this._conns);
    if (conns.length === 0) {
      throw new Error(
        'You must have one open bucket before you can perform queries.'
      );
    }

    return conns[0];
  }

  _getConn(opts) {
    if (this._closed) {
      throw new Error('parent cluster object has been closed');
    }

    var connKey = opts.bucketName;

    // Hijack the cluster-level connection if it is available
    if (this._clusterConn) {
      this._clusterConn.close();
      this._clusterConn = null;
      /*
      var conn = this._clusterConn;
      this._clusterConn = null;

      conn.selectBucket(opts.bucketName);

      this._conns[connKey] = conn;
      return conn;
      */
    }

    // Build a new connection for this, since there is no
    // cluster-level connection available.
    var connOpts = this._buildConnOpts({
      bucketName: opts.bucketName,
    });

    var conn = this._conns[connKey];

    if (!conn) {
      conn = new Connection(connOpts);

      conn.connect().catch((e) => {
        debug('failed to connect to bucket: %O', e);
        conn.close();
      });

      this._conns[connKey] = conn;
    }

    return conn;
  }
}

module.exports = Cluster;
