'use strict';

const CompoundTimeout = require('./compoundtimeout');
const DesignDocument = require('./designdocument');
const HttpExecutor = require('./httpexecutor');
const PromiseHelper = require('./promisehelper');
const errors = require('./errors');

/**
 * ViewIndexManager is an interface which enables the management
 * of view indexes on the cluster.
 *
 * @category Management
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
   * @typedef GetAllDesignDocumentsCallback
   * @type {function}
   * @param {Error} err
   * @param {DesignDocument[]} res
   */
  /**
   *
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {GetAllDesignDocumentsCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<DesignDocument[]>}
   */
  async getAllDesignDocuments(options, callback) {
    if (options instanceof Function) {
      callback = arguments[0];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      const bucketName = this._bucket.name;

      var res = await this._http.request({
        type: 'MGMT',
        method: 'GET',
        path: `/pools/default/buckets/${bucketName}/ddocs`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new errors.CouchbaseError(
          'failed to get design documents',
          errors.makeHttpError(res)
        );
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
   * @typedef GetDesignDocumentCallback
   * @type {function}
   * @param {Error} err
   * @param {DesignDocument} res
   */
  /**
   *
   * @param {string} designDocName
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {GetDesignDocumentCallback} [callback]
   *
   * @throws {DesignDocumentNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<DesignDocument>}
   */
  async getDesignDocument(designDocName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'VIEW',
        method: 'GET',
        path: `/_design/${designDocName}`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        var baseerr = errors.makeHttpError(res);

        if (res.statusCode === 404) {
          throw new errors.DesignDocumentNotFoundError(baseerr);
        }

        throw new errors.CouchbaseError(
          'failed to get the design document',
          baseerr
        );
      }

      var ddocData = JSON.parse(res.body);
      return DesignDocument._fromData(designDocName, ddocData);
    }, callback);
  }

  /**
   * @typedef UpsertDesignDocumentCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} res
   */
  /**
   *
   * @param {DesignDocument} designDoc
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {UpsertDesignDocumentCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<DesignDocument>}
   */
  async upsertDesignDocument(designDoc, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var designDocData = {
        views: designDoc.views,
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
        path: `/_design/${designDoc.name}`,
        contentType: 'application/json',
        body: encodedData,
        timeout: options.timeout,
      });

      if (res.statusCode !== 201) {
        throw new errors.CouchbaseError(
          'failed to upsert the design document',
          errors.makeHttpError(res)
        );
      }

      return true;
    }, callback);
  }

  /**
   * @typedef DropDesignDocumentCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} res
   */
  /**
   *
   * @param {string} designDocName
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {DropDesignDocumentCallback} [callback]
   *
   * @throws {DesignDocumentNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<DesignDocument>}
   */
  async dropDesignDocument(designDocName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'VIEW',
        method: 'DELETE',
        path: `/_design/${designDocName}`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        var baseerr = errors.makeHttpError(res);

        if (res.statusCode === 404) {
          throw new errors.DesignDocumentNotFoundError(baseerr);
        }

        throw new errors.CouchbaseError(
          'failed to drop the design document',
          baseerr
        );
      }

      return true;
    }, callback);
  }

  /**
   * @typedef PublishDesignDocumentCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} res
   */
  /**
   *
   * @param {string} designDocName
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {PublishDesignDocumentCallback} [callback]
   *
   * @throws {DesignDocumentNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async publishDesignDocument(designDocName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
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
