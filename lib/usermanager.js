const PromiseHelper = require('./promisehelper');
const HttpExecutor = require('./httpexecutor');
const qs = require('querystring');

/**
 * UserManager is an interface which enables the management of users
 * within a cluster.
 *
 * @category Management
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

  /**
   * @typedef {function(Error, User)} GetUserCallback
   */
  /**
   *
   * @param {string} username
   * @param {*} [options]
   * @param {integer} [options.timeout]
   * @param {GetUserCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<User>}
   */
  async getUser(username, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var domainName = 'local';
      if (options.domainName) {
        domainName = options.domainName;
      }

      var res = await this._http.request({
        type: 'MGMT',
        method: 'GET',
        path: `/settings/rbac/users/${domainName}/${username}`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 201) {
        throw new Error('failed to get user');
      }

      return JSON.parse(res.body);
    }, callback);
  }

  /**
   * @typedef {function(Error, User[])} GetAllUsersCallback
   */
  /**
   *
   * @param {*} [options]
   * @param {integer} [options.timeout]
   * @param {GetAllUsersCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<User[]>}
   */
  async getAllUsers(options, callback) {
    if (options instanceof Function) {
      callback = arguments[0];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
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

  /**
   * @typedef {function(Error, boolean)} DropUserCallback
   */
  /**
   *
   * @param {string} username
   * @param {*} [options]
   * @param {integer} [options.timeout]
   * @param {DropUserCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async dropUser(username, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var domainName = 'local';
      if (options.domainName) {
        domainName = options.domainName;
      }

      var res = await this._http.request({
        type: 'MGMT',
        method: 'DELETE',
        path: `/settings/rbac/users/${domainName}/${username}`,
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
