'use strict';

function MockClusterManagement(cluster, username, password) {
  this._cluster = cluster;
  this._username = username;
  this._password = password;
}

MockClusterManagement.prototype.listBuckets = function(callback) {
  // TODO: Implement this
  process.nextTick(function() {
    callback(null, []);
  });
};

module.exports = MockClusterManagement;
