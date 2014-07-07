'use strict';

var connstr = require('./connstr');

var Bucket = require('./bucket');
var ClusterManager = require('./clustermgr');

/**
 * Represents a singular cluster containing your buckets.
 *
 * @param {string} [cnstr] The connection string for your cluster.
 *
 * @constructor
 *
 * @since 2.0.0
 * @committed
 */
function Cluster(cnstr) {
  this.dsnObj = connstr.parse(cnstr);
}

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
    password = arguments[9];
  }

  var bucketDsnObj = connstr.normalize(this.dsnObj);
  bucketDsnObj.bucket = name;
  this.dsnObj = bucketDsnObj;

  var bucket = new Bucket({
    dsnObj: bucketDsnObj,
    username: name,
    password: password
  });
  if (callback) {
    bucket.on('connect', callback);
    bucket.on('error', callback);
  }
  return bucket;
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
  return new ClusterManager(this, username, password);
};

module.exports = Cluster;
