const Collection = require('./collection');

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

  /**
   * @typedef {function(Error, QueryResult)} QueryCallback
   */
  /**
   *
   * @param {string} query
   * The query string to execute.
   * @param {Object|Array} [params]
   * @param {*} [options]
   * @param {integer} [options.timeout]
   * @param {QueryCallback} [callback]
   * @throws Lots Of Stuff
   * @returns {Promise<QueryResult>}
   */
  query(query, params, options, callback) {

  }

  /**
   * Gets a reference to a specific collection.
   *
   * @param {string} collectionName
   * @throws Never
   * @returns {Collection}
   */
  collection(collectionName) {
    return new Collection(this, collectionName);
  }

}

Scope.DEFAULT_NAME = '_default';

module.exports = Scope;
