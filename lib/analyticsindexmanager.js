const CompoundTimeout = require('./compoundtimeout');
const PromiseHelper = require('./promisehelper');
const HttpExecutor = require('./httpexecutor');
const errors = require('./errors');

/**
 * AnalyticsIndexManager provides an interface for performing management
 * operations against the analytics indexes for the cluster.
 */
class AnalyticsIndexManager {
  /**
   * @hideconstructor
   */
  constructor(cluster) {
    this._cluster = cluster;
  }

  get _http() {
    return new HttpExecutor(this._cluster._getClusterConn());
  }

  async createDataverse(dataverseName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var qs = '';

      qs += 'CREATE DATAVERSE';

      qs += ' `' + dataverseName + '`';

      if (options.ignoreIfExists) {
        qs += ' IF NOT EXISTS';
      }

      try {
        await this._cluster.queryAnalytics(qs, {
          timeout: options.timeout,
        });
      } catch (err) {
        if (err.message.indexOf('already exist') >= 0) {
          throw new errors.DataverseAlreadyExistsError(err);
        }

        throw new errors.CouchbaseError('failed to create dataverse', err);
      }

      return true;
    }, callback);
  }

  async dropDataverse(dataverseName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var qs = '';

      qs += 'DROP DATAVERSE';

      qs += ' `' + dataverseName + '`';

      if (options.ignoreIfNotExists) {
        qs += ' IF EXISTS';
      }

      try {
        await this._cluster.queryAnalytics(qs, {
          timeout: options.timeout,
        });
      } catch (err) {
        if (err.message.indexOf('Cannot find') >= 0) {
          throw new errors.DataverseNotFoundError(err);
        }

        throw new errors.CouchbaseError('failed to drop dataverse', err);
      }

      return true;
    }, callback);
  }

  async createDataset(bucketName, datasetName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var qs = '';

      qs += 'CREATE DATASET';

      if (options.ignoreIfExists) {
        qs += ' IF NOT EXISTS';
      }

      if (options.dataverseName) {
        qs += ' `' + options.dataverseName + '`.`' + datasetName + '`';
      } else {
        qs += ' `' + datasetName + '`';
      }

      qs += ' ON `' + bucketName + '`';

      try {
        await this._cluster.queryAnalytics(qs, {
          timeout: options.timeout,
        });
      } catch (err) {
        if (err.message.indexOf('already exist') >= 0) {
          throw new errors.DatasetAlreadyExistsError(err);
        }

        throw new errors.CouchbaseError('failed to create dataset', err);
      }

      return true;
    }, callback);
  }

  async dropDataset(datasetName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var qs = '';

      qs += 'DROP DATASET';

      if (options.dataverseName) {
        qs += ' `' + options.dataverseName + '`.`' + datasetName + '`';
      } else {
        qs += ' `' + datasetName + '`';
      }

      if (options.ignoreIfNotExists) {
        qs += ' IF EXISTS';
      }

      if (options.condition) {
        qs += ' WHERE ' + options.condition;
      }

      try {
        await this._cluster.queryAnalytics(qs, {
          timeout: options.timeout,
        });
      } catch (err) {
        if (err.message.indexOf('Cannot find') >= 0) {
          throw new errors.DatasetNotFoundError(err);
        }

        throw new errors.CouchbaseError('failed to drop dataset', err);
      }

      return true;
    }, callback);
  }

  async getAllDatasets(options, callback) {
    if (options instanceof Function) {
      callback = arguments[0];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var qs =
        'SELECT d.* FROM `Metadata`.`Dataset` d WHERE d.DataverseName <> "Metadata"';

      var res = await this._cluster.queryAnalytics(qs, {
        timeout: options.timeout,
      });

      var datasets = [];
      res.rows.forEach((row) => {
        datasets.push({
          name: row.DatasetName,
          dataverseName: row.DataverseName,
          linkName: row.LinkName,
          bucketName: row.BucketName
        });
      });

      return datasets;
    }, callback);
  }

  async createIndex(datasetName, indexName, fields, options, callback) {
    if (options instanceof Function) {
      callback = arguments[3];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var qs = '';

      qs += 'CREATE INDEX';

      qs += ' `' + indexName + '`';

      if (options.ignoreIfExists) {
        qs += ' IF NOT EXISTS';
      }

      if (options.dataverseName) {
        qs += ' ON `' + options.dataverseName + '`.`' + datasetName +
          '`';
      } else {
        qs += ' ON `' + datasetName + '`';
      }

      qs += ' (';

      var firstField = true;
      for (var i in fields) {
        if (fields.hasOwnProperty(i)) {
          if (firstField) {
            firstField = false;
          } else {
            qs += ', ';
          }

          qs += '`' + i + '`: ' + fields[i];
        }
      }

      qs += ')';

      try {
        await this._cluster.queryAnalytics(qs, {
          timeout: options.timeout,
        });
      } catch (err) {
        if (err.message.indexOf('already exists') >= 0) {
          throw new errors.AnalyticsIndexAlreadyExistsError(err);
        }

        throw new errors.CouchbaseError('failed to create index', err);
      }

      return true;
    }, callback);
  }

  async dropIndex(datasetName, indexName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var qs = '';

      qs += 'DROP INDEX';

      if (options.dataverseName) {
        qs += ' `' + options.dataverseName + '`.`' + datasetName + '`';
      } else {
        qs += ' `' + datasetName + '`';
      }
      qs += '.`' + indexName + '`';

      if (options.ignoreIfNotExists) {
        qs += ' IF EXISTS';
      }

      try {
        await this._cluster.queryAnalytics(qs, {
          timeout: options.timeout,
        });
      } catch (err) {
        if (err.message.indexOf('Cannot find') >= 0) {
          throw new errors.AnalyticsIndexNotFoundError(err);
        }

        throw new errors.CouchbaseError('failed to drop index', err);
      }

      return true;
    }, callback);
  }

  async getAllIndexes(options, callback) {
    if (options instanceof Function) {
      callback = arguments[0];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var qs =
        'SELECT d.* FROM `Metadata`.`Index` d WHERE d.DataverseName <> "Metadata"';

      var res = await this._cluster.queryAnalytics(qs, {
        timeout: options.timeout,
      });

      var indexes = [];
      res.rows.forEach((row) => {
        indexes.push({
          name: row.IndexName,
          datasetName: row.DatasetName,
          dataverseName: row.DataverseName,
          isPrimary: row.IsPrimary,
        });
      });

      return indexes;
    }, callback);
  }

  async connectLink(linkName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var qs = 'CONNECT LINK `' + linkName + '`';

      await this._cluster.queryAnalytics(qs, {
        timeout: options.timeout,
      });

      return true;
    }, callback);
  }

  async disconnectLink(linkName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var qs = 'DISCONNECT LINK `' + linkName + '`';

      await this._cluster.queryAnalytics(qs, {
        timeout: options.timeout,
      });

      return true;
    }, callback);
  }

  async getPendingMutations(options, callback) {
    if (options instanceof Function) {
      callback = arguments[0];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'CBAS',
        method: 'GET',
        path: `/analytics/node/agg/stats/remaining`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new Error('failed to get pending mutations');
      }

      return true;
    }, callback);
  }

}
module.exports = AnalyticsIndexManager;
