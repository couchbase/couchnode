'use strict';

var util = require('util');
var events = require('events');
var request = require('request');

var connstr = require('./connstr');
var auth = require('./auth');
var constants = require('./constants');

var Bucket = require('./bucket');
var ClusterManager = require('./clustermgr');
var N1qlQuery = require('./n1qlquery');
var SearchQuery = require('./searchquery');
var AnalyticsQuery = require('./analyticsquery');

function _arrayRemove(arr, element) {
  var newArray = [];
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i] !== element) {
      newArray.push(arr[i]);
    }
  }
  return newArray;
}

/**
 * Represents a singular cluster containing your buckets.
 *
 * @param {string} [cnstr] The connection string for your cluster.
 * @param {Object} [options]
 *  @param {string} [options.certpath]
 *  The path to the certificate to use for SSL connections
 * @constructor
 *
 * @since 2.0.0
 * @committed
 */
function Cluster(cnstr, options) {
  this.dsnObj = connstr.parse(cnstr);
  this.auther = null;
  this.connectingBuckets = [];
  this.connectedBuckets = [];
  this.waitQueue = [];

  this.cbasHosts = null;

  // Copy passed options into the connection string
  if (options instanceof Object) {
    for (var i in options) {
      if (options.hasOwnProperty(i)) {
        this.dsnObj.options[i] = encodeURIComponent(options[i]);
      }
    }
  }
}

/**
 * An event emitter allowing you to bind to various query result set
 * events.
 *
 * @constructor
 *
 * @private
 * @memberof Bucket
 * @extends events.EventEmitter
 *
 * @since 2.2.3
 * @uncommitted
 */
function CbasQueryResponse() {}
util.inherits(CbasQueryResponse, events.EventEmitter);
Cluster.CbasQueryResponse = CbasQueryResponse;

/**
 * Invokes an operation and dispatches a callback error if one occurs.
 *
 * @param {Function} fn The operation callback to invoke.
 * @param {Array.<*>} args An array of arguments to pass to the function.
 *
 * @private
 * @ignore
 */
Cluster.prototype._invoke = function(fn, args) {
  try {
    fn.apply(this._cb, args);
  } catch (e) {
    args[args.length - 1](e, null);
  }
};

/**
 * Will either invoke the binding method specified by fn, or alternatively
 * push the operation to a queue which is flushed once a connection
 * has been established or failed.
 *
 * @param {Function} fn The binding method to invoke.
 * @param {Array} args A list of arguments for the method.
 *
 * @private
 * @ignore
 */
Cluster.prototype._maybeInvoke = function(fn, args) {
  if (this.connectedBuckets.length > 0) {
    this._invoke(fn, args);
  } else if (this.connectingBuckets.length === 0) {
    throw new Error(
      'Cannot perform operations without at least one bucket opened.');
  } else {
    this.waitQueue.push([fn, args]);
  }
};

Cluster.prototype.enableCbas = function(hosts) {
  if (!Array.isArray(hosts)) {
    hosts = [hosts];
  }

  this.cbasHosts = hosts;
};

/**
 * Specifies an authenticator to use to authenticate to this cluster.
 *
 * @param {Authenticator|Object} auther
 *
 * @since 2.1.7
 * @uncommitted
 */
Cluster.prototype.authenticate = function(auther) {
  // This implements an overload allowing specification of just a username
  // and password for RBAC based authentication.
  if (arguments.length === 2 &&
    typeof arguments[0] === 'string' && typeof arguments[1] === 'string') {
    this.auther = new auth.PasswordAuthenticator(arguments[0], arguments[1]);
    return;
  }

  this.auther = auther;
};

/**
 * Open a bucket to perform operations.  This will begin the handshake
 * process immediately and operations will complete later.  Subscribe to
 * the `connect` event to be alerted when the connection is ready, though
 * be aware operations can be successfully queued before this.
 *
 * @param {string} [name] The name of the bucket to open.
 * @param {string} [password] Password for the bucket.
 * @param {Function} [callback]
 * Callback to invoke on connection success or failure.
 * @returns {Bucket}
 *
 * @since 2.0.0
 * @committed
 */
Cluster.prototype.openBucket = function(name, password, callback) {
  if (password instanceof Function) {
    callback = arguments[1];
    password = '';
  }

  var username = name;

  if (this.auther && password) {
    throw new Error(
      'You must not specify a bucket password when ' +
      'using cluster-level authentication.');
  }

  var bucketDsnObj = connstr.normalize(this.dsnObj);
  bucketDsnObj.bucket = name;
  if (this.auther instanceof Object && this.auther.buckets instanceof Object) {
    var bucketCreds = [];
    for (var i in this.auther.buckets) {
      if (this.auther.buckets.hasOwnProperty(i)) {
        bucketCreds.push(JSON.stringify([i, this.auther.buckets[i]]));
      }
    }
    if (bucketCreds.length > 0) {
      bucketDsnObj.options.bucket_cred = bucketCreds;
    }
  } else if (this.auther instanceof Object) {
    username = this.auther.username;
    password = this.auther.password;
  }

  if (bucketDsnObj.options.keypath) {
    if (username !== '' || password !== '') {
      throw new Error(
        'You must specify the CertAuthenticator when ' +
        'using certificate authentication.');
    }
  }

  if (bucketDsnObj.options.enable_errmap === undefined) {
    bucketDsnObj.options.enable_errmap = true;
  }
  if (bucketDsnObj.options.enable_tracing === undefined) {
    bucketDsnObj.options.enable_tracing = true;
  }

  // Grab the various versions.  Note that we need to trim them
  // off as some Node.js versions insert strange characters into
  // the version identifiers (mainly newlines and such).
  var couchnodeVer = require('../package.json').version.trim();
  var nodeVer = process.versions.node.trim();
  var v8Ver = process.versions.v8.trim();
  var sslVer = process.versions.openssl.trim();

  // Generate a user-readable version string
  bucketDsnObj.options.client_string =
    'couchnode/' + couchnodeVer +
    ' (node/' + nodeVer + '; v8/' + v8Ver + '; ssl/' + sslVer + ')';
  this.dsnObj = bucketDsnObj;

  var bucket = new Bucket({
    dsnObj: bucketDsnObj,
    username: username,
    password: password
  });
  if (callback) {
    bucket.on('connect', callback);
    bucket.on('error', callback);
  }

  var self = this;
  this.connectingBuckets.push(bucket);
  bucket.on('connect', function() {
    self.connectingBuckets = _arrayRemove(self.connectingBuckets, bucket);
    self.connectedBuckets.push(bucket);
    for (var i = 0; i < self.waitQueue.length; ++i) {
      var itm = self.waitQueue[i];
      self._invoke(itm[0], itm[1]);
    }
    self.waitQueue = [];
  });
  bucket.on('error', function() {
    self.connectingBuckets = _arrayRemove(self.connectingBuckets, bucket);
    if (self.connectingBuckets.length > 0) {
      return;
    }

    var err = new Error(
      'You cannot perform a cluster-level query without' +
      ' at least one bucket open.');
    for (var i = 0; i < self.waitQueue.length; ++i) {
      var itm = self.waitQueue[i];
      itm[1][itm[1].length - 1](err, null);
    }
    self.waitQueue = [];
  });

  return bucket;
};

Cluster.prototype._n1qlReq = function(host, q, adhoc, emitter) {
  var bucket = this.connectedBuckets[0];
  bucket._n1qlReq(host, q, adhoc, emitter);
};

Cluster.prototype._n1ql = function(query, params, callback) {
  var req = new Bucket.N1qlQueryResponse();

  var invokeCb = callback;
  if (!invokeCb) {
    invokeCb = function(err) {
      req.emit('error', err);
    };
  }

  this._maybeInvoke(this._n1qlReq.bind(this), [undefined, query.toObject(
    params), query.isAdhoc, req, invokeCb]);

  if (callback) {
    req.on('rows', function(rows, meta) {
      callback(null, rows, meta);
    });
    req.on('error', function(err) {
      callback(err, null, null);
    });
  }

  return req;
};

Cluster.prototype._ftsReq = function(q, emitter) {
  var bucket = this.connectedBuckets[0];
  bucket._ftsReq(q, emitter);
};

Cluster.prototype._fts = function(query, callback) {
  var req = new Bucket.FtsQueryResponse();

  var invokeCb = callback;
  if (!invokeCb) {
    invokeCb = function(err) {
      req.emit('error', err);
    };
  }

  this._maybeInvoke(this._ftsReq.bind(this), [query, req, invokeCb]);

  if (callback) {
    req.on('rows', function(rows, meta) {
      callback(null, rows, meta);
    });
    req.on('error', function(err) {
      callback(err, null, null);
    });
  }

  return req;
};

Cluster.prototype._cbasReq = function(host, q, emitter) {
  var bucket = this.connectedBuckets[0];
  bucket._cbasReq(host, q, emitter);
};

Cluster.prototype._cbas = function(query, params, callback) {
  var host;
  if (this.cbasHosts) {
    var qhosts = this.cbasHosts;
    host = qhosts[Math.floor(Math.random() * qhosts.length)];
    if (host.indexOf(':') === -1) {
      host = host + ':8095';
    }
  }

  var req = new Bucket.AnalyticsQueryResponse();

  var invokeCb = callback;
  if (!invokeCb) {
    invokeCb = function(err) {
      req.emit('error', err);
    };
  }

  this._maybeInvoke(this._cbasReq.bind(this), [
    host, query.toObject(params), req, invokeCb
  ]);

  if (callback) {
    req.on('rows', function(rows, meta) {
      callback(null, rows, meta);
    });
    req.on('error', function(err) {
      callback(err, null, null);
    });
  }

  return req;
};

/**
 * Executes a previously prepared query object.  This could be a
 * {@link N1qlQuery}, {@link SearchQuery} or a {@link AnalyticsQuery}.
 *
 * Note: You must have at least one bucket open (this is neccessary to
 * have cluster mapping information), and additionally be using the new
 * cluster-level authentication methods.
 *
 * Note: SearchQuery queries are currently an uncommitted interface and may be
 * subject to change in a future release.
 *
 * @param {N1qlQuery|SearchQuery|AnalyticsQuery} query
 * The query to execute.
 * @param {Object|Array} [params]
 * A list or map to do replacements on a N1QL or CBAS query.
 * @param {Bucket.QueryCallback} callback
 * @returns {Bucket.N1qlQueryResponse
 *    |Bucket.FtsQueryResponse
 *    |Cluster.AnalyticsQueryResponse}
 *
 * @since 2.1.7
 * @committed
 */
Cluster.prototype.query = function(query, params, callback) {
  if (params instanceof Function) {
    callback = arguments[1];
    params = undefined;
  }

  if (!(this.auther instanceof Object)) {
    var errC = new Error('You cannot perform a cluster-level query without' +
      ' specifying credentials with Cluster.authenticate.');
    setImmediate(function() {
      if (callback) {
        callback(errC);
      }
    });
    return;
  }

  if (this.connectedBuckets.length === 0 &&
    this.connectingBuckets.length === 0) {
    var errB = new Error('You cannot perform a cluster-level query without' +
      ' at least one bucket open.');
    setImmediate(function() {
      if (callback) {
        callback(errB);
      }
    });
    return;
  }

  if (query instanceof N1qlQuery) {
    return this._n1ql(
      query, params, callback
    );
  } else if (query instanceof SearchQuery) {
    return this._fts(
      query, callback
    );
  } else if (query instanceof AnalyticsQuery) {
    return this._cbas(
      query, params, callback
    );
  } else {
    throw new TypeError(
      'First argument needs to be a N1qlQuery.');
  }
};

Cluster.prototype._ftsHttpReq = function(method, username, password, path,
  contentType, body, callback) {
  var bucket = this.connectedBuckets[0];
  return bucket._http(
    constants.ServiceType.Search,
    method,
    username,
    password,
    path,
    contentType,
    body,
    callback);
};

Cluster.prototype._ftsHttp = function(method, username, password, path,
  contentType, body, callback) {
  if (username === undefined && this.auther instanceof Object) {
    username = this.auther.username;
  }
  if (password === undefined && this.auther instanceof Object) {
    password = this.auther.password;
  }

  if (this.connectedBuckets.length === 0 &&
    this.connectingBuckets.length === 0) {
    var errB = new Error('You cannot perform a cluster-level request without' +
      ' at least one bucket open.');
    setImmediate(function() {
      if (callback) {
        callback(errB);
      }
    });
    return;
  }

  this._maybeInvoke(this._ftsHttpReq.bind(this), [method, username, password,
    path, contentType, body, callback
  ]);
};

/**
 * Creates a manager allowing the management of a Couchbase cluster.
 *
 * @returns {ClusterManager}
 *
 * @since 2.0.0
 * @committed
 */
Cluster.prototype.manager = function(username, password) {
  if (username === undefined && this.auther instanceof Object) {
    username = this.auther.username;
  }
  if (password === undefined && this.auther instanceof Object) {
    password = this.auther.password;
  }
  return new ClusterManager(this, username, password);
};

module.exports = Cluster;
