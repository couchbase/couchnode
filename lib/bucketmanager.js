const PromiseHelper = require('./promisehelper');
const HttpExecutor = require('./httpexecutor');
const qs = require('querystring');

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

  async create(settings, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      var res = await this._http.request({
        type: 'MGMT',
        method: 'POST',
        path: `/pools/default/buckets`,
        contentType: 'application/x-www-form-urlencoded',
        body: qs.stringify(settings),
        timeout: options.timeout,
      });

      if (res.statusCode !== 201) {
        throw new Error('failed to create bucket');
      }

      return true;
    }, callback);
  }

  async update(settings, options, callback) {

  }

  async drop(bucketName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      var res = await this._http.request({
        type: 'MGMT',
        method: 'DELETE',
        path: `/pools/default/buckets/${bucketName}`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 201) {
        throw new Error('failed to delete bucket');
      }

      return true;
    }, callback);
  }

  async get(bucketName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      var res = await this._http.request({
        type: 'MGMT',
        method: 'GET',
        path: `/pools/default/buckets/${bucketName}`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 201) {
        throw new Error('failed to get the bucket');
      }

      return JSON.parse(res.body);
    }, callback);
  }

  async getAll(options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      var res = await this._http.request({
        type: 'MGMT',
        method: 'GET',
        path: `/pools/default/buckets`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 201) {
        throw new Error('failed to get all bucket');
      }

      return JSON.parse(res.body);
    }, callback);
  }

  /**
   * 
   * @param {string} bucketName 
   */
  async flush(bucketName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      var res = await this._http.request({
        type: 'MGMT',
        method: 'POST',
        path: `pools/default/buckets/${bucketName}/controller/doFlush`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new Error('failed to flush bucket');
      }

      return true;
    }, callback);
  }
}
module.exports = BucketManager;
