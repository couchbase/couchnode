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

  async get(indexName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
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

  async getAll(options, callback) {
    if (options instanceof Function) {
      callback = arguments[0];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
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

  async upsertIndex(indexName, sourceName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      var res = await this._http.request({
        type: 'FTS',
        method: 'PUT',
        path: `/api/index/${indexName}`,
        contentType: 'application/json',
        body: JSON.stringify({
          sourceName: sourceName,
          uuid: options.uuid,
          sourceType: options.sourceType,
          indexParams: options.indexParams,
          planParams: options.planParams,
          sourceParams: options.sourceParams,
        }),
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new Error('failed to create index');
      }

      return true;
    }, callback);
  }

  async upsertAlias(aliasName, indexName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
      var indexTargets = {};
      indexTargets[indexName] = {};

      var res = await this._http.request({
        type: 'FTS',
        method: 'PUT',
        path: `/api/index/${aliasName}`,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'fulltext-alias',
          params: {
            targets: indexTargets,
          },
          sourceType: 'nil',
          sourceName: '',
          sourceUUID: '',
          sourceParams: null,
          planParams: {},
          uuid: '',
        }),
        timeout: options.timeout,
      });

      if (res.statusCode !== 200) {
        throw new Error('failed to create index alias');
      }

      return true;
    }, callback);
  }

  async drop(indexName, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    return PromiseHelper.wrap(async () => {
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

}
module.exports = SearchIndexManager;
