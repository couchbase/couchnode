'use strict';

const PromiseHelper = require('./promisehelper');
const HttpExecutor = require('./httpexecutor');
const utils = require('./utils');
const errors = require('./errors');
const enums = require('./enums');

function durabilityLevelToNsServerString(duraLevel) {
  if (duraLevel instanceof String) {
    return duraLevel;
  }

  if (duraLevel === enums.DurabilityLevel.None) {
    return 'none';
  } else if (duraLevel === enums.DurabilityLevel.Majority) {
    return 'majority';
  } else if (duraLevel === enums.DurabilityLevel.MajorityAndPersistOnMaster) {
    return 'majorityAndPersistActive';
  } else if (duraLevel === enums.DurabilityLevel.PersistToMajority) {
    return 'persistToMajority';
  } else {
    throw new Error('invalid durability level specified');
  }
}

function serializeSettingsToQs(settings) {
  settings = { ...settings };

  if (settings.minimumDurabilityLevel !== undefined) {
    settings.durabilityMinLevel = durabilityLevelToNsServerString(
      settings.minimumDurabilityLevel
    );

    delete settings.minimumDurabilityLevel;
  }

  if (settings.maxExpiry !== undefined) {
    settings.maxTTL = settings.maxExpiry;
    delete settings.maxExpiry;
  }

  return utils.cbQsStringify(settings);
}

/**
 * BucketManager provides an interface for adding/removing/updating
 * buckets within the cluster.
 *
 * @category Management
 */
class BucketManager {
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
   * BucketSettings provides information about a specific bucket.
   *
   * @typedef BucketSettings
   * @type {Object}
   * @property {string} name
   * @property {boolean} flushEnabled
   * @property {number} ramQuotaMB
   * @property {number} numReplicas
   * @property {boolean} replicaIndexes
   * @property {BucketType} bucketType
   * @property {EvictionPolicy} ejectionMethod
   * @property {number} maxExpiry
   * @property {CompressionMode} compressionMode
   * @property {DurabilityLevel} minimumDurabilityLevel
   */

  /**
   * CreateBucketSettings provides information for creating a bucket.
   *
   * @typedef CreateBucketSettings
   * @type {Object}
   * @augments BucketSettings
   * @property {ConflictResolutionType} conflictResolutionType
   */
  /**
   * @typedef CreateBucketCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} res
   */
  /**
   *
   * @param {CreateBucketSettings} settings
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {CreateBucketCallback} [callback]
   *
   * @throws {BucketExistsError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async createBucket(settings, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'MGMT',
        method: 'POST',
        path: `/pools/default/buckets`,
        contentType: 'application/x-www-form-urlencoded',
        body: serializeSettingsToQs(settings),
        timeout: options.timeout,
      });

      if (res.statusCode !== 202) {
        var baseerr = errors.makeHttpError(res);
        var errtext = res.body.toString().toLowerCase();

        if (errtext.includes('already exists')) {
          throw new errors.BucketExistsError(baseerr);
        }

        throw new errors.CouchbaseError('failed to create bucket', baseerr);
      }

      return true;
    }, callback);
  }

  /**
   * @typedef UpdateBucketCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} res
   */
  /**
   *
   * @param {BucketSettings} settings
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {UpdateBucketCallback} [callback]
   *
   * @throws {BucketNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async updateBucket(settings, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'MGMT',
        method: 'POST',
        path: `/pools/default/buckets/${settings.name}`,
        contentType: 'application/x-www-form-urlencoded',
        body: serializeSettingsToQs(settings),
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        var baseerr = errors.makeHttpError(res);
        var errtext = res.body.toString().toLowerCase();

        if (errtext.includes('not found')) {
          throw new errors.BucketNotFoundError(baseerr);
        }

        throw new errors.CouchbaseError('failed to update bucket', baseerr);
      }

      return true;
    }, callback);
  }

  /**
   * @typedef DropBucketCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} res
   */
  /**
   *
   * @param {string} bucketName
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {DropBucketCallback} [callback]
   *
   * @throws {BucketNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async dropBucket(bucketName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'MGMT',
        method: 'DELETE',
        path: `/pools/default/buckets/${bucketName}`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        var baseerr = errors.makeHttpError(res);
        var errtext = res.body.toString().toLowerCase();

        if (errtext.includes('not found')) {
          throw new errors.BucketNotFoundError(baseerr);
        }

        throw new errors.CouchbaseError('failed to drop bucket', baseerr);
      }

      return true;
    }, callback);
  }

  /**
   * @typedef GetBucketCallback
   * @type {function}
   * @param {Error} err
   * @param {BucketSettings} res
   */
  /**
   *
   * @param {string} bucketName
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {GetBucketCallback} [callback]
   *
   * @throws {BucketNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<BucketSettings>}
   */
  async getBucket(bucketName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'MGMT',
        method: 'GET',
        path: `/pools/default/buckets/${bucketName}`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        var baseerr = errors.makeHttpError(res);
        var errtext = res.body.toString().toLowerCase();

        if (errtext.includes('not found')) {
          throw new errors.BucketNotFoundError(baseerr);
        }

        throw new errors.CouchbaseError('failed to get bucket', baseerr);
      }

      return JSON.parse(res.body);
    }, callback);
  }

  /**
   * @typedef GetAllBucketsCallback
   * @type {function}
   * @param {Error} err
   * @param {BucketSettings[]} res
   */
  /**
   *
   * @param {string} bucketName
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {GetAllBucketsCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<BucketSettings[]>}
   */
  async getAllBuckets(options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'MGMT',
        method: 'GET',
        path: `/pools/default/buckets`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        var baseerr = errors.makeHttpError(res);
        throw new errors.CouchbaseError('failed to get buckets', baseerr);
      }

      return JSON.parse(res.body);
    }, callback);
  }

  /**
   * @typedef FlushBucketCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} res
   */
  /**
   *
   * @param {string} bucketName
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {FlushBucketCallback} [callback]
   *
   * @throws {BucketNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async flushBucket(bucketName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'MGMT',
        method: 'POST',
        path: `/pools/default/buckets/${bucketName}/controller/doFlush`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        var baseerr = errors.makeHttpError(res);
        var errtext = res.body.toString().toLowerCase();

        if (errtext.includes('not found')) {
          throw new errors.BucketNotFoundError(baseerr);
        }

        throw new errors.CouchbaseError('failed to get bucket', baseerr);
      }

      return true;
    }, callback);
  }
}
module.exports = BucketManager;
