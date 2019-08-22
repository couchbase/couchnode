const CompoundTimeout = require('./compoundtimeout');
const PromiseHelper = require('./promisehelper');
const HttpExecutor = require('./httpexecutor');

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

    return PromiseHelper.wrap(async () => {
      var qs = '';

      qs += 'CREATE DATAVERSE';

      if (options.ignoreIfExists) {
        qs += ' IF NOT EXISTS';
      }

      qs += ' `' + dataverseName + '`';

      try {
        await this._cluster.queryAnalytics(qs, {
          timeout: options.timeout,
        });
        return true;
      } catch (err) {
        if (!options.ignoreIfExists) {
          if (err.message.indexOf('already exist') >= 0) {
            throw new errors.DataverseAlreadyExistsError(err);
          }
        }

        throw err;
      }
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

    return PromiseHelper.wrap(async () => {
      var qs = '';

      qs += 'DROP DATAVERSE';

      if (options.ignoreIfNotExists) {
        qs += ' IF EXISTS';
      }

      qs += ' `' + dataverseName + '`';

      try {
        await this._cluster.queryAnalytics(qs, {
          timeout: options.timeout,
        });
        return true;
      } catch (err) {
        if (!options.ignoreIfNotExists) {
          if (err.message.indexOf('not found') >= 0) {
            throw new errors.DatasetNotFoundError(err);
          }
        }

        throw err;
      }
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

    return PromiseHelper.wrap(async () => {
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
        return true;
      } catch (err) {
        throw err;
      }
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

    return PromiseHelper.wrap(async () => {
      var qs = '';

      qs += 'DROP DATASET';

      if (options.ignoreIfNotExists) {
        qs += ' IF EXISTS';
      }

      if (options.dataverseName) {
        qs += ' `' + options.dataverseName + '`.`' + datasetName + '`';
      } else {
        qs += ' `' + datasetName + '`';
      }

      if (options.condition) {
        qs += ' WHERE ' + options.condition;
      }

      try {
        await this._cluster.queryAnalytics(qs, {
          timeout: options.timeout,
        });
        return true;
      } catch (err) {
        throw err;
      }
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

    return PromiseHelper.wrap(async () => {
      var qs =
        'SELECT d.* FROM `Metadata`.`Dataset` d WHERE d.DataverseName <> "Metadata"';

      var res = await this._cluster.queryAnalytics(qs, {
        timeout: options.timeout,
      });

      return JSON.parse(res.body);
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

    return PromiseHelper.wrap(async () => {
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

      await this._cluster.queryAnalytics(qs, {
        timeout: options.timeout,
      });

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

    return PromiseHelper.wrap(async () => {
      var qs = '';

      qs += 'DROP INDEX';

      if (options.ignoreIfNotExists) {
        qs += ' IF EXISTS';
      }

      if (options.dataverseName) {
        qs += ' `' + options.dataverseName + '`.`' + datasetName + '`';
      } else {
        qs += ' `' + datasetName + '`';
      }
      qs += '.`' + indexName + '`';

      await this._cluster.queryAnalytics(qs, {
        timeout: options.timeout,
      });

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

    return PromiseHelper.wrap(async () => {
      var qs =
        'SELECT d.* FROM `Metadata`.`Index` d WHERE d.DataverseName <> "Metadata"';

      var res = await this._cluster.queryAnalytics(qs, {
        timeout: options.timeout,
      });

      return JSON.parse(res.body);
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

    return PromiseHelper.wrap(async () => {
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

    return PromiseHelper.wrap(async () => {
      var qs = 'DISCONNECT LINK `' + linkName + '`';

      await this._cluster.queryAnalytics(qs, {
        timeout: options.timeout,
      });

      return true;
    }, callback);
  }

}
module.exports = AnalyticsIndexManager;
