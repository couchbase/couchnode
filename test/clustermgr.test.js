'use strict';

var assert = require('assert');
var harness = require('./harness.js');

describe('#cluster management', function() {
  function allTests(H) {
    it('should be able to access a cluster manager', function () {
      var cluster = new H.lib.Cluster(H.connstr);
      var clusterMgr = cluster.manager(H.muser, H.mpass);
      assert(clusterMgr);
    });

    it('should be able to list buckets', function () {
      var cluster = new H.lib.Cluster(H.connstr);
      var clusterMgr = cluster.manager(H.muser, H.mpass);
      clusterMgr.listBuckets(function (err, list) {
        assert(!err);
        assert(list);
      });
    });
  }
  describe('#RealBucket', function() {
    allTests.bind(this, harness);

    it('should not be able to list buckets with wrong password', function (done) {
      var cluster = new harness.lib.Cluster(harness.connstr);
      var clusterMgr = cluster.manager(harness.muser, 'junk');
      clusterMgr.listBuckets(function (err, list) {
        assert(err);
        assert.equal(err.message, 'operation failed (401)');
        assert(!list);
        done();
      });
    });
  });
  describe('#MockBucket', allTests.bind(this, harness.mock));
});
