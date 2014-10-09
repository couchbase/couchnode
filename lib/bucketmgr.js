'use strict';

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
 * A class for performing management operations against a bucket.
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

BucketManager.prototype._mgmtRequest = function(path, method, callback) {
  var b = this._bucket;
  b._maybeInvoke(b._mgmtRequest.bind(b), [path, method, callback]);
};

BucketManager.prototype._capiRequest = function(path, method, callback) {
  var b = this._bucket;
  b._maybeInvoke(b._capiRequest.bind(b), [path, method, callback]);
};

/**
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

    httpReq.on('response', _respRead(function (err, resp, data) {
      if (err) {
        return callback(err);
      }
      if (resp.statusCode !== 200) {
        var errData = JSON.parse(data);
        return callback(new Error(errData.reason), null);
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

    httpReq.on('response', _respRead(function(err, resp, data) {
      if (err) {
        return callback(err);
      }
      if (resp.statusCode !== 201) {
        var errData = JSON.parse(data);
        return callback(new Error(errData.reason), null);
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

    httpReq.on('response', _respRead(function(err, resp, data) {
      if (err) {
        return callback(err);
      }
      var ddocData = JSON.parse(data);
      if (resp.statusCode !== 200) {
        var errData = JSON.parse(data);
        return callback(new Error(errData.reason), null);
      }
      callback(null, ddocData);
    }));
    httpReq.end();
  });
};

/**
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

    httpReq.on('response', _respRead(function(err, resp, data) {
      if (err) {
        return callback(err);
      }
      if (resp.statusCode !== 200) {
        var errData = JSON.parse(data);
        return callback(new Error(errData.reason), null);
      }
      callback(null, true);
    }));
    httpReq.end();
  });
};

/**
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

    httpReq.on('response', _respRead(function(err, resp, data) {
      if (err) {
        return callback(err);
      }
      if (resp.statusCode !== 200) {
        var errData = JSON.parse(data);
        return callback(new Error(errData.reason), null);
      }
      callback(null, true);
    }));
    httpReq.end();
  });
};

module.exports = BucketManager;
