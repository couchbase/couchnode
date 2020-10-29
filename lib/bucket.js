'use strict';

const Scope = require('./scope');
const PromiseHelper = require('./promisehelper');
const CollectionManager = require('./collectionmanager');
const ViewExecutor = require('./viewexecutor');
const ViewIndexManager = require('./viewindexmanager');
const PingExecutor = require('./pingexecutor');

/**
 * Bucket represents a storage grouping of data within a Couchbase Server cluster.
 */
class Bucket {
  /**
   * @hideconstructor
   */
  constructor(cluster, bucketName) {
    this._cluster = cluster;
    this._name = bucketName;
    this._conn = cluster._getConn({
      bucketName: bucketName,
    });
  }

  get _transcoder() {
    return this._cluster._transcoder;
  }

  /**
   * Ping returns information from pinging the connections for this bucket.
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

    var conn = this._conn;
    var exec = new PingExecutor(conn);
    return PromiseHelper.wrapAsync(async () => {
      var res = await exec.ping(options);

      return res;
    }, callback);
  }

  async _viewQuery(designDoc, viewName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    var exec = new ViewExecutor(this._conn);
    var emitter = exec.query(designDoc, viewName, options);

    return PromiseHelper.wrapRowEmitter(emitter, callback);
  }

  /**
   * @typedef ViewQueryResult
   * @type {Object}
   * @property {Object[]} rows
   * @property {*} meta
   */
  /**
   * @typedef ViewQueryCallback
   * @type {function}
   * @param {Error} err
   * @param {ViewQueryResult} res
   */
  /**
   *
   * @param {string} designDoc The design document containing the view to query
   * @param {string} viewName The name of the view to query
   * @param {Object} [options]
   * @param {ViewScanConsistency} [options.scanConsistency]
   * @param {number} [options.skip]
   * @param {number} [options.limit]
   * @param {ViewOrdering} [options.order]
   * @param {string} [options.reduce]
   * @param {boolean} [options.group]
   * @param {number} [options.groupLevel]
   * @param {string} [options.key]
   * @param {string[]} [options.keys]
   * @param {Object} [options.range]
   * @param {string|string[]} [options.range.start]
   * @param {string|string[]} [options.range.end]
   * @param {boolean} [options.range.inclusiveEnd]
   * @param {Object} [options.idRange]
   * @param {string} [options.idRange.start]
   * @param {string} [options.idRange.end]
   * @param {boolean} [options.fullSet]
   * @param {ViewErrorMode} [options.onError]
   * @param {number} [options.timeout]
   * @param {ViewQueryCallback} [callback]
   * @throws {CouchbaseError}
   * @returns {Promise<ViewQueryResult>}
   */
  async viewQuery(designDoc, viewName, options, callback) {
    return this._viewQuery(designDoc, viewName, options, callback);
  }

  /**
   * Gets a reference to a specific scope.
   *
   * @param {string} scopeName
   *
   * @throws Never
   * @returns {Scope}
   *
   * @uncommitted
   */
  scope(scopeName) {
    return new Scope(this, scopeName);
  }

  /**
   * Gets a reference to the default scope.
   *
   * @throws Never
   * @returns {Scope}
   *
   * @uncommitted
   */
  defaultScope() {
    return this.scope(Scope.DEFAULT_NAME);
  }

  /**
   * Gets a reference to a specific collection.
   *
   * @param {string} collectionName
   *
   * @throws Never
   * @returns {Collection}
   *
   * @uncommitted
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
   * @throws Never
   * @returns {ViewIndexManager}
   */
  viewIndexes() {
    return new ViewIndexManager(this);
  }

  /**
   * Gets a collection manager for this bucket
   *
   * @throws Never
   * @returns {CollectionManager}
   */
  collections() {
    return new CollectionManager(this);
  }

  /**
   * Returns the name of this bucket.
   *
   * @type {string}
   * @throws Never
   */
  get name() {
    return this._name;
  }
}

module.exports = Bucket;
