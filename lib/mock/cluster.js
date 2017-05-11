'use strict';

var connstr = require('../connstr');
var MockBucket = require('./bucket');
var MockClusterManager = require('./clustermgr');


function _arrayRemove(arr, element) {
  var newArray = [];
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i] !== element) {
      newArray.push(arr[i]);
    }
  }
  return newArray;
}


function MockCluster(cnstr, options) {
  this.dsnObj = connstr.parse(cnstr);
  this.auther = null;
  this.connectingBuckets = [];
  this.connectedBuckets = [];
  this.waitQueue = [];

  // Copy passed options into the connection string
  if (options instanceof Object) {
    for (var i in options) {
      if (options.hasOwnProperty(i)) {
        this.dsnObj.options[i] = encodeURIComponent(options[i]);
      }
    }
  }
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


  var self = this;
  this.connectingBuckets.push(bucket);
  bucket.on('connect', function() {
    self.connectingBuckets = _arrayRemove(self.connectingBuckets, bucket);
    self.connectedBuckets.push(bucket);
  });
  bucket.on('error', function() {
    self.connectingBuckets = _arrayRemove(self.connectingBuckets, bucket);
  });
  return bucket;
};

MockCluster.prototype.manager = function(username, password) {
  return new MockClusterManager(this, username, password);
};

module.exports = MockCluster;
