'use strict';

/**
 * BinaryCollection provides various binary operations which
 * are available to be performed against a collection.
 */
class BinaryCollection {
  /**
   * @hideconstructor
   */
  constructor(collection) {
    this._coll = collection;
  }

  /**
   * @typedef {Object} IncrementResult
   * @property {integer} value
   * @property {Cas} cas
   * @property {MutationToken} [mutationToken]
   */
  /**
   * @typedef {function(Error, IncrementResult)} IncrementCallback
   */
  /**
   *
   * @param {string} key
   * @param {integer} value
   * @param {*} [options]
   * @param {integer} [options.timeout]
   * @param {IncrementCallback} callback
   *
   * @throws {CouchbaseError}
   * @returns {Promise<IncrementResult>}
   */
  increment(key, value, options, callback) {
    return this._coll._binaryIncrement(key, value, options, callback);
  }

  /**
   * @typedef {Object} DecrementResult
   * @property {integer} value
   * @property {Cas} cas
   * @property {MutationToken} [mutationToken]
   */
  /**
   * @typedef {function(Error, DecrementResult)} DecrementCallback
   */
  /**
   *
   * @param {string} key
   * @param {integer} value
   * @param {*} [options]
   * @param {integer} [options.timeout]
   * @param {DecrementCallback} callback
   *
   * @throws {CouchbaseError}
   * @returns {Promise<DecrementResult>}
   */
  decrement(key, value, options, callback) {
    return this._coll._binaryDecrement(key, value, options, callback);
  }

  /**
   * @typedef {Object} AppendResult
   * @property {Cas} cas
   * @property {MutationToken} [mutationToken]
   */
  /**
   * @typedef {function(Error, AppendResult)} AppendCallback
   */
  /**
   *
   * @param {string} key
   * @param {Buffer} value
   * @param {*} [options]
   * @param {integer} [options.timeout]
   * @param {AppendCallback} callback
   *
   * @throws {CouchbaseError}
   * @returns {Promise<AppendResult>}
   */
  append(key, value, options, callback) {
    return this._coll._binaryAppend(key, value, options, callback);
  }

  /**
   * @typedef {Object} PrependResult
   * @property {Cas} cas
   * @property {MutationToken} [mutationToken]
   */
  /**
   * @typedef {function(Error, PrependResult)} PrependCallback
   */
  /**
   *
   * @param {string} key
   * @param {Buffer} value
   * @param {*} [options]
   * @param {integer} [options.timeout]
   * @param {PrependCallback} callback
   *
   * @throws {CouchbaseError}
   * @returns {Promise<PrependResult>}
   */
  prepend(key, value, options, callback) {
    return this._coll._binaryPrepend(key, value, options, callback);
  }
}

module.exports = BinaryCollection;
