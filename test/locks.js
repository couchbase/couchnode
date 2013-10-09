var assert = require('assert');
var H = require('../test_harness.js');
var couchbase = require('../lib/couchbase.js');

var cb = H.newClient();

describe('#lock/unlock', function() {

  it('should deny second lock', function(done) {
    var testkey1 = H.genKey('lock1');

    cb.set(testkey1, "{bar}", H.okCallback(function(result) {
      cb.lock(testkey1, {locktime: 1 }, H.okCallback(function(result) {
        assert.equal("{bar}", result.value, "Callback called with wrong value!");
        cb.lock(testkey1, {locktime: 1 }, function (err, result) {
          assert(err);
          assert.equal(err.code, couchbase.errors.temporaryError);
          done();
        });
      }));
    }));
  });

  it('should unlock after expiry', function(done) {
    this.timeout(3000);

    var testkey2 = H.genKey("lock2");

    cb.set(testkey2, "{baz}", H.okCallback(function(result) {
      cb.lock(testkey2, { locktime: 1}, H.okCallback(function(result) {
        assert.equal("{baz}", result.value, "Callback called with wrong value!");
        setTimeout(function () {
          cb.lock(testkey2, {locktime: 1 }, function(err, result) {
            assert(!err, "Should be able to reset lock after expiry.");
            done();
          });
        }, 2000);
      }));
    }));
  });

  it('should not affect normal gets', function(done) {
    var testkey3 = H.genKey("lock3");

    cb.set(testkey3, "{bat}", H.okCallback(function() {
      cb.lock(testkey3, {locktime: 1}, H.okCallback(function(result) {
        assert.equal("{bat}", result.value, "Callback called with wrong value!");
        cb.get(testkey3, H.okCallback(function(result) {
          done();
        }));
      }));
    }));
  });

  it('should not affect normal sets', function(done) {
    var testkey4 = H.genKey("lock4");

    cb.set(testkey4, "{bam}", H.okCallback(function(result) {
      cb.lock(testkey4, {locktime: 1}, H.okCallback(function(result) {
        assert.equal("{bam}", result.value, "Callback called with wrong value!");
        cb.set(testkey4, 'nothing', function (err, result) {
          assert(err);
          done();
        });
      }));
    }));
  });

  it('shouldnt block block sets with cas', function(done) {
    var testkey5 = H.genKey("lock5");

    cb.set(testkey5, "{bark}", H.okCallback(function(result) {
      cb.lock(testkey5, {locktime: 1}, H.okCallback(function(result) {
        assert.equal("{bark}", result.value, "Callback called with wrong value!");
        cb.set(testkey5, "nothing", result, function (err, result) {
          assert(!err, "Failed to overwrite locked key by using cas.");
          cb.get(testkey5, H.okCallback(function(result) {
            assert.equal("nothing", result.value, "Callback called with wrong value!");
            done();
          }));
        });
      }));
    }));
  });

  it('should properly unlock locked keys', function(done) {
    var testkey6 = H.genKey("lock6");

    cb.set(testkey6, "{boo}", H.okCallback(function(result) {
      cb.lock(testkey6, {locktime: 20}, H.okCallback(function(result) {
        assert.equal("{boo}", result.value, "Callback called with wrong value!");
        assert('cas' in result);
        cb.unlock(testkey6, result, H.okCallback(function() {
          cb.set(testkey6, 'hello', H.okCallback(function(){
            done();
          }));
        }));
      }));
    }));
  });

});
