'use strict';

const PromiseHelper = require('./promisehelper');
const HttpExecutor = require('./httpexecutor');
const errors = require('./errors');

/**
 * AnalyticsIndexManager provides an interface for performing management
 * operations against the analytics indexes for the cluster.
 *
 * @category Management
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

  /**
   * @typedef CreateDataverseCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} success
   */
  /**
   *
   * @param {string} dataverseName
   * @param {Object} [options]
   * @param {boolean} [options.ignoreIfExists]
   * @param {number} [options.timeout]
   * @param {CreateDataverseCallback} [callback]
   *
   * @throws {DataverseExistsError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
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
        await this._cluster.analyticsQuery(qs, {
          timeout: options.timeout,
        });
      } catch (err) {
        if (err instanceof errors.DataverseExistsError) {
          throw err;
        }

        throw new errors.CouchbaseError('failed to create dataverse', err);
      }

      return true;
    }, callback);
  }

  /**
   * @typedef DropDataverseCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} success
   */
  /**
   *
   * @param {string} dataverseName
   * @param {Object} [options]
   * @param {boolean} [options.ignoreIfNotExists]
   * @param {number} [options.timeout]
   * @param {DropDataverseCallback} [callback]
   *
   * @throws {DataverseNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
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
        await this._cluster.analyticsQuery(qs, {
          timeout: options.timeout,
        });
      } catch (err) {
        if (err instanceof errors.DataverseNotFoundError) {
          throw err;
        }

        throw new errors.CouchbaseError('failed to drop dataverse', err);
      }

      return true;
    }, callback);
  }

  /**
   * @typedef CreateDatasetCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} success
   */
  /**
   *
   * @param {string} datasetName
   * @param {Object} [options]
   * @param {boolean} [options.ignoreIfExists]
   * @param {string} [options.dataverseName]
   * @param {string} [options.condition]
   * @param {number} [options.timeout]
   * @param {CreateDatasetCallback} [callback]
   *
   * @throws {DatasetExistsError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
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

      if (options.condition) {
        qs += ' WHERE ' + options.condition;
      }

      try {
        await this._cluster.analyticsQuery(qs, {
          timeout: options.timeout,
        });
      } catch (err) {
        if (err instanceof errors.DatasetExistsError) {
          throw err;
        }

        throw new errors.CouchbaseError('failed to create dataset', err);
      }

      return true;
    }, callback);
  }

  /**
   * @typedef DropDatasetCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} success
   */
  /**
   *
   * @param {string} datasetName
   * @param {Object} [options]
   * @param {boolean} [options.ignoreIfNotExists]
   * @param {string} [options.dataverseName]
   * @param {number} [options.timeout]
   * @param {DropDatasetCallback} [callback]
   *
   * @throws {DatasetNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
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

      try {
        await this._cluster.analyticsQuery(qs, {
          timeout: options.timeout,
        });
      } catch (err) {
        if (err instanceof errors.DatasetNotFoundError) {
          throw err;
        }

        throw new errors.CouchbaseError('failed to drop dataset', err);
      }

      return true;
    }, callback);
  }

  /**
   * @typedef AnalyticsDataset
   * @type {Object}
   * @property {string} name
   * @property {string} dataverseName
   * @property {string} linkName
   * @property {string} bucketName
   */
  /**
   * @typedef GetAllDatasetsCallback
   * @type {function}
   * @param {Error} err
   * @param {AnalyticsDataset[]} datasets
   */
  /**
   *
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {GetAllDatasetsCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<AnalyticsDataset[]>}
   */
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

      var res = await this._cluster.analyticsQuery(qs, {
        timeout: options.timeout,
      });

      var datasets = [];
      res.rows.forEach((row) => {
        datasets.push({
          name: row.DatasetName,
          dataverseName: row.DataverseName,
          linkName: row.LinkName,
          bucketName: row.BucketName,
        });
      });

      return datasets;
    }, callback);
  }

  /**
   * @typedef CreateAnalyticsIndexCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} success
   */
  /**
   *
   * @param {string} datasetName
   * @param {string} indexName
   * @param {string[]} fields
   * @param {Object} [options]
   * @param {string} [options.dataverseName]
   * @param {boolean} [options.ignoreIfExists]
   * @param {number} [options.timeout]
   * @param {CreateAnalyticsIndexCallback} [callback]
   *
   * @throws {IndexExistsError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
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
        qs += ' ON `' + options.dataverseName + '`.`' + datasetName + '`';
      } else {
        qs += ' ON `' + datasetName + '`';
      }

      qs += ' (';

      var firstField = true;
      for (var i in fields) {
        if (Object.prototype.hasOwnProperty.call(fields, i)) {
          if (firstField) {
            firstField = false;
          } else {
            qs += ', ';
          }

          qs += '`' + i + '`: ' + fields[i];
        }
      }

      qs += ')';

      await this._cluster.analyticsQuery(qs, {
        timeout: options.timeout,
      });

      return true;
    }, callback);
  }

  /**
   * @typedef DropAnalyticsIndexCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} success
   */
  /**
   *
   * @param {string} datasetName
   * @param {string} indexName
   * @param {Object} [options]
   * @param {string} [options.dataverseName]
   * @param {boolean} [options.ignoreIfNotExists]
   * @param {number} [options.timeout]
   * @param {DropAnalyticsIndexCallback} [callback]
   *
   * @throws {AnalyticsIndexNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
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

      await this._cluster.analyticsQuery(qs, {
        timeout: options.timeout,
      });

      return true;
    }, callback);
  }

  /**
   * @typedef AnalyticsIndex
   * @type {Object}
   * @property {string} name
   * @property {string} datasetName
   * @property {string} dataverseName
   * @property {boolean} isPrimary
   */
  /**
   * @typedef GetAllAnalyticsIndexesCallback
   * @type {function}
   * @param {Error} err
   * @param {AnalyticsIndex[]} indexes
   */
  /**
   *
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {GetAllAnalyticsIndexesCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<AnalyticsIndex[]>}
   */
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

      var res = await this._cluster.analyticsQuery(qs, {
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

  /**
   * @typedef ConnectLinkCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} success
   */
  /**
   *
   * @param {string} linkName
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {ConnectLinkCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async connectLink(linkName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var qs = 'CONNECT LINK ' + linkName;

      await this._cluster.analyticsQuery(qs, {
        timeout: options.timeout,
      });

      return true;
    }, callback);
  }

  /**
   * @typedef DisconnectLinkCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} success
   */
  /**
   *
   * @param {string} linkName
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {DisconnectLinkCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async disconnectLink(linkName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var qs = 'DISCONNECT LINK ' + linkName;

      await this._cluster.analyticsQuery(qs, {
        timeout: options.timeout,
      });

      return true;
    }, callback);
  }

  /**
   * @typedef GetPendingMutationsCallback
   * @type {function}
   * @param {Error} err
   * @param {Object.<string, number>} pendingMutations
   */
  /**
   *
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {GetPendingMutationsCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<Object.<string, number>>}
   */
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
        type: 'ANALYTICS',
        method: 'GET',
        path: `/analytics/node/agg/stats/remaining`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new errors.CouchbaseError(
          'failed to get pending mutations',
          errors.makeHttpError(res)
        );
      }

      return JSON.parse(res.body);
    }, callback);
  }
}
module.exports = AnalyticsIndexManager;
