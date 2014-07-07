'use strict';

var assert = require('assert');
var harness = require('./harness.js');

describe('#crud', function () {
  function allTests(H) {
    it('should properly round-trip binary', function(done) {
      var key = H.key();
      var data = new Buffer([3,2,4,1]);
      H.b.insert(key, data, H.okCallback(function() {
        H.b.get(key, H.okCallback(function(res) {
          assert(Buffer.isBuffer(res.value));
          assert.deepEqual(res.value, data);
          done();
        }));
      }));
    });
    it('should properly round-trip json', function(done) {
      var key = H.key();
      var data = {x:1,y:{z:2}};
      H.b.insert(key, data, H.okCallback(function() {
        H.b.get(key, H.okCallback(function(res) {
          assert.deepEqual(res.value, data);
          done();
        }));
      }));
    });
    it('should properly round-trip text', function(done) {
      var key = H.key();
      var data = 'foo';
      H.b.insert(key, data, H.okCallback(function() {
        H.b.get(key, H.okCallback(function(res) {
          assert.deepEqual(res.value, data);
          done();
        }));
      }));
    });
    it('should call custom transcoders', function(done) {
      var c = new H.lib.Cluster(H.connstr);
      var b = c.openBucket(H.bucket);
      var encoderCalled = false;
      var decoderCalled = false;
      b.setTranscoder(function(doc) {
        encoderCalled = true;
        return { value: doc, flags: 0 };
      }, function(doc) {
        decoderCalled = true;
        return doc.value;
      });
      // test object much be binary to be inserted by binding
      var data = new Buffer('test', 'utf8');
      var key = H.key();
      b.insert(key, data, H.okCallback(function() {
        b.get(key, H.okCallback(function() {
          assert(encoderCalled);
          assert(decoderCalled);
          done();
        }));
      }));
    });
    it('should fallback to binary for bad flags', function(done) {
      var c = new H.lib.Cluster(H.connstr);
      var b = c.openBucket(H.bucket);
      var encoderCalled = false;
      b.setTranscoder(function(doc) {
        encoderCalled = true;
        return { value: doc, flags: 50000 };
      });
      var data = new Buffer('test', 'utf8');
      var key = H.key();
      b.insert(key, data, H.okCallback(function() {
        assert(encoderCalled);
        b.get(key, H.okCallback(function(res) {
          assert(Buffer.isBuffer(res.value));
          done();
        }));
      }));
    });
  }

  describe('#RealBucket', allTests.bind(this, harness));
  describe('#MockBucket', allTests.bind(this, harness.mock));
});
