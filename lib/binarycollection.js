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
   * @typedef IncrementResult
   * @type {Object}
   * @property {number} value
   * @property {Cas} cas
   * @property {MutationToken} [mutationToken]
   */
  /**
   * @typedef IncrementCallback
   * @type {function}
   * @param {Error} err
   * @param {IncrementResult} res
   */
  /**
   *
   * @param {string} key
   * @param {number} value
   * @param {Object} [options]
   * @param {number} [options.initial]
   * @param {number} [options.delta]
   * @param {number} [options.timeout]
   * @param {IncrementCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<IncrementResult>}
   */
  increment(key, value, options, callback) {
    return this._coll._binaryIncrement(key, value, options, callback);
  }

  /**
   * @typedef DecrementResult
   * @type {Object}
   * @property {number} value
   * @property {Cas} cas
   * @property {MutationToken} [mutationToken]
   */
  /**
   * @typedef DecrementCallback
   * @type {function}
   * @param {Error} err
   * @param {DecrementResult} res
   */
  /**
   *
   * @param {string} key
   * @param {number} value
   * @param {Object} [options]
   * @param {number} [options.initial]
   * @param {number} [options.delta]
   * @param {number} [options.timeout]
   * @param {DecrementCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<DecrementResult>}
   */
  decrement(key, value, options, callback) {
    return this._coll._binaryDecrement(key, value, options, callback);
  }

  /**
   * @typedef AppendResult
   * @type {Object}
   * @property {Cas} cas
   * @property {MutationToken} [mutationToken]
   */
  /**
   * @typedef AppendCallback
   * @type {function}
   * @param {Error} err
   * @param {AppendResult} res
   */
  /**
   *
   * @param {string} key
   * @param {Buffer} value
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {AppendCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<AppendResult>}
   */
  append(key, value, options, callback) {
    return this._coll._binaryAppend(key, value, options, callback);
  }

  /**
   * @typedef PrependResult
   * @type {Object}
   * @property {Cas} cas
   * @property {MutationToken} [mutationToken]
   */
  /**
   * @typedef PrependCallback
   * @type {function}
   * @param {Error} err
   * @param {PrependResult} res
   */
  /**
   *
   * @param {string} key
   * @param {Buffer} value
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {PrependCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<PrependResult>}
   */
  prepend(key, value, options, callback) {
    return this._coll._binaryPrepend(key, value, options, callback);
  }
}

module.exports = BinaryCollection;
