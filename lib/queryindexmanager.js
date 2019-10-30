const PromiseHelper = require('./promisehelper');
const HttpExecutor = require('./httpexecutor');
const CompoundTimeout = require('./compoundtimeout');
const errors = require('./errors');

class QueryIndex {
  constructor() {
    this.name = '';
    this.isPrimary = false;
    this.type = '';
    this.state = '';
    this.keyspace = '';
    this.indexKey = [];
    this.condition = [];
  }

  _fromData(data) {
    this.name = data.name;
    this.isPrimary = data.is_primary;
    this.type = data.using;
    this.state = data.state;
    this.keyspace = data.keyspace_id;
    this.indexKey = data.index_key;
    this.condition = data.condition;

    return this;
  }
}

/**
 * QueryIndexManager provides an interface for managing the N1QL
 * query indexes on the cluster.
 *
 * @category Management
 */
class QueryIndexManager {
  /**
   * @hideconstructor
   */
  constructor(cluster) {
    this._cluster = cluster;
  }

  get _http() {
    return new HttpExecutor(this._cluster._getClusterConn());
  }

  async _createIndex(bucketName, options, callback) {
    return PromiseHelper.wrapAsync(async () => {
      var qs = '';

      if (!options.fields) {
        qs += 'CREATE PRIMARY INDEX';
      } else {
        qs += 'CREATE INDEX';
      }

      if (options.name) {
        qs += ' `' + options.name + '`';
      }

      qs += ' ON `' + bucketName + '`';

      if (options.fields && options.fields.length > 0) {
        qs += '(';
        for (var i = 0; i < options.fields.length; ++i) {
          if (i > 0) {
            qs += ', ';
          }

          qs += '`' + options.fields[i] + '`';
        }
        qs += ')';
      }

      var withOpts = {};

      if (options.deferred) {
        withOpts.defer_build = true;
      }

      if (options.numReplicas) {
        withOpts.num_replica = options.numReplicas;
      }

      if (Object.keys(withOpts).length > 0) {
        qs += ' WITH ' + JSON.stringify(withOps);
      }

      try {
        try {
          await this._cluster.query(qs, {
            timeout: options.timeout,
          });
        } catch (err) {
          if (err.message.indexOf('already exists') >= 0) {
            throw new errors.QueryIndexAlreadyExistsError(err);
          }

          throw err;
        }
      } catch (err) {
        if (options.ignoreIfExists &&
          err instanceof errors.QueryIndexAlreadyExistsError) {
          // swallow the error if the user wants us to
        } else {
          throw err;
        }
      }

      return true;
    }, callback);
  }

  /**
   * @typedef {function(Error, boolean)} CreateQueryIndexCallback
   */
  /**
   *
   * @param {string} bucketName
   * @param {string} indexName
   * @param {string[]} fields
   * @param {*} [options]
   * @param {boolean} [options.ignoreIfExists]
   * @param {boolean} [options.deferred]
   * @param {integer} [options.timeout]
   * @param {CreateQueryIndexCallback} [callback]
   *
   * @throws {QueryIndexAlreadyExistsError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async createIndex(bucketName, indexName, fields, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      return this._createIndex(bucketName, {
        name: indexName,
        fields: fields,
        ignoreIfExists: options.ignoreIfExists,
        deferred: options.deferred,
        timeout: options.timeout,
      });
    }, callback);
  }

  /**
   * @typedef {function(Error, boolean)} CreatePrimaryIndexCallback
   */
  /**
   *
   * @param {string} bucketName
   * @param {*} [options]
   * @param {boolean} [options.ignoreIfExists]
   * @param {boolean} [options.deferred]
   * @param {integer} [options.timeout]
   * @param {CreatePrimaryIndexCallback} [callback]
   *
   * @throws {QueryIndexAlreadyExistsError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async createPrimaryIndex(bucketName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[0];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      return this._createIndex(bucketName, {
        name: options.name,
        ignoreIfExists: options.ignoreIfExists,
        deferred: options.deferred,
        timeout: options.timeout,
      });
    }, callback);
  }

  async _dropIndex(bucketName, options, callback) {
    return PromiseHelper.wrapAsync(async () => {
      var qs = '';

      if (!options.name) {
        qs += 'DROP PRIMARY INDEX `' + bucketName + '`';
      } else {
        qs += 'DROP INDEX `' + bucketName + '`.`' + options.name + '`';
      }

      try {
        try {
          await this._cluster.query(qs, {
            timeout: options.timeout,
          });
        } catch (err) {
          if (err.message.indexOf('not found') >= 0) {
            throw new errors.QueryIndexNotFoundError(err);
          }

          throw err;
        }
      } catch (err) {
        if (options.ignoreIfNotExists &&
          err instanceof errors.QueryIndexNotFoundError) {
          // swallow the error if the user wants us to
        } else {
          throw err;
        }
      }

      return true;
    }, callback);
  }

  /**
   * @typedef {function(Error, boolean)} DropQueryIndexCallback
   */
  /**
   *
   * @param {string} bucketName
   * @param {string} indexName
   * @param {*} [options]
   * @param {boolean} [options.ignoreIfNotExists]
   * @param {integer} [options.timeout]
   * @param {DropQueryIndexCallback} [callback]
   *
   * @throws {QueryIndexNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async dropIndex(bucketName, indexName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      return this._dropIndex(bucketName, {
        name: indexName,
        ignoreIfNotExists: options.ignoreIfNotExists,
        timeout: options.timeout,
      });
    }, callback);
  }

  /**
   * @typedef {function(Error, boolean)} DropPrimaryIndexCallback
   */
  /**
   *
   * @param {string} bucketName
   * @param {*} [options]
   * @param {boolean} [options.ignoreIfNotExists]
   * @param {integer} [options.timeout]
   * @param {DropPrimaryIndexCallback} [callback]
   *
   * @throws {QueryIndexNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async dropPrimaryIndex(bucketName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[0];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      return this._dropIndex(bucketName, {
        name: options.name,
        ignoreIfNotExists: options.ignoreIfNotExists,
        timeout: options.timeout,
      });
    }, callback);
  }

  /**
   * @typedef {Object} QueryIndex
   * @property {string} name
   * @property {boolean} isPrimary
   * @property {string} type
   * @property {string} state
   * @property {string} keyspace
   * @property {string} indexKey
   */

  /**
   * @typedef {function(Error, QueryIndex[])} GetAllIndexesCallback
   */
  /**
   *
   * @param {string} bucketName
   * @param {*} [options]
   * @param {integer} [options.timeout]
   * @param {GetAllIndexesCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<QueryIndex[]>}
   */
  async getAllIndexes(bucketName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var qs = '';
      qs += 'SELECT idx.* FROM system:indexes AS idx';
      qs += ' WHERE keyspace_id="' + bucketName + '"';
      qs += ' AND `using`="gsi" ORDER BY is_primary DESC, name ASC';

      var res = await this._cluster.query(qs, {
        timeout: options.timeout,
      });

      var indexes = [];
      res.rows.forEach((row) => {
        indexes.push(new QueryIndex()._fromData(row));
      });

      return indexes;
    }, callback);
  }

  /**
   * @typedef {function(Error, string[])} BuildDeferredIndexesCallback
   */
  /**
   *
   * @param {string} bucketName
   * @param {*} [options]
   * @param {integer} [options.timeout]
   * @param {BuildDeferredIndexesCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<string[]>}
   */
  async buildDeferredIndexes(bucketName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    var timer = new CompoundTimeout(options.timeout);

    return PromiseHelper.wrapAsync(async () => {
      var indices = await this.getAllIndexes({
        timeout: timer.left(),
      });

      var deferredList = [];
      for (var i = 0; i < indices.length; ++i) {
        var index = indices[i];

        if (index.state === 'deferred' || index.state === 'pending') {
          deferredList.push(index.name);
        }
      }

      // If there are no deferred indexes, we have nothing to do.
      if (!deferredList) {
        return [];
      }

      var qs = '';
      qs += 'BUILD INDEX ON `' + bucketName + '` ';
      qs += '(';
      for (var j = 0; j < deferredList.length; ++j) {
        if (j > 0) {
          qs += ', ';
        }
        qs += '`' + deferredList[j] + '`';
      }
      qs += ')';

      // Run our deferred build query
      await this._cluster.query(qs, {
        timeout: timer.left(),
      });

      // Return the list of indices that we built
      return deferredList;
    }, callback);
  }

  async watchIndexes(bucketName, indexNames, duration, options, callback) {
    throw new Error('watching of indexes is not yet supported');
  }
}
module.exports = QueryIndexManager;
