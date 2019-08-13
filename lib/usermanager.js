const PromiseHelper = require('./promisehelper');
const HttpExecutor = require('./httpexecutor');
const qs = require('querystring');

/**
 * UserManager is an interface which enables the management of users
 * within a cluster.
 */
class UserManager {
  /**
   * @hideconstructor
   */
  constructor(cluster) {
    this._cluster = cluster;
  }

  get _http() {
    return new HttpExecutor(this._cluster._getClusterConn());
  }

  async get(userName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      var domainName = 'local';
      if (options.domainName) {
        domainName = options.domainName;
      }

      var res = await this._http.request({
        type: 'MGMT',
        method: 'GET',
        path: `/settings/rbac/users/${domainName}/${userName}`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 201) {
        throw new Error('failed to get user');
      }

      return JSON.parse(res.body);
    }, callback);
  }

  async getAll(options, callback) {
    if (options instanceof Function) {
      callback = arguments[0];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      var domainName = 'local';
      if (options.domainName) {
        domainName = options.domainName;
      }

      var res = await this._http.request({
        type: 'MGMT',
        method: 'GET',
        path: `/settings/rbac/users/${domainName}`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 201) {
        throw new Error('failed to get user');
      }

      return JSON.parse(res.body);
    }, callback);
  }

  async drop(userName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      var domainName = 'local';
      if (options.domainName) {
        domainName = options.domainName;
      }

      var res = await this._http.request({
        type: 'MGMT',
        method: 'DELETE',
        path: `/settings/rbac/users/${domainName}/${userName}`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 201) {
        throw new Error('failed to delete user');
      }

      return true;
    }, callback);
  }

}
module.exports = UserManager;
