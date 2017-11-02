'use strict';

var N1qlQuery = require('./n1qlquery');

function _respRead(callback) {
  return function(resp) {
    resp.setEncoding('utf8');
    var strBuffer = '';
    resp.on('data', function (data) {
      strBuffer += data;
    });
    resp.on('end', function () {
      callback(null, resp, strBuffer);
    });
    resp.on('error', function (err) {
      callback(err, resp, null);
    });
  };
}

/**
 * @class
 * A class for performing management operations against a bucket. This class
 * should not be instantiated directly, but instead through the use of the
 * {@link Bucket#manager} method instead.
 *
 * @param bucket
 *
 * @private
 *
 * @since 2.0.0
 * @committed
 */
function BucketManager(bucket) {
  this._bucket = bucket;
}

/**
 * Method for performing a http mgmt operation using the underlying bucket.
 *
 * @param path
 * @param method
 * @param callback
 *
 * @private
 * @ignore
 */
BucketManager.prototype._mgmtRequest = function(path, method, callback) {
  var b = this._bucket;
  b._maybeInvoke(b._mgmtRequest.bind(b), [path, method, callback]);
};

/**
 * Method for performing a http capi request using the underlying bucket.
 *
 * @param path
 * @param method
 * @param callback
 *
 * @private
 * @ignore
 */
BucketManager.prototype._capiRequest = function(path, method, callback) {
  var b = this._bucket;
  b._maybeInvoke(b._capiRequest.bind(b), [path, method, callback]);
};

/**
 * Retrieves a list of all design documents registered to a bucket.
 *
 * @param callback
 *
 * @since 2.0.0
 * @committed
 */
BucketManager.prototype.getDesignDocuments = function(callback) {
  var path = 'pools/default/buckets/' + this._bucket._name + '/ddocs';

  this._mgmtRequest(path, 'GET', function(err, httpReq) {
    if (err) {
      return callback(err, null);
    }

    httpReq.on('error', callback);
    httpReq.on('response', _respRead(function (err, resp, data) {
      if (err) {
        return callback(err);
      }
      if (resp.statusCode !== 200) {
        var errData = null;
        try {
          errData = JSON.parse(data);
        } catch(e) {
        }

        if (!errData) {
          callback(new Error(
              'operation failed (' + resp.statusCode +')'), null);
          return;
        }

        callback(new Error(errData.reason), null);
        return;
      }
      var ddocData = JSON.parse(data);
      var ddocs = {};
      for (var i = 0; i < ddocData.rows.length; ++i) {
        var ddoc = ddocData.rows[i].doc;
        var ddocName = ddoc.meta.id.substr(8);
        ddocs[ddocName] = ddoc.json;
      }
      callback(null, ddocs);
    }));
    httpReq.end();
  });
};

/**
 * Registers a design document to this bucket, failing if it already exists.
 *
 * @param name
 * @param data
 * @param callback
 *
 * @since 2.0.0
 * @committed
 */
BucketManager.prototype.insertDesignDocument = function(name, data, callback) {
  var self = this;
  this.getDesignDocument(name, function(err, res) {
    if (!err) {
      return callback(new Error('design document already exists'), null);
    }
    self.upsertDesignDocument(name, data, callback);
  });
};

/**
 * Registers a design document to this bucket, overwriting any existing
 * design document that was previously registered.
 *
 * @param name
 * @param data
 * @param callback
 *
 * @since 2.0.0
 * @committed
 */
BucketManager.prototype.upsertDesignDocument = function(name, data, callback) {
  var path = '_design/' + name;

  this._capiRequest(path, 'PUT', function(err, httpReq) {
    if (err) {
      return callback(err, null);
    }

    httpReq.on('error', callback);
    httpReq.on('response', _respRead(function(err, resp, data) {
      if (err) {
        return callback(err);
      }
      if (resp.statusCode !== 201) {
        var errData = null;
        try {
          errData = JSON.parse(data);
        } catch(e) {
        }

        if (!errData) {
          callback(new Error(
              'operation failed (' + resp.statusCode +')'), null);
          return;
        }

        callback(new Error(errData.reason), null);
        return;
      }
      callback(null, true);
    }));
    httpReq.write(JSON.stringify(data, function(key, value) {
      if (value instanceof Function) {
        return value.toString();
      }
      return value;
    }));
    httpReq.end();
  });
};

/**
 * Retrieves a specific design document from this bucket.
 *
 * @param name
 * @param callback
 *
 * @since 2.0.0
 * @committed
 */
BucketManager.prototype.getDesignDocument = function(name, callback) {
  var path = '_design/' + name;

  this._capiRequest(path, 'GET', function(err, httpReq) {
    if (err) {
      return callback(err, null);
    }

    httpReq.on('error', callback);
    httpReq.on('response', _respRead(function(err, resp, data) {
      if (err) {
        return callback(err);
      }
      var ddocData = JSON.parse(data);
      if (resp.statusCode !== 200) {
        var errData = null;
        try {
          errData = JSON.parse(data);
        } catch(e) {
        }

        if (!errData) {
          callback(new Error(
              'operation failed (' + resp.statusCode +')'), null);
          return;
        }

        callback(new Error(errData.reason), null);
        return;
      }
      callback(null, ddocData);
    }));
    httpReq.end();
  });
};

/**
 * Unregisters a design document from this bucket.
 *
 * @param name
 * @param callback
 *
 * @since 2.0.0
 * @committed
 */
BucketManager.prototype.removeDesignDocument = function(name, callback) {
  var path = '_design/' + name;

  this._capiRequest(path, 'DELETE', function(err, httpReq) {
    if (err) {
      return callback(err, null);
    }

    httpReq.on('error', callback);
    httpReq.on('response', _respRead(function(err, resp, data) {
      if (err) {
        return callback(err);
      }
      if (resp.statusCode !== 200) {
        var errData = null;
        try {
          errData = JSON.parse(data);
        } catch(e) {
        }

        if (!errData) {
          callback(new Error(
              'operation failed (' + resp.statusCode +')'), null);
          return;
        }

        callback(new Error(errData.reason), null);
        return;
      }
      callback(null, true);
    }));
    httpReq.end();
  });
};

/**
 * Flushes the cluster, deleting all data stored within this bucket.  Note that
 * this method requires the Flush permission to be enabled on the bucket from
 * the management console before it will work.
 *
 * @param callback
 *
 * @since 2.0.0
 * @committed
 */
BucketManager.prototype.flush = function(callback) {
  var path = 'pools/default/buckets/' +
      this._bucket._name + '/controller/doFlush';

  this._mgmtRequest(path, 'POST', function(err, httpReq) {
    if (err) {
      return callback(err, null);
    }

    httpReq.on('error', callback);
    httpReq.on('response', _respRead(function(err, resp, data) {
      if (err) {
        return callback(err);
      }
      if (resp.statusCode !== 200) {
        var errData = null;
        try {
          errData = JSON.parse(data);
        } catch(e) {
        }

        if (!errData) {
          callback(new Error(
              'operation failed (' + resp.statusCode +')'), null);
          return;
        }

        callback(new Error(errData.reason), null);
        return;
      }
      callback(null, true);
    }));
    httpReq.end();
  });
};

/**
 * Method for creating GSI indexes
 *
 * @param options
 * @param options.name
 * @param options.fields
 * @param options.deferred
 * @param callback
 *
 * @private
 * @ignore
 */
BucketManager.prototype._createIndex = function(options, callback) {
  if (!options.fields) {
    options.fields = [];
  }

  var qs = '';

  if (options.fields.length === 0) {
    qs += 'CREATE PRIMARY INDEX';
  } else {
    qs += 'CREATE INDEX';
  }
  if (options.name !== '') {
    qs += ' `' + options.name + '`';
  }
  qs += ' ON `' + this._bucket._name + '`';
  if (options.fields.length > 0) {
    qs += '(';
    for (var i = 0; i < options.fields.length; ++i) {
      if (i > 0) {
        qs += ', ';
      }
      qs += '`' + options.fields[i] + '`';
    }
    qs += ')';
  }
  if (options.deferred) {
    qs += ' WITH {"defer_build": true}';
  }

  this._bucket.query(N1qlQuery.fromString(qs), function(err, rows) {
    if (err) {
      if (err.message.indexOf('already exist') !== -1 &&
          options.ignoreIfExists) {
        callback(null);
        return;
      }

      callback(err);
      return;
    }

    callback(null);
  });
};

/**
 * Creates a non-primary GSI index from a name and list of fields.
 *
 * @param indexName
 * @param fields
 * @param options
 * @param options.ignoreIfExists
 * @param options.deferred
 * @param callback
 *
 * @since 2.1.6
 * @committed
 */
BucketManager.prototype.createIndex =
    function(indexName, fields, options, callback) {
  if (options instanceof Function) {
    callback = arguments[2];
    options = undefined;
  }
  if (!options) {
    options = {};
  }

  return this._createIndex({
    name: indexName,
    fields: fields,
    ignoreIfExists: options.ignoreIfExists,
    deferred: options.deferred
  }, callback);
};

/**
 * Creates a primary GSI index with an optional name
 * @param options
 * @param options.ignoreIfExists
 * @param options.deferred
 * @param callback
 *
 * @since 2.1.6
 * @committed
 */
BucketManager.prototype.createPrimaryIndex = function(options, callback) {
  if (options instanceof Function) {
    callback = arguments[0];
    options = undefined;
  }
  if (!options) {
    options = {};
  }

  return this._createIndex({
    name: options.name,
    ignoreIfExists: options.ignoreIfExists,
    deferred: options.deferred
  }, callback);
};

/**
 * Method for dropping GSI indexes
 *
 * @param options
 * @param options.name
 * @param callback
 *
 * @private
 * @ignore
 */
BucketManager.prototype._dropIndex = function(options, callback) {
  var qs = '';

  if (!options.name) {
    qs += 'DROP PRIMARY INDEX `' + this._bucket._name + '`';
  } else {
    qs += 'DROP INDEX `' + this._bucket._name + '`.`' + options.name + '`';
  }

  this._bucket.query(N1qlQuery.fromString(qs), function(err) {
    if (err) {
      if (err.message.indexOf('not found') !== -1 &&
          options.ignoreIfNotExists) {
        callback(null);
        return;
      }

      callback(err);
      return;
    }

    callback(null);
  });
};

/**
 * Drops a specific GSI index by name.
 *
 * @param indexName
 * @param options
 * @param options.ignoreIfNotExists
 * @param callback
 *
 * @since 2.1.6
 * @committed
 */
BucketManager.prototype.dropIndex = function(indexName, options, callback) {
  if (options instanceof Function) {
    callback = arguments[1];
    options = undefined;
  }
  if (!options) {
    options = {};
  }

  return this._dropIndex({
    name: indexName,
    ignoreIfNotExists: options.ignoreIfNotExists
  }, callback);
};

/**
 * Drops a primary GSI index
 *
 * @param options
 * @param options.ignoreIfNotExists
 * @param callback
 *
 * @since 2.1.6
 * @committed
 */
BucketManager.prototype.dropPrimaryIndex = function(options, callback) {
  if (options instanceof Function) {
    callback = arguments[1];
    options = undefined;
  }
  if (!options) {
    options = {};
  }

  return this._dropIndex({
    name: options.name,
    ignoreIfNotExists: options.ignoreIfNotExists
  }, callback);
};

/**
 * Retreives a list of the indexes currently configured on the cluster.
 *
 * @param callback
 *
 * @since 2.1.6
 * @committed
 */
BucketManager.prototype.getIndexes = function(callback) {
  var qs = 'SELECT idx.* FROM system:indexes AS idx';
  qs += ' WHERE keyspace_id="' + this._bucket._name + '"';
  qs += ' AND `using`="gsi" ORDER BY is_primary DESC, name ASC;';
  this._bucket.query(N1qlQuery.fromString(qs), function(err, rows) {
    if (err) {
      callback(err, null);
      return;
    }

    callback(null, rows);
  });
};

/**
 * Builds any indexes that were previously created with the deferred attribute.
 *
 * @param callback
 *
 * @since 2.1.6
 * @committed
 */
BucketManager.prototype.buildDeferredIndexes = function(callback) {
  var self = this;
  this.getIndexes(function(err, indexes) {
    if (err) {
      callback(err, null);
      return;
    }

    var deferredList = [];
    for (var i = 0; i < indexes.length; ++i) {
      if (indexes[i].state === 'deferred' || indexes[i].state === 'pending') {
        deferredList.push(indexes[i].name);
      }
    }

    if (deferredList.length === 0) {
      callback(null, deferredList);
      return;
    }

    var qs = '';
    qs += 'BUILD INDEX ON `' + self._bucket._name + '` (';
    for (var j = 0; j < deferredList.length; ++j) {
      if (j > 0) {
        qs += ', ';
      }
      qs += '`' + deferredList[j] + '`';
    }
    qs += ')';

    self._bucket.query(N1qlQuery.fromString(qs), function(err) {
      if (err) {
        callback(err, deferredList);
        return;
      }

      callback(null, deferredList);
    });
  });
};

/**
 * Method for checking a list of indexes to see if they are active
 *
 * @param checkList
 * @param callback
 *
 * @private
 * @ignore
 */
BucketManager.prototype._checkIndexesActive = function(checkList, callback) {
  this.getIndexes(function(err, indexes) {
    if (err) {
      callback(err, false);
      return;
    }

    var checkIndexes = [];
    for (var i = 0; i < indexes.length; i++) {
      if (checkList.indexOf(indexes[i].name) !== -1) {
        checkIndexes.push(indexes[i]);
      }
    }

    if (checkIndexes.length !== checkList.length) {
      callback(new Error('index not found'), false);
      return;
    }

    for (var j = 0; j < checkIndexes.length; ++j) {
      if (checkIndexes[j].state !== 'online') {
        callback(null, false);
        return;
      }
    }

    callback(null, true);
  });
};

/**
 * Watches a list of indexes; waiting for them to become available for use.
 *
 * @param watchList
 * @param options 
 * @param options.timeout Timeout in millseconds
 * @param callback
 *
 * @since 2.1.6
 * @committed
 */
BucketManager.prototype.watchIndexes = function(watchList, options, callback) {
  if (options instanceof Function) {
    callback = arguments[1];
    options = undefined;
  }
  if (!options) {
    options = {};
  }

  var timeoutTime = 0;
  if (options.timeout) {
    timeoutTime = Date.now() + options.timeout;
  }

  var self = this;
  var curInterval = 50;
  (function _checkIndexes() {
    self._checkIndexesActive(watchList, function(err, allActive) {
      if (err) {
        callback(err);
        return;
      }

      if (allActive) {
        callback(null);
        return;
      }

      if (timeoutTime > 0 && Date.now() + curInterval > timeoutTime) {
        callback(new Error('timeout'));
        return;
      }

      setTimeout(function() {
        curInterval += 500;
        if (curInterval > 1000) {
          curInterval = 1000;
        }

        _checkIndexes();
      }, curInterval);
    });
  })();
};

module.exports = BucketManager;
