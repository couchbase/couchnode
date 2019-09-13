const AnalyticsExecutor = require('./analyticsexecutor');
const Bucket = require('./bucket');
const BucketManager = require('./bucketmanager');
const Connection = require('./connection');
const N1qlExecutor = require('./n1qlexecutor');
const PromiseHelper = require('./promisehelper');
const SearchExecutor = require('./searchexecutor');
const QueryIndexManager = require('./queryindexmanager');
const AnalyticsIndexManager = require('./analyticsindexmanager');
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
    this._connStr = connStr;

    this._auth = {
      type: 'rbac',
      username: options.username,
      password: options.password,
    };

    if (options.clientCertificate || options.certificateChain) {
      throw new Error('Certificate authentication is not yet supported');
    }

    this._clusterConn = null;
    this._conns = {};

    var transcoder = options.transcoder;
    if (!transcoder) {
      transcoder = new DefaultTranscoder();
    }
    this._transcoder = transcoder;
  }

  async _connect(callback) {
    return PromiseHelper.wrap(async () => {
      var connOpts = {
        connStr: this._connStr,
        username: this._auth.username,
        password: this._auth.password
      };

      var conn = new Connection(connOpts);
      try {
        await conn.connect();
        this._clusterConn = conn;
      } catch (e) {}
    }, callback);
  }

  /**
   * @private
   */
  static async connect(connStr, options, callback) {
    var cluster = new Cluster(connStr, options);
    await cluster._connect((err) => {
      if (callback) {
        if (err) {
          callback(err, null);
        } else {
          callback(null, cluster);
        }
      }
    });
    return cluster;
  }

  /**
   * @typedef {function(Error, QueryResult)} QueryCallback
   */
  /**
   *
   * @param {string} query
   * The query string to execute.
   * @param {Object|Array} [params]
   * @param {*} [options]
   * @param {QueryConsistencyMode} [options.consistency]
   * @param {MutationState} [options.consistentWith]
   * @param {boolean} [options.adhoc]
   * @param {number} [options.scanCap]
   * @param {number} [options.pipelineBatch]
   * @param {number} [options.pipelineCap]
   * @param {boolean} [options.readonly]
   * @param {QueryProfileMode} [options.profile]
   * @param {integer} [options.timeout]
   * @param {QueryCallback} [callback]
   * @throws Lots Of Stuff
   * @returns {Promise<QueryResult>}
   */
  async query(query, params, options, callback) {
    if (params instanceof Function) {
      callback = arguments[1];
      params = undefined;
      options = undefined;
    } else if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    var conn = this._getClusterConn();
    var exec = new N1qlExecutor(conn);
    var emitter = exec.query(query, params, options);

    return PromiseHelper.wrapRowEmitter(emitter, callback);
  }

  /**
   * @typedef {function(Error, AnalyticsQueryResult)} AnalyticsQueryCallback
   */
  /**
   *
   * @param {string} query
   * The query string to execute.
   * @param {Object|Array} [params]
   * @param {*} [options]
   * @param {integer} [options.timeout]
   * @param {AnalyticsQueryCallback} [callback]
   * @throws Lots Of Stuff
   * @returns {Promise<AnalyticsQueryResult>}
   */
  async queryAnalytics(query, params, options, callback) {
    if (params instanceof Function) {
      callback = arguments[1];
      params = undefined;
      options = undefined;
    } else if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    var conn = this._getClusterConn();
    var exec = new AnalyticsExecutor(conn);
    var emitter = exec.query(query, params, options);

    return PromiseHelper.wrapRowEmitter(emitter, callback);
  }

  /**
   * @typedef {Object} SearchQueryResult
   * @property {Object[]} rows
   * @property {*} meta
   */
  /**
   * @typedef {function(Error, SearchQueryResult)} SearchQueryCallback
   */
  /**
   *
   * @param {SearchQuery} query
   * The search query object describing the requested search.
   * @param {*} options
   * @param {number} [options.skip]
   * @param {number} [options.limit]
   * @param {boolean} [options.explain]
   * @param {string[]} [options.highlight]
   * @param {string[]} [options.fields]
   * @param {SearchFacet[]} [options.facets]
   * @param {SearchSort} [options.sort]
   * @param {SearchConsistency} [options.consistency]
   * @param {MutationState} [options.consistentWith]
   * @param {number} [options.timeout]
   * @param {SearchQueryCallback} callback
   * @throws Lots Of Stuff
   * @returns {Promise<SearchQueryResult>}
   */
  async querySearch(query, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    var conn = this._getClusterConn();
    var exec = new SearchExecutor(conn);
    var emitter = exec.query(query, options);

    return PromiseHelper.wrapRowEmitter(emitter, callback);
  }

  /**
   * Gets a reference to a bucket.
   *
   * @param {string} bucketName
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
    for (var i in this._conns) {
      if (this._conns.hasOwnProperty(i)) {
        this._conns[i].close();
      }
    }
    this._conns = [];

    return true;
  }

  /**
   * Gets a user manager for this cluster
   *
   * @returns {UserManager}
   */
  users() {
    return new UserManager(this);
  }

  /**
   * Gets a bucket manager for this cluster
   *
   * @returns {BucketManager}
   */
  buckets() {
    return new BucketManager(this);
  }

  /**
   * Gets a query index manager for this cluster
   *
   * @returns {QueryIndexManager}
   */
  queryIndexes() {
    return new QueryIndexManager(this);
  }

  /**
   * Gets an analytics index manager for this cluster
   *
   * @returns {AnalyticsIndexManager}
   */
  analyticsIndexes() {
    return new AnalyticsIndexManager(this);
  }

  /**
   * Gets a search index manager for this cluster
   *
   * @returns {SearchIndexManager}
   */
  searchIndexes() {
    return new SearchIndexManager(this);
  }

  _getClusterConn() {
    if (this._clusterConn) {
      return this._clusterConn;
    }

    var conns = Object.values(this._conns);
    if (conns.length === 0) {
      throw new Error('You must have one open bucket ' +
        'before you can perform queries.');
    }

    return conns[0];
  }

  _getConn(opts) {
    var connKey = opts.bucketName;

    // Hijack the cluster-level connection if it is available
    if (this._clusterConn) {
      var conn = this._clusterConn;
      this._clusterConn = null;

      conn.selectBucket(opts.bucketName);

      this._conns[connKey] = conn;
      return conn;
    }

    // Build a new connection for this, since there is no
    // cluster-level connection available.
    var connOpts = {
      connStr: this._connStr,
      username: this._auth.username,
      password: this._auth.password,
      bucketName: opts.bucketName,
    };

    var conn = this._conns[connKey];

    if (!conn) {
      conn = new Connection(connOpts);

      conn.connect();

      this._conns[connKey] = conn;
    }

    return conn;
  }
}

module.exports = Cluster;
