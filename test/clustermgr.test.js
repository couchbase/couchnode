'use strict';

var assert = require('assert');
var harness = require('./harness.js');

describe('#cluster management', function() {
  function allTests(H) {
    it('should be able to access a cluster manager', function() {
      var clusterMgr = H.c.manager(H.muser, H.mpass);
      assert(clusterMgr);
    });

    it('should be able to list buckets', function() {
      var clusterMgr = H.c.manager(H.muser, H.mpass);
      clusterMgr.listBuckets(function(err, list) {
        assert(!err);
        assert(list);
      });
    });
  }

  describe('#RealBucket', function() {
    allTests.call(this, harness);

    /* DISABLED: There is a bug in CouchbaseMock which stops this from working.
    var H = harness;

    it('should not be able to list buckets with wrong password',
      function(done) {
        var cluster = new H.lib.Cluster(H.connstr);
        cluster.authenticate(H.user, 'junk');
        var clusterMgr = cluster.manager(H.muser, 'junk');
        clusterMgr.listBuckets(function(err, list) {
          assert(err);
          done();
        });
      });
      */
  });

  describe('#MockBucket', function() {
    allTests.call(this, harness.mock);
  });
});
