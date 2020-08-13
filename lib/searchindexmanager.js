'use strict';

const PromiseHelper = require('./promisehelper');
const HttpExecutor = require('./httpexecutor');
const errors = require('./errors');

/**
 * SearchIndexManager provides an interface for managing the
 * search indexes on the cluster.
 *
 * @category Management
 */
class SearchIndexManager {
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
   * SearchIndex provides information about a search index.
   *
   * @typedef SearchIndex
   * @type {Object}
   * @property {string} uuid
   * @property {string} name
   * @property {string} sourceName
   * @property {string} type
   * @property {Object.<string, Object>} params
   * @property {string} sourceUuid
   * @property {Object.<string, Object>} sourceParams
   * @property {string} sourceType
   * @property {Object.<string, Object>} planParams
   */

  /**
   * @typedef GetSearchIndexCallback
   * @type {function}
   * @param {Error} err
   * @param {SearchIndex} res
   */
  /**
   *
   * @param {string} indexName
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {GetSearchIndexCallback} [callback]
   *
   * @throws {SearchIndexNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<SearchIndex>}
   */
  async getIndex(indexName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'SEARCH',
        method: 'GET',
        path: `/api/index/${indexName}`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new errors.SearchIndexNotFoundError();
      }

      return JSON.parse(res.body);
    }, callback);
  }

  /**
   * @typedef GetAllSearchIndexesCallback
   * @type {function}
   * @param {Error} err
   * @param {SearchIndex[]} res
   */
  /**
   *
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {GetAllSearchIndexesCallback} [callback]
   *
   * @throws {CouchbaseError}
   * @returns {Promise<SearchIndex[]>}
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
      var res = await this._http.request({
        type: 'SEARCH',
        method: 'GET',
        path: `/api/index`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new Error('failed to fetch search indices');
      }

      return JSON.parse(res.body);
    }, callback);
  }

  /**
   * @typedef UpsertSearchIndexCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} res
   */
  /**
   *
   * @param {SearchIndex} indexDefinition
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {UpsertSearchIndexCallback} [callback]
   *
   * @throws {SearchIndexNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async upsertIndex(indexDefinition, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    var indexName = indexDefinition.name;

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'SEARCH',
        method: 'PUT',
        path: `/api/index/${indexName}`,
        contentType: 'application/json',
        body: JSON.stringify(indexDefinition),
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new Error('failed to create index');
      }

      return true;
    }, callback);
  }

  /**
   * @typedef DropSearchIndexCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} res
   */
  /**
   *
   * @param {string} indexName
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {DropSearchIndexCallback} [callback]
   *
   * @throws {SearchIndexNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async dropIndex(indexName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'SEARCH',
        method: 'DELETE',
        path: `/api/index/${indexName}`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new Error('failed to delete search index');
      }

      return JSON.parse(res.body);
    }, callback);
  }

  /**
   * @typedef GetIndexedDocumentsCountCallback
   * @type {function}
   * @param {Error} err
   * @param {number} res
   */
  /**
   *
   * @param {string} indexName
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {GetIndexedDocumentsCountCallback} [callback]
   *
   * @throws {SearchIndexNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<number>}
   */
  async getIndexedDocumentsCount(indexName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'SEARCH',
        method: 'GET',
        path: `/api/index/${indexName}/count`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new Error('failed to get search indexed documents count');
      }

      return JSON.parse(res.body);
    }, callback);
  }

  /**
   * @typedef PauseIngestCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} res
   */
  /**
   *
   * @param {string} indexName
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {PauseIngestCallback} [callback]
   *
   * @throws {SearchIndexNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async pauseIngest(indexName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'SEARCH',
        method: 'POST',
        path: `/api/index/${indexName}/ingestControl/pause`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new Error('failed to pause search index ingestion');
      }

      return true;
    }, callback);
  }

  /**
   * @typedef ResumeIngestCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} res
   */
  /**
   *
   * @param {string} indexName
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {ResumeIngestCallback} [callback]
   *
   * @throws {SearchIndexNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async resumeIngest(indexName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'SEARCH',
        method: 'POST',
        path: `/api/index/${indexName}/ingestControl/resume`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new Error('failed to resume search index ingestion');
      }

      return true;
    }, callback);
  }

  /**
   * @typedef AllowQueryingCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} res
   */
  /**
   *
   * @param {string} indexName
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {AllowQueryingCallback} [callback]
   *
   * @throws {SearchIndexNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async allowQuerying(indexName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'SEARCH',
        method: 'POST',
        path: `/api/index/${indexName}/queryControl/allow`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new Error('failed to allow search index quering');
      }

      return true;
    }, callback);
  }

  /**
   * @typedef DisallowQueryingCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} res
   */
  /**
   *
   * @param {string} indexName
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {DisallowQueryingCallback} [callback]
   *
   * @throws {SearchIndexNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async disallowQuerying(indexName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'SEARCH',
        method: 'POST',
        path: `/api/index/${indexName}/queryControl/disallow`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new Error('failed to disallow search index quering');
      }

      return true;
    }, callback);
  }

  /**
   * @typedef FreezePlanCallback
   * @type {function}
   * @param {Error} err
   * @param {boolean} res
   */
  /**
   *
   * @param {string} indexName
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {FreezePlanCallback} [callback]
   *
   * @throws {SearchIndexNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<boolean>}
   */
  async freezePlan(indexName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'SEARCH',
        method: 'POST',
        path: `/api/index/${indexName}/planFreezeControl/freeze`,
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new Error('failed to freeze search index plan');
      }

      return true;
    }, callback);
  }

  /**
   * @typedef AnalyzeDocumentCallback
   * @type {function}
   * @param {Error} err
   * @param {Object[]} res
   */
  /**
   *
   * @param {string} indexName
   * @param {*} document
   * @param {Object} [options]
   * @param {number} [options.timeout]
   * @param {AnalyzeDocumentCallback} [callback]
   *
   * @throws {SearchIndexNotFoundError}
   * @throws {CouchbaseError}
   * @returns {Promise<Object[]>}
   */
  async analyzeDocument(indexName, document, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'SEARCH',
        method: 'POST',
        path: `/api/index/${indexName}/analyzeDoc`,
        timeout: options.timeout,
        body: JSON.stringify(document),
      });

      if (res.statusCode !== 200) {
        throw new Error('failed to perform search index document analysis');
      }

      return JSON.parse(res.body).analyze;
    }, callback);
  }
}
module.exports = SearchIndexManager;
