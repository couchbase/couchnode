const CompoundTimeout = require('./compoundtimeout');
const PromiseHelper = require('./promisehelper');
const HttpExecutor = require('./httpexecutor');

/**
 * QueryIndexManager provides an interface for managing the N1QL
 * query indexes on the cluster.
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
    return PromiseHelper.wrap(async () => {
      var qs = '';

      if (options.fields.length === 0) {
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

      if (options.deferred) {
        qs += ' WITH {"defer_build: true}';
      }

      try {
        await this._bucket.query(qs);
        return true;
      } catch (err) {
        if (options.ignoreIfExists) {
          if (err.message.indexOf('already exist') >= 0) {
            return true;
          }
        }

        throw err;
      }
    }, callback);
  }

  async create(bucketName, indexName, fields, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      return this._createIndex(bucketName, {
        name: indexName,
        fields: fields,
        ignoreIfExists: options.ignoreIfExists,
        deferred: options.deferred,
      });
    }, callback);
  }

  async createPrimary(bucketName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[0];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      return this._createIndex(bucketName, {
        name: options.name,
        ignoreIfExists: options.ignoreIfExists,
        deferred: options.deferred,
      });
    }, callback);
  }

  async _dropIndex(bucketName, options, callback) {
    return PromiseHelper.wrap(async () => {
      var qs = '';

      if (!options.name) {
        qs += 'DROP PRIMARY INDEX `' + bucketName + '`';
      } else {
        qs += 'DROP INDEX `' + bucketName + '`.`' + options.name + '`';
      }

      try {
        await this._bucket.query(qs);
        return true;
      } catch (err) {
        if (options.ignoreIfNotExists) {
          if (err.message.indexOf('not found') >= 0) {
            return true;
          }
        }

        throw err;
      }
    }, callback);
  }

  async drop(bucketName, indexName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      return this._dropIndex(bucketName, {
        name: indexName,
        ignoreIfNotExists: options.ignoreIfNotExists,
      });
    }, callback);
  }

  async dropPrimary(bucketName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[0];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      return this._dropIndex(bucketName, {
        name: options.name,
        ignoreIfNotExists: options.ignoreIfNotExists,
      });
    }, callback);
  }

  async getAll(bucketName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      var qs = '';
      qs += 'SELECT idx.* FROM system:indexes AS idx';
      qs += ' WHERE keyspace_id="' + bucketName + '"';
      qs += ' AND `using`="gsi" ORDER BY is_primary DESC, name ASC';

      var res = this._bucket.query(qs);

      /*
      Name
      IsPrimary
      Type
      State
      Keyspace
      IndexKey
      */

      return res;
    }, callback);
  }

  async buildDeferred(bucketName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      var indices = await this.list();

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
      await this._bucket.query(qs);

      // Return the list of indices that we built
      return deferredList;
    }, callback);
  }

  async watch(bucketName, indexNames, duration, options, callback) {
    throw new Error('watching of indexes is not yet supported');
  }
}
module.exports = QueryIndexManager;
