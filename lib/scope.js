'use strict';

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
}

Scope.DEFAULT_NAME = '_default';

module.exports = Scope;
