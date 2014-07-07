'use strict';

var assert = require('assert');
var harness = require('./harness.js');

describe('#cluster', function() {
  function allTests(H) {
    describe('openBucket', function () {
      it('should invoke the callback', function (done) {
        var cluster = new H.lib.Cluster(H.connstr);
        cluster.openBucket(H.bucket, function (err) {
          assert(!err);
          done();
        });
      });

      it('should invoke the callback for failure', function (done) {
        this.timeout(10000);
        var cluster = new H.lib.Cluster(H.connstr);
        cluster.openBucket('invalid_bucket', function (err) {
          assert(err);
          done();
        });
      });
    });
  }

  describe('#RealBucket', allTests.bind(this, harness));
  describe('#MockBucket', allTests.bind(this, harness.mock));
});
