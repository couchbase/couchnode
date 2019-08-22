const CompoundTimeout = require('./compoundtimeout');
const DesignDocument = require('./designdocument');
const HttpExecutor = require('./httpexecutor');
const PromiseHelper = require('./promisehelper');
const errors = require('./errors');

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

  /**
   *
   * @param {*} options
   * @param {*} callback
   */
  async getAllDesignDocuments(options, callback) {
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
        throw new errors.CouchbaseError(
          'failed to get design documents',
          errors.makeHttpError(res));
      }

      var ddocData = JSON.parse(res.body);
      var ddocs = [];
      for (var i = 0; i < ddocData.rows.length; ++i) {
        var ddoc = ddocData.rows[i].doc;
        var fullDdocName = ddoc.meta.id.substr(8);
        ddocs.push(DesignDocument._fromData(fullDdocName, ddoc.json));
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
  async getDesignDocument(designDocName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      var res = await this._http.request({
        type: 'VIEW',
        method: 'GET',
        path: `_design/${designDocName}`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        var baseerr = errors.makeHttpError(res);

        if (res.statusCode === 404) {
          throw new errors.DesignDocumentNotFoundError(baseerr);
        }

        throw new errors.CouchbaseError('failed to get the design document', baseerr);
      }

      var ddocData = JSON.parse(res.body);
      return DesignDocument._fromData(designDocName, ddocData);
    }, callback);
  }

  /**
   *
   * @param {*} designDoc
   * @param {*} options
   * @param {*} callback
   */
  async upsertDesignDocument(designDoc, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      var designDocData = {
        views: designDoc.views
      };
      var encodedData = JSON.stringify(designDocData, (k, v) => {
        if (v instanceof Function) {
          return v.toString();
        }
        return v;
      });

      var res = await this._http.request({
        type: 'VIEW',
        method: 'PUT',
        path: `_design/${designDoc.name}`,
        contentType: 'application/json',
        body: encodedData,
        timeout: options.timeout,
      });

      if (res.statusCode !== 201) {
        throw new errors.CouchbaseError(
          'failed to upsert the design document',
          errors.makeHttpError(res));
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
  async dropDesignDocument(designDocName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      var res = await this._http.request({
        type: 'VIEW',
        method: 'DELETE',
        path: `_design/${designDocName}`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        var baseerr = errors.makeHttpError(res);

        if (res.statusCode === 404) {
          throw new errors.DesignDocumentNotFoundError(baseerr);
        }

        throw new errors.CouchbaseError('failed to drop the design document', baseerr);
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
  async publishDesignDocument(designDocName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      var timer = new CompoundTimeout(options.timeout);

      var designDoc = await this.getDesignDocument(`dev_${designDocName}`, {
        timeout: timer.left(),
      });

      // Replace the name without the `dev_` prefix on it.
      designDoc.name = designDocName;

      await this.upsertDesignDocument(designDoc, {
        timeout: timer.left(),
      });

      return true;
    }, callback);
  }
}
module.exports = ViewIndexManager;
