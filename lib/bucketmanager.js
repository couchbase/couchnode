const PromiseHelper = require('./promisehelper');
const HttpExecutor = require('./httpexecutor');
const utils = require('./utils');
const errors = require('./errors');

/**
 * BucketManager provides an interface for adding/removing/updating
 * buckets within the cluster.
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
   * @typedef {Object} BucketSettings
   * @property {string} name
   * @property {boolean} flushEnabled
   * @property {number} ramQuotaMB
   * @property {number} numReplicas
   * @property {boolean} replicaIndexes
   * @property {BucketType} bucketType
   * @property {EvictionPolicy} ejectionMethod
   * @property {number} maxTTL
   * @property {CompressionMode} compressionMode
   */

  /**
   * CreateBucketSettings provides information for creating a bucket.
   *
   * @typedef {Object} CreateBucketSettings
   * @augments BucketSettings
   * @property {ConflictResolutionType} conflictResolutionType
   */

  /**
   *
   * @param {CreateBucketSettings} settings
   * @param {*} [options]
   * @param {number} [options.timeout]
   * @param {CreateBucketCallback} [callback]
   * @returns {Promise<CreateBucketResult>}
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
        body: utils.cbQsStringify(settings),
        timeout: options.timeout,
      });

      if (res.statusCode !== 202) {
        var baseerr = errors.makeHttpError(res);
        var errtext = res.body.toString().toLowerCase();

        if (errtext.includes('already exists')) {
          throw new errors.BucketAlreadyExistsError(baseerr);
        }

        throw new errors.CouchbaseError('failed to create bucket', baseerr);
      }

      return true;
    }, callback);
  }

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
        body: utils.cbQsStringify(settings),
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
   *
   * @param {string} bucketName
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
