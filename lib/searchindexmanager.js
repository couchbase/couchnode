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
   *
   * @param {Cluster} cluster
   * @private
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
   * @typedef {Object} SearchIndex
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
   * @typedef {function(Error, SearchIndex)} GetSearchIndexCallback
   */
  /**
   *
   * @param {string} indexName
   * @param {*} [options]
   * @param {integer} [options.timeout]
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
   * @typedef {function(Error, SearchIndex[])} GetAllSearchIndexesCallback
   */
  /**
   *
   * @param {*} [options]
   * @param {integer} [options.timeout]
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
   * @typedef {function(Error, boolean)} UpsertSearchIndexCallback
   */
  /**
   *
   * @param {SearchIndex} indexDefinition
   * @param {*} [options]
   * @param {integer} [options.timeout]
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
   * @typedef {function(Error, boolean)} DropSearchIndexCallback
   */
  /**
   *
   * @param {string} indexName
   * @param {*} [options]
   * @param {integer} [options.timeout]
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
   * @typedef {function(Error, number)} GetIndexedDocumentsCountCallback
   */
  /**
   *
   * @param {string} indexName
   * @param {*} [options]
   * @param {integer} [options.timeout]
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
   * @typedef {function(Error, boolean)} PauseIngestCallback
   */
  /**
   *
   * @param {string} indexName
   * @param {*} [options]
   * @param {integer} [options.timeout]
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
   * @typedef {function(Error, boolean)} ResumeIngestCallback
   */
  /**
   *
   * @param {string} indexName
   * @param {*} [options]
   * @param {integer} [options.timeout]
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
   * @typedef {function(Error, boolean)} AllowQueryingCallback
   */
  /**
   *
   * @param {string} indexName
   * @param {*} [options]
   * @param {integer} [options.timeout]
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
   * @typedef {function(Error, boolean)} DisallowQueryingCallback
   */
  /**
   *
   * @param {string} indexName
   * @param {*} [options]
   * @param {integer} [options.timeout]
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
   * @typedef {function(Error, boolean)} FreezePlanCallback
   */
  /**
   *
   * @param {string} indexName
   * @param {*} [options]
   * @param {integer} [options.timeout]
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
   * @typedef {function(Error, Object[])} AnalyzeDocumentCallback
   */
  /**
   *
   * @param {string} indexName
   * @param {*} document
   * @param {*} [options]
   * @param {integer} [options.timeout]
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
