const Collection = require('./collection');
const Scope = require('./scope');
const PromiseHelper = require('./promisehelper');
const ViewExecutor = require('./viewexecutor');
const ViewIndexManager = require('./viewindexmanager');
const QueryIndexManager = require('./queryindexmanager');

/**
 * 
 */
class Bucket {
  /**
   * This should never be invoked directly by an application.
   * 
   * @hideconstructor
   */
  constructor(cluster, bucketName) {
    this._cluster = cluster;
    this._name = bucketName;
    this._conn = cluster._getConn({
      bucketName: bucketName
    });
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
   * @throws LotsOfStuff
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

    if (options.bucket) {
      throw new Error('cannot specify a bucket name for this query');
    }

    options.bucket = this._name;

    return this._cluster.query(query, params, options, callback);
  }

  async _viewQuery(isSpatial, designDoc, viewName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    var exec = new ViewExecutor(this._conn);
    var emitter = exec.query(isSpatial, designDoc, viewName, options);

    return PromiseHelper.wrapRowEmitter(emitter, callback);
  }

  /**
   * 
   * @param {string} designDoc 
   * @param {string} viewName
   * @param {*} options
   * @param {boolean} options.include_docs
   * @param {ViewUpdateMode} [options.stale]
   * @param {integer} [options.skip]
   * @param {integer} [options.limit]
   * @param {ViewOrderMode} [options.order]
   * @param {string} [options.reduce]
   * @param {boolean} [options.group]
   * @param {integer} [options.group_level]
   * @param {string} [options.key]
   * @param {string[]} [options.keys]
   * @param {*} [options.range]
   * @param {string|string[]} [options.range.start]
   * @param {string|string[]} [options.range.end]
   * @param {boolean} [options.range.inclusive_end]
   * @param {string[]} [options.id_range]
   * @param {string} [options.id_range.start]
   * @param {string} [options.id_range.end]
   * @param {string} [options.include_docs]
   * @param {boolean} [options.full_set]
   * @param {ViewErrorMode} [options.on_error]
   * @param {integer} [options.timeout]
   * @param {ViewQueryResult} callback 
   * @throws LotsOfStuff
   * @returns {Promise<ViewQueryResult>}
   */
  async viewQuery(designDoc, viewName, options, callback) {
    return this._viewQuery(false, designDoc, viewName, options, callback);
  }

  /**
   * 
   * @param {string} designDoc 
   * @param {string} viewName
   * @param {*} options
   * @param {SpatialViewQueryResult} callback 
   * @throws LotsOfStuff
   * @returns {Promise<SpatialViewQueryResult>}
   */
  async spatialViewQuery(designDoc, viewName, options, callback) {
    return this._viewQuery(true, designDoc, viewName, options, callback);
  }

  /**
   * Gets a reference to a specific scope.
   * 
   * @param {string} scopeName 
   * @throws Never
   * @returns {Scope}
   */
  scope(scopeName) {
    return new Scope(this, scopeName);
  }

  /**
   * Gets a reference to the default scope.
   * 
   * @throws Never
   * @returns {Scope}
   */
  defaultScope() {
    return this.scope(Scope.DEFAULT_NAME);
  }

  /**
   * Gets a reference to a specific collection.
   * 
   * @param {string} collectionName 
   * @throws Never
   * @returns {Collection}
   */
  collection(collectionName) {
    var scope = new Scope(this, '');
    return scope.collection(collectionName);
  }

  /**
   * Gets a reference to the default collection.
   * 
   * @throws Never
   * @returns {Collection}
   */
  defaultCollection() {
    return this.collection('');
  }

  /**
   * Gets a view index manager for this bucket
   * 
   * @returns {ViewIndexManager}
   */
  viewIndices() {
    return new ViewIndexManager(this);
  }

  /**
   * Gets a query index manager for this bucket
   * 
   * @returns {QueryIndexManager}
   */
  queryIndices() {
    return new QueryIndexManager(this);
  }

  /**
   * Returns the name of this bucket.
   * @returns {string}
   */
  get name() {
    return this._name;
  }
}

module.exports = Bucket;
