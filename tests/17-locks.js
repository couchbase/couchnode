var harness = require('./harness.js');
var assert = require('assert');
var couchbase = require('../lib/couchbase.js');

harness.plan(6);

var t1 = function() {
  var H = new harness.Harness();
  var cb = H.client;
  var testkey1 = H.genKey('lock1');

  // With lock should deny second lock
  cb.set(testkey1, "{bar}", H.okCallback(function(meta) {
    cb.lock(testkey1, {locktime: 1 }, H.docCallback(function(doc) {
      assert.equal("{bar}", doc, "Callback called with wrong value!");
      cb.lock(testkey1, {locktime: 1 }, function (err, meta) {
        assert(err);
        assert.equal(err.code, couchbase.errors.temporaryError);
        harness.end(0);
      });
    }));
  }));
}();

var t2 = function() {
  var H = new harness.Harness();
  var testkey2 = H.genKey("lock2");
  var cb = H.client;

  // Lock should unlock after expiry.
  cb.set(testkey2, "{baz}", H.okCallback(function(meta) {
    cb.lock(testkey2, { locktime: 1}, H.docCallback(function(doc) {
      assert.equal("{baz}", doc, "Callback called with wrong value!");
      setTimeout(function () {
        cb.lock(testkey2, {locktime: 1 }, function(err, meta) {
          assert(!err, "Should be able to reset lock after expiry.");
          harness.end(0);
        });
      }, 2000);
    }));
  }));
}();


// Lock should not affect ordinary gets.
var t3 = function() {
  var H = new harness.Harness();
  var testkey3 = H.genKey("lock3");
  var cb = H.client;

  cb.set(testkey3, "{bat}", H.okCallback(function() {
    cb.lock(testkey3, {locktime: 1}, H.docCallback(function(doc){
      assert.equal("{bat}", doc, "Callback called with wrong value!");
      cb.get(testkey3, H.docCallback(function(doc) {
        harness.end(0);
      }));
    }));
  }));
}();

var t4 = function() {
  var H = new harness.Harness();
  var testkey4 = H.genKey("lock4");
  var cb = H.client;

  cb.set(testkey4, "{bam}", H.okCallback(function(meta) {
    cb.lock(testkey4, {locktime: 1}, H.docCallback(function(doc) {
      assert.equal("{bam}", doc, "Callback called with wrong value!");
      cb.set(testkey4, 'nothing', function (err, meta) {
        assert(err);
        harness.end(0);
      });
    }));
  }));
}();


// Lock shouldn't block sets with cas.
var t5 = function() {
  var H = new harness.Harness();
  var testkey5 = H.genKey("lock5");
  var cb = H.client;

  cb.set(testkey5, "{bark}", H.okCallback(function(meta) {
    cb.lock(testkey5, {locktime: 1}, H.okCallback(function(meta) {
      assert.equal("{bark}", meta.value, "Callback called with wrong value!");
      cb.set(testkey5, "nothing", meta, function (err, meta) {
        assert(!err, "Failed to overwrite locked key by using cas.");
        cb.get(testkey5, H.docCallback(function(doc) {
          assert.equal("nothing", doc, "Callback called with wrong value!");
          harness.end(0);
        }));
      });
    }));
  }));
}();

var t6 = function() {
  var H = new harness.Harness();
  var testkey6 = H.genKey("lock6");
  var cb = H.client;

  // Unlock reverts lock.
  cb.set(testkey6, "{boo}", H.okCallback(function(meta) {
    cb.lock(testkey6, {locktime: 20}, H.okCallback(function(meta) {
      assert.equal("{boo}", meta.value, "Callback called with wrong value!");
      assert('cas' in meta);
      cb.unlock(testkey6, meta, H.okCallback(function() {
        cb.set(testkey6, 'hello', H.okCallback(function(){
          harness.end(0);
        }));
      }));
    }));
  }))
}();
