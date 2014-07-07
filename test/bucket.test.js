'use strict';

var assert = require('assert');
var harness = require('./harness.js');

describe('#Bucket', function() {
  function allTests(H) {
    it('should queue operations until connected', function (done) {
      var cluster = new H.lib.Cluster(H.connstr);
      var bucket = cluster.openBucket(H.bucket);
      bucket.insert(H.key(), 'bar', H.okCallback(function () {
        done();
      }));
    });

    it('should cancel queued options on connection failure', function (done) {
      var cluster = new H.lib.Cluster(H.connstr);
      var bucket = cluster.openBucket('invalid_bucket');
      bucket.insert(H.key(), 'bar', function (err) {
        assert(err);
        done();
      });
    });

    it('should throw exception for operations on a dead bucket', function (done) {
      var cluster = new H.lib.Cluster(H.connstr);
      var bucket = cluster.openBucket('invalid_bucket', function () {
        assert.throws(function () {
          bucket.insert(H.key(), 'bar', H.noCallback());
        }, Error);
        done();
      });
    });

    it('should throw exception for operations on a disconnected bucket',
      function (done) {
        var cluster = new H.lib.Cluster(H.connstr);
        var bucket = cluster.openBucket(H.bucket, function () {
          bucket.disconnect();
          assert.throws(function () {
            bucket.insert(H.key(), 'bar', H.noCallback());
          }, Error);
          done();
        });
      });

    it('should ignore superflous disconnects', function (done) {
      var cluster = new H.lib.Cluster(H.connstr);
      var bucket = cluster.openBucket(H.bucket, function () {
        bucket.disconnect();
        bucket.disconnect();
        bucket.disconnect();
        bucket.disconnect();
        done();
      });
    });

    it('clientVersion property should work', function () {
      assert(typeof H.b.clientVersion === 'string');
    });
    it('lcbVersion property should work', function () {
      assert(typeof H.b.lcbVersion === 'string');
    });

    it('operationTimeout property should work', function () {
      var origValue = H.b.operationTimeout;
      assert(origValue > 0);
      H.b.operationTimeout = origValue + 1;
      assert.notEqual(H.b.operationTimeout, origValue);
      H.b.operationTimeout = origValue;
    });
    it('viewTimeout property should work', function () {
      var origValue = H.b.viewTimeout;
      assert(origValue > 0);
      H.b.viewTimeout = origValue + 1;
      assert.notEqual(H.b.viewTimeout, origValue);
      H.b.viewTimeout = origValue;
    });
    it('durabilityInterval property should work', function () {
      var origValue = H.b.durabilityInterval;
      assert(origValue > 0);
      H.b.durabilityInterval = origValue + 1;
      assert.notEqual(H.b.durabilityInterval, origValue);
      H.b.durabilityInterval = origValue;
    });
    it('durabilityTimeout property should work', function () {
      var origValue = H.b.durabilityTimeout;
      assert(origValue > 0);
      H.b.durabilityTimeout = origValue + 1;
      assert.notEqual(H.b.durabilityTimeout, origValue);
      H.b.durabilityTimeout = origValue;
    });
    it('managementTimeout property should work', function () {
      var origValue = H.b.managementTimeout;
      assert(origValue > 0);
      H.b.managementTimeout = origValue + 1;
      assert.notEqual(H.b.managementTimeout, origValue);
      H.b.managementTimeout = origValue;
    });
    it('configThrottle property should work', function () {
      var origValue = H.b.configThrottle;
      assert(origValue > 0);
      H.b.configThrottle = origValue + 1;
      assert.notEqual(H.b.configThrottle, origValue);
      H.b.configThrottle = origValue;
    });
    it('connectionTimeout property should work', function () {
      var origValue = H.b.connectionTimeout;
      assert(origValue > 0);
      H.b.connectionTimeout = origValue + 1;
      assert.notEqual(H.b.connectionTimeout, origValue);
      H.b.connectionTimeout = origValue;
    });
    it('nodeConnectionTimeout property should work', function () {
      var origValue = H.b.nodeConnectionTimeout;
      assert(origValue > 0);
      H.b.nodeConnectionTimeout = origValue + 1;
      assert.notEqual(H.b.nodeConnectionTimeout, origValue);
      H.b.nodeConnectionTimeout = origValue;
    });
  }

  describe('#RealBucket', allTests.bind(this, harness));
  describe('#MockBucket', allTests.bind(this, harness.mock));
});
