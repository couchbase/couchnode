const CompoundTimeout = require('./compoundtimeout');
const DesignDocument = require('./designdocument');
const HttpExecutor = require('./httpexecutor');
const PromiseHelper = require('./promisehelper');

/**
 * ViewIndexManager is an interface which enables the management
 * of view indexes on the cluster.
 */
class ViewIndexManager {
  /**
   * @hideconstructor
   */
  constructor(bucket) {
    this._bucket = bucket;
  }

  get _http() {
    return new HttpExecutor(this._bucket._conn);
  }

  _stripDdocName(designDocName) {
    if (designDocName.startsWith('dev_')) {
      return designDocName.substr(4);
    }
    return designDocName;
  }

  _makeDdocName(realDdocName, isProduction) {
    if (!isProduction) {
      return 'dev_' + realDdocName;
    }
    return realDdocName;
  }

  /**
   * 
   * @param {*} options 
   * @param {*} callback 
   */
  async getAll(options, callback) {
    if (options instanceof Function) {
      callback = arguments[0];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      const bucketName = this._bucket.name;

      var res = await this._http.request({
        type: 'MGMT',
        method: 'GET',
        path: `pools/default/buckets/${bucketName}/ddocs`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new Error('failed to get design documents');
      }

      var ddocData = JSON.parse(res.body);
      var ddocs = [];
      for (var i = 0; i < ddocData.rows.length; ++i) {
        var ddoc = ddocData.rows[i].doc;
        var fullDdocName = ddoc.meta.id.substr(8);
        var realDdocName = this._stripDdocName(fullDdocName);
        ddocs.push(DesignDocument._fromData(realDdocName, ddoc.json));
      }

      return ddocs;
    }, callback);
  }

  /**
   * 
   * @param {*} designDocName 
   * @param {*} options 
   * @param {*} callback 
   */
  async get(designDocName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      var realDdocName = this._stripDdocName(designDocName);
      var fullDdocName =
        this._makeDdocName(realDdocName, options.isProduction);

      var res = await this._http.request({
        type: 'VIEW',
        method: 'GET',
        path: `_design/${fullDdocName}`,
        timeout: options.timeout,
      });

      if (res.statusCode === 404) {
        // Request was successful, but the design document does
        // not actually exist...
        return null;
      }

      if (res.statusCode !== 200) {
        throw new Error('failed to get design document');
      }

      var ddocData = JSON.parse(res.body);
      return DesignDocument._fromData(realDdocName, ddocData);
    }, callback);
  }

  /**
   * 
   * @param {*} designDoc 
   * @param {*} options 
   * @param {*} callback 
   */
  async upsert(designDoc, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      var encodedData = JSON.stringify(designDoc.data, (k, v) => {
        if (v instanceof Function) {
          return v.toString();
        }
        return v;
      });

      var realDdocName = this._stripDdocName(designDoc.name);
      var fullDdocName =
        this._makeDdocName(realDdocName, options.isProduction);

      var res = await this._http.request({
        type: 'VIEW',
        method: 'PUT',
        path: `_design/${fullDdocName}`,
        contentType: 'application/json',
        body: encodedData,
        timeout: options.timeout,
      });

      if (res.statusCode !== 201) {
        throw new Error('failed to upsert design documents');
      }

      return true;
    }, callback);
  }

  /**
   * 
   * @param {*} designDocName 
   * @param {*} options 
   * @param {*} callback 
   */
  async drop(designDocName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      var realDdocName = this._stripDdocName(designDocName);
      var fullDdocName =
        this._makeDdocName(realDdocName, options.isProduction);

      var res = await this._http.request({
        type: 'VIEW',
        method: 'DELETE',
        path: `_design/${fullDdocName}`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new Error('failed to remove design document');
      }

      return true;
    }, callback);
  }

  /**
   * @typedef {function(Error)} ViewPublishCallback
   */
  /**
   * 
   * @param {string} designDocName 
   * @param {*} [options]
   * @param {number} [options.timeout]
   * @param {ViewPublishCallback} [callback]
   * @returns {Promise<boolean>}
   * @throws Lots of Stuff
   */
  async publish(designDocName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      var timer = new CompoundTimeout(options.timeout);

      var designDoc = await this.get(designDocName, {
        isProduction: false,
        timeout: timer.left(),
      });

      await this.upsert(designDoc, {
        isProduction: true,
        timeout: timer.left(),
      });

      await this.remove(designDoc.name, {
        isProduction: false,
        timeout: timer.left(),
      });

      return true;
    }, callback);
  }
}
module.exports = ViewIndexManager;
