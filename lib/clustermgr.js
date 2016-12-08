'use strict';

var http = require('http');
var qs = require('querystring');

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
 * Class for performing management operations against a cluster.
 *
 * @param cluster
 * @param username
 * @param password
 *
 * @private
 *
 * @since 2.0.0
 * @committed
 */
function ClusterManager(cluster, username, password) {
  this._cluster = cluster;
  this._username = username;
  this._password = password;
}

/**
 * @param path
 * @param method
 * @param uses_qs
 * @returns {http.ClientRequest}
 *
 * @private
 * @ignore
 */
ClusterManager.prototype._mgmtRequest = function(path, method, uses_qs) {
  var clusterHosts = this._cluster.dsnObj.hosts;
  var myHost = clusterHosts[Math.floor(Math.random()*clusterHosts.length)];
  var reqOpts = {
    hostname: myHost[0],
    port: myHost[1] ? myHost[1] : 8091,
    path: '/' + path,
    method: method,
    headers: {
      'Content-Type': (uses_qs ? 'application/x-www-form-urlencoded' :
        'application/json' )
    }
  };
  if (this._password) {
    reqOpts.auth = this._username + ':' + this._password;
  }
  return http.request(reqOpts);
};

/**
 * @param callback
 *
 * @since 2.0.0
 * @committed
 */
ClusterManager.prototype.listBuckets = function(callback) {
  var path = 'pools/default/buckets';

  var httpReq = this._mgmtRequest(path, 'GET');
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

    var bucketInfo = JSON.parse(data);
    callback(null, bucketInfo);
  }));
  httpReq.end();
};

/**
 * @param name
 * @param opts
 * @param callback
 *
 * @since 2.0.0
 * @committed
 */
ClusterManager.prototype.createBucket = function(name, opts, callback) {
  var myOpts = {
    name: name,
    authType: 'sasl',
    bucketType: 'couchbase',
    ramQuotaMB: 100,
    replicaNumber: 1
  };
  for (var i in opts) {
    if (opts.hasOwnProperty(i)) {
      myOpts[i] = opts[i];
    }
  }

  var path = 'pools/default/buckets';

  var httpReq = this._mgmtRequest(path, 'POST', true);
  httpReq.on('response', _respRead(function (err, resp, data) {
    if (err) {
      return callback(err);
    }
    if (resp.statusCode !== 202) {
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

      var errMessage = null;
      if (errData._) {
        // return errData._
        errMessage = errData._;
      } else if (errData.errors) {
        // join values (messages) of all properties in errData.errors object
        errMessage = Object.keys(errData.errors).map(function(errKey) {
          return errData.errors[errKey];
        }).join(' ');
      } else if (errData !== null && typeof errData === 'object') {
        // join values (messages) of all properties in errData object
        errMessage = Object.keys(errData).map(function(errKey) {
          return errData[errKey];
        }).join(' ');
      }
      var errObj = new Error(errMessage);
      // add full response and status code to the error
      errObj.response = errData;
      errObj.statusCode = resp.statusCode;
      callback(errObj, null);
      return;
    }

    callback(null, true);
  }));
  httpReq.write(qs.stringify(myOpts));
  httpReq.end();
};

/**
 * @param name
 * @param callback
 *
 * @since 2.0.0
 * @committed
 */
ClusterManager.prototype.removeBucket = function(name, callback) {
  var path = 'pools/default/buckets/' + name;

  var httpReq = this._mgmtRequest(path, 'DELETE');
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

      var errMessage = null;
      if (errData._) {
        // return errData._
        errMessage = errData._;
      } else if (errData.errors) {
        // join values (messages) of all properties in errData.errors object
        errMessage = Object.keys(errData.errors).map(function(errKey) {
          return errData.errors[errKey];
        }).join(' ');
      } else if (errData !== null && typeof errData === 'object') {
        // join values (messages) of all properties in errData object
        errMessage = Object.keys(errData).map(function(errKey) {
          return errData[errKey];
        }).join(' ');
      }
      var errObj = new Error(errMessage);
      // add full response and status code to the error
      errObj.response = errData;
      errObj.statusCode = resp.statusCode;
      callback(errObj, null);
      return;
    }

    callback(null, true);
  }));
  httpReq.end();
};

module.exports = ClusterManager;
