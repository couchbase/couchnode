'use strict';

var assert = require('assert');
var harness = require('./harness.js');

describe('#cluster', function() {
  function allTests(H) {
    describe('openBucket', function() {
      it('should invoke the callback', function(done) {
        var newBucket = H.c.openBucket(H.bucket, function(err) {
          assert(!err);

          newBucket.disconnect();
          done();
        });
      });

      it('should invoke the callback for failure', function(done) {
        this.timeout(10000);

        H.c.openBucket('invalid_bucket', function(err) {
          assert(err);
          done();
        });
      });
    });
  }

  describe('#RealBucket', allTests.bind(this, harness));
  describe('#MockBucket', allTests.bind(this, harness.mock));

  var H = harness;

  it('should fail when using password with authenticators', function(done) {
    var cluster = new H.lib.Cluster(H.connstr);
    cluster.authenticate('username', 'password');
    assert.throws(function() {
      cluster.openBucket('bucket', 'password', function() {});
    });
    done();
  });

  it('should fail when using keypath with no cert authenticator', function(done) {
    var cluster = new H.lib.Cluster(
      'couchbase://test?certpath=./cert&keypath=./key'
    );
    cluster.authenticate('username', 'password');
    assert.throws(function() {
      cluster.openBucket('bucket', '', function() {});
    });
    done();
  });
});
