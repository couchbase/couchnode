'use strict';

const Scope = require('./scope');
const PromiseHelper = require('./promisehelper');
const CollectionManager = require('./collectionmanager');
const ViewExecutor = require('./viewexecutor');
const ViewIndexManager = require('./viewindexmanager');

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
   * @typedef {Object} ViewQueryResult
   * @property {Object[]} rows
   * @property {*} meta
   */
  /**
   * @typedef {function(Error, ViewQueryResult)} ViewQueryCallback
   */
  /**
   *
   * @param {string} designDoc The design document containing the view to query
   * @param {string} viewName The name of the view to query
   * @param {*} options
   * @param {ViewUpdateMode} [options.stale]
   * @param {integer} [options.skip]
   * @param {integer} [options.limit]
   * @param {ViewOrderMode} [options.order]
   * @param {string} [options.reduce]
   * @param {boolean} [options.group]
   * @param {integer} [options.groupLevel]
   * @param {string} [options.key]
   * @param {string[]} [options.keys]
   * @param {*} [options.range]
   * @param {string|string[]} [options.range.start]
   * @param {string|string[]} [options.range.end]
   * @param {boolean} [options.range.inclusiveEnd]
   * @param {string[]} [options.idRange]
   * @param {string} [options.idRange.start]
   * @param {string} [options.idRange.end]
   * @param {boolean} [options.fullSet]
   * @param {ViewErrorMode} [options.onError]
   * @param {integer} [options.timeout]
   * @param {ViewQueryCallback} [callback]
   * @throws CouchbaseError
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
   * @throws Never
   * @returns {string}
   */
  get name() {
    return this._name;
  }
}

module.exports = Bucket;
