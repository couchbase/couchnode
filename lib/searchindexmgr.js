'use strict';

function SearchIndexManager(clusterMgr) {
  this.clusterMgr = clusterMgr;
}

//service, method, user, pass, path, contentType, body, callback
SearchIndexManager.prototype._ftsHttp = function(method, path, contentType,
  body, callback) {
  var user = this.clusterMgr._username;
  var pass = this.clusterMgr._password;
  var cluster = this.clusterMgr._cluster;

  return cluster._ftsHttp(method, user, pass, path, contentType, body,
    function(err, body, meta) {
      if (err) {
        callback(err, null);
        return;
      }

      if (meta.statusCode !== 200) {
        callback(new Error('request failed: bad status code (' +
          meta.statusCode + '): ' + body));
        return;
      }

      var data = null;
      try {
        data = JSON.parse(body);
      } catch (e) {
        callback(e, null);
        return;
      }

      if (data.status && data.status !== 'ok') {
        callback(new Error('fts indicated non-ok status code (' + data.status +
          ')'));
        return;
      }

      callback(null, data);
    });
};

SearchIndexManager.prototype.getAllIndexDefinitions = function(callback) {
  return this._ftsHttp('GET', '/api/index', null, null, function(err, data) {
    if (err) {
      callback(err, null);
      return;
    }

    callback(null, data.indexDefs.indexDefs);
  });
};

SearchIndexManager.prototype.getIndexDefinition =
  function(indexName, callback) {
    return this._ftsHttp('GET', '/api/index/' + indexName, null, null, function(
      err, data) {
      if (err) {
        callback(err, null);
        return;
      }

      callback(null, data.indexDef);
    });
  };

SearchIndexManager.prototype.createIndex = function(indexDef, callback) {
  var indexData = JSON.stringify(indexDef);

  return this._ftsHttp('PUT', '/api/index/' + indexDef.name,
    'application/json', indexData,
    function(err, data) {
      if (err) {
        callback(err);
        return;
      }

      callback(null);
    });
};

SearchIndexManager.prototype.deleteIndex = function(indexName, callback) {
  return this._ftsHttp('DELETE', '/api/index/' + indexName, null, null,
    function(err, data) {
      if (err) {
        callback(err);
        return;
      }

      callback(null);
    });
};

SearchIndexManager.prototype.getIndexedDocumentCount = function(indexName,
  callback) {
  return this._ftsHttp('GET', '/api/index/' + indexName + '/count', null,
    null,
    function(err, data) {
      if (err) {
        callback(err);
        return;
      }

      callback(null, data.count);
    });
};

SearchIndexManager.prototype.setIndexIngestion = function(indexName, op,
  callback) {
  return this._ftsHttp('POST', '/api/index/' + indexName + '/ingestControl/' +
    op, null, null,
    function(err, data) {
      if (err) {
        callback(err);
        return;
      }

      callback(null);
    });
};

SearchIndexManager.prototype.setIndexQuerying = function(indexName, op,
  callback) {
  return this._ftsHttp('POST', '/api/index/' + indexName + '/queryControl/' +
    op, null, null,
    function(err, data) {
      if (err) {
        callback(err);
        return;
      }

      callback(null);
    });
};

SearchIndexManager.prototype.setIndexPlanFreeze = function(indexName, op,
  callback) {
  return this._ftsHttp('POST', '/api/index/' + indexName +
    '/planFreezeControl/' + op, null, null,
    function(err, data) {
      if (err) {
        callback(err);
        return;
      }

      callback(null);
    });
};

SearchIndexManager.prototype.getAllIndexStats = function(callback) {
  return this._ftsHttp('GET', '/api/stats', null, null, function(err, data) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, data);
  });
};

SearchIndexManager.prototype.getIndexStats = function(indexName, callback) {
  return this._ftsHttp('GET', '/api/stats/index/' + indexName, null, null,
    function(err, data) {
      if (err) {
        callback(err);
        return;
      }

      callback(null, data);
    });
};

SearchIndexManager.prototype.getAllIndexPartitionInfo = function(callback) {
  return this._ftsHttp('GET', '/api/pindex', null, null, function(err, data) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, data.pindexes);
  });
};

SearchIndexManager.prototype.getIndexPartitionInfo = function(pIndexName,
  callback) {
  return this._ftsHttp('GET', '/api/pindex/' + pIndexName, null, null,
    function(err, data) {
      if (err) {
        callback(err);
        return;
      }

      callback(null, data.pindex);
    });
};

SearchIndexManager.prototype.getIndexPartitionIndexedDocumentCount =
  function(pIndexName, callback) {
    return this._ftsHttp('GET', '/api/pindex/' + pIndexName + '/count', null,
      null,
      function(err, data) {
        if (err) {
          callback(err);
          return;
        }

        callback(null, data.count);
      });
  };

module.exports = SearchIndexManager;
