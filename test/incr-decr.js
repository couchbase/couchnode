var assert = require('assert');
var H = require('../test_harness.js');
var couchbase = require('../lib/couchbase.js');

var cb = H.newClient();

describe('#incr/decr', function() {

  it('should work with basic inputs', function(done) {
    var key = H.genKey("incrdecr1");

    cb.remove(key, function(err) {
      cb.incr(key, {initial: 0}, H.okCallback(function(result){
        assert.equal(result.value, 0, "Initial value should be 0");

        cb.incr(key, H.okCallback(function(result){
          assert.equal(result.value, 1, "Increment by one");

          cb.decr(key, H.okCallback(function(result){
            assert.equal(result.value, 0, "Decrement by 0");
            done();
          }));
        }));
      }));
    });
  });

  it('should work with offsets', function(done) {
    var key = H.genKey("incrdecr2");

    cb.remove(key, function(){
      cb.incr(key, {initial: 0, offset: 100}, H.okCallback(function(result){
        assert.equal(0, result.value, "Offset ignored when doing default");
        cb.incr(key, {offset: 20}, H.okCallback(function(result){
          assert.equal(result.value, 20, "Increment by 20");
          cb.decr(key, {offset: 15}, H.okCallback(function(result){
            assert.equal(result.value, 5, "Decrement by 5");
            done();
          }));
        }));
      }));
    });
  });

  it('should work with default values', function(done) {
    var key = H.genKey("incrdecr3");

      cb.remove(key, function(){
        cb.incr(key, function(err, result){
          assert(err, "Error when incrementing key that does not exist");
          cb.incr(key, {initial: 500, offset: 20}, H.okCallback(function(result){
            assert.equal(result.value, 500, "Offset is ignored when default is used");
            cb.decr(key, {initial: 999, offset: 10}, H.okCallback(function(result){
              assert.equal(result.value, 490, "Initial is ignored when value exists");
              done();
            }));
          }));
        });
      });
  });

  it('should work with expiries', function(done) {
    this.timeout(3000);

    var key = H.genKey("incrdecr4");

    cb.remove(key, function(){
      cb.incr(key, {offset:20, initial:0, expiry:1}, H.okCallback(function(result){
        cb.incr(key, H.okCallback(function(result){
          assert.equal(result.value, 1);
          setTimeout(function(){
            cb.get(key, function(err, result){
              assert(err, "Expiry with arithmetic");
              done();
            });
          }, 2000);
        }));
      }));
    });
  });

});
