'use strict';

var assert = require('assert');
var harness = require('./harness.js');

describe('#cluster management', function() {
  function allTests(H) {
    it('should be able to access a cluster manager', function () {
      var cluster = new H.lib.Cluster(H.connstr);
      var clusterMgr = cluster.manager('Administrator', 'C0uchbase');
      assert(clusterMgr);
    });

    it('should be able to list buckets', function () {
      var cluster = new H.lib.Cluster(H.connstr);
      var clusterMgr = cluster.manager('Administrator', 'C0uchbase');
      clusterMgr.listBuckets(function (err, list) {
        assert(!err);
        assert(list);
      });
    });
  }
  describe('#RealBucket', allTests.bind(this, harness));
  describe('#MockBucket', allTests.bind(this, harness.mock));
});
