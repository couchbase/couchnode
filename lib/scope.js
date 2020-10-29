'use strict';

const Collection = require('./collection');
const AnalyticsExecutor = require('./analyticsexecutor');
const QueryExecutor = require('./queryexecutor');
const PromiseHelper = require('./promisehelper');

/**
 *
 */
class Scope {
  /**
   * @hideconstructor
   */
  constructor(bucket, scopeName) {
    this._bucket = bucket;
    this._name = scopeName;
    this._conn = bucket._conn;
  }

  get _transcoder() {
    return this._bucket._transcoder;
  }

  /**
   * Gets a reference to a specific collection.
   *
   * @param {string} collectionName
   *
   * @throws Never
   * @returns {Collection}
   */
  collection(collectionName) {
    return new Collection(this, collectionName);
  }

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

    var bucket = this._bucket;
    var conn = bucket._conn;
    var exec = new QueryExecutor(conn);
    var emitter = exec.query(query, {
      ...options,
      queryContext: `${bucket._name}.${this._name}`,
    });

    return PromiseHelper.wrapRowEmitter(emitter, callback);
  }

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

    var bucket = this._bucket;
    var conn = bucket._conn;
    var exec = new AnalyticsExecutor(conn);
    var emitter = exec.query(query, {
      ...options,
      queryContext: `${bucket._name}.${this._name}`,
    });

    return PromiseHelper.wrapRowEmitter(emitter, callback);
  }
}

Scope.DEFAULT_NAME = '_default';

module.exports = Scope;
