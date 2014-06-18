'use strict';

var cbdsn = require('./dsn');

var Bucket = require('./bucket');
var ClusterManagement = require('./clustermgr');

/**
 * Represents a singular cluster containing many buckets.
 *
 * @param {string} [dsn] A DSN for the cluster.
 * @param {string} [username] The username for managing the cluster.
 * @param {string} [password] The password for managing the cluster.
 *
 * @constructor
 */
function Cluster(dsn, username, password) {
  this.dsnObj = cbdsn.parse(dsn);
  this.username = username;
  this.password = password;
}

/**
 * Open a bucket to perform operations.  This will begin the handshake
 * process immediately and operations will complete later.  Subscribe to
 * the `connect` event to be alerted when the connection is ready, though
 * be aware operations can be successfully queued before this.
 *
 * @param {string} [name] The name of the bucket to open.
 * @param {string} [password] Password for the bucket.
 * @returns {Bucket}
 */
Cluster.prototype.openBucket = function(name, password) {
  var bucketDsnObj = cbdsn.normalize(this.dsnObj);
  bucketDsnObj.bucket = name;

  return new Bucket({
    dsnObj: bucketDsnObj,
    username: name,
    password: password
  });
};

/**
 * Creates a manager allowing the management of a Couchbase cluster.
 *
 * @returns {ClusterManagement}
 */
Cluster.prototype.manager = function() {
  if (!this._manager) {
    this._manager = new ClusterManagement(this);
  }
  return this._manager;
};

module.exports = Cluster;
