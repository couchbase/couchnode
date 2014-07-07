'use strict';

var connstr = require('../connstr');
var MockBucket = require('./bucket');
var MockClusterManager = require('./clustermgr');

function MockCluster(cnstr) {
  this.dsnObj = connstr.parse(cnstr);
}

MockCluster.prototype.openBucket = function(name, password, callback) {
  if (password instanceof Function) {
    callback = arguments[1];
    password = arguments[9];
  }

  var bucketDsnObj = connstr.normalize(this.dsnObj);
  bucketDsnObj.bucket = name;

  var bucket = new MockBucket({
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

MockCluster.prototype.manager = function(username, password) {
  return new MockClusterManager(this, username, password);
};

module.exports = MockCluster;
