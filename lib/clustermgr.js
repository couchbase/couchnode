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

function _respParseError(resp, data) {
  if (resp.statusCode < 200 || resp.statusCode >= 300) {
    var errData = null;
    try {
      errData = JSON.parse(data);
    } catch(e) {
    }

    if (!errData) {
      var dataStr = '';
      if (data) {
        dataStr = ', ' + data;
      }
      return new Error(
          'operation failed (' + resp.statusCode + dataStr + ')');
    }

    if (typeof errData === 'string') {
      var strDataStr = '';
      if (data) {
        strDataStr = ', ' + errData;
      }
      return new Error(
          'operation failed (' + resp.statusCode + strDataStr + ')');
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
    return errObj;
  }

  return null;
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
 * Retrieves a list of buckets present on this cluster.
 *
 * @param callback
 *
 * @since 2.0.0
 * @committed
 */
ClusterManager.prototype.listBuckets = function(callback) {
  var path = 'pools/default/buckets';

  var httpReq = this._mgmtRequest(path, 'GET');
  httpReq.on('error', callback);
  httpReq.on('response', _respRead(function(err, resp, data) {
    if (err) {
      callback(err);
      return;
    }

    err = _respParseError(resp, data);
    if (err) {
      callback(err);
      return;
    }

    var bucketInfo;
    try {
      bucketInfo = JSON.parse(data);
    } catch (e) {
      err = e;
    }

    if (err) {
      callback(err);
      return;
    }

    callback(null, bucketInfo);
  }));
  httpReq.end();
};

/**
 * Creates a new bucket on this cluster.  Note that the callback is invoked
 * after the bucket is created, but it may not be immediately accessible due
 * to server spin-up time.
 *
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
  httpReq.on('error', callback);
  httpReq.on('response', _respRead(function (err, resp, data) {
    if (err) {
      callback(err);
      return;
    }

    err = _respParseError(resp, data);
    if (err) {
      callback(err);
      return;
    }

    callback(null, true);
  }));
  httpReq.write(qs.stringify(myOpts));
  httpReq.end();
};

/**
 * Removes a bucket from the cluster.
 *
 * @param name
 * @param callback
 *
 * @since 2.0.0
 * @committed
 */
ClusterManager.prototype.removeBucket = function(name, callback) {
  var path = 'pools/default/buckets/' + name;

  var httpReq = this._mgmtRequest(path, 'DELETE');
  httpReq.on('error', callback);
  httpReq.on('response', _respRead(function(err, resp, data) {
    if (err) {
      callback(err);
      return;
    }

    err = _respParseError(resp, data);
    if (err) {
      callback(err);
      return;
    }

    callback(null, true);
  }));
  httpReq.end();
};

/**
 * Upserts a new RBAC user to the cluster.
 *
 * @param domain
 * @param userid
 * @param settings
 * @param callback
 *
 * @since 2.3.5
 * @committed
 */
ClusterManager.prototype.upsertUser =
    function(domain, userid, settings, callback) {
  var httpReq =
      this._mgmtRequest('/settings/rbac/users/' + domain + '/' + userid, 'PUT');
  httpReq.on('error', callback);
  httpReq.on('response', _respRead(function(err, resp, data) {
    if (err) {
      callback(err);
      return;
    }

    err = _respParseError(resp, data);
    if (err) {
      callback(err);
      return;
    }

    callback(null, true);
  }));
  var qsroles = [];
  for (var i = 0; i < settings.roles.length; ++i) {
    var role = settings.roles[i];
    qsroles.push(role.role + '[' + role.bucket_name + ']');
  }
  var qssettings = {
    name: settings.name,
    password: settings.password,
    roles: qsroles.join(',')
  };
  httpReq.setHeader('Content-Type', 'application/x-www-form-urlencoded');
  httpReq.write(qs.stringify(qssettings));
  httpReq.end();
};

/**
 * Removes an RBAC built-in user from the cluster.
 *
 * @param domain
 * @param userid
 * @param callback
 *
 * @since 2.3.5
 * @committed
 */
ClusterManager.prototype.removeUser = function(domain, userid, callback) {
  var httpReq = this._mgmtRequest(
      '/settings/rbac/users/' + domain + '/' + userid, 'DELETE');
  httpReq.on('error', callback);
  httpReq.on('response', _respRead(function(err, resp, data) {
    if (err) {
      callback(err);
      return;
    }

    err = _respParseError(resp, data);
    if (err) {
      callback(err);
      return;
    }

    callback(null, true);
  }));
  httpReq.end();
};

/**
 * Retrieves a list of RBAC built-in users on this cluster.
 *
 * @param domain
 * @param callback
 *
 * @since 2.3.5
 * @committed
 */
ClusterManager.prototype.getUsers = function(domain, callback) {
  var httpReq = this._mgmtRequest('/settings/rbac/users/' + domain, 'GET');
  httpReq.on('error', callback);
  httpReq.on('response', _respRead(function(err, resp, data) {
    if (err) {
      callback(err);
      return;
    }

    err = _respParseError(resp, data);
    if (err) {
      callback(err);
      return;
    }

    var users;
    try {
      users = JSON.parse(data);
    } catch (e) {
      err = e;
    }

    if (err) {
      callback(err, null);
      return;
    }

    callback(null, users);
  }));
  httpReq.end();
};

/**
 * Retrieves a specific RBAC built-in user.
 *
 * @param domain
 * @param userid
 * @param callback
 *
 * @since 2.3.5
 * @committed
 */
ClusterManager.prototype.getUser = function(domain, userid, callback) {
  var httpReq = this._mgmtRequest(
      '/settings/rbac/users/' + domain + '/' + userid, 'GET');
  httpReq.on('error', callback);
  httpReq.on('response', _respRead(function(err, resp, data) {
    if (err) {
      callback(err);
      return;
    }

    err = _respParseError(resp, data);
    if (err) {
      callback(err);
      return;
    }

    var users;
    try {
      users = JSON.parse(data);
    } catch (e) {
      err = e;
    }

    if (err) {
      callback(err, null);
      return;
    }

    callback(null, users);
  }));
  httpReq.end();
};

module.exports = ClusterManager;
