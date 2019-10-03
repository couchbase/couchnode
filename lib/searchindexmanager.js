const CompoundTimeout = require('./compoundtimeout');
const PromiseHelper = require('./promisehelper');
const HttpExecutor = require('./httpexecutor');
const errors = require('./errors');

/**
 *
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
        type: 'FTS',
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
        type: 'FTS',
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

  async upsertIndex(indexDefinition, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrapAsync(async () => {
      var res = await this._http.request({
        type: 'FTS',
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
        type: 'FTS',
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
        type: 'FTS',
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
        type: 'FTS',
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
        type: 'FTS',
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
        type: 'FTS',
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
        type: 'FTS',
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
        type: 'FTS',
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
        type: 'FTS',
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
