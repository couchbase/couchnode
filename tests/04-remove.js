var harness = require('./harness.js');
var assert = require('assert');
var couchnode = require('../lib/couchbase.js');

var H = new harness.Harness();
var c = H.client;

harness.plan(4);

var simpleRemove = function () {
  var key = H.genKey();
  c.set(key, "a value", H.okCallback(function(meta){
    c.get(key, H.okCallback(function(meta){
      c.remove(key, H.okCallback(function(meta) {
        c.get(key, function(err, meta) {
          assert.equal(err.code, couchnode.errors.keyNotFound);
          harness.end(0);
        });
      }));
    }))
  }))
}();

var removeWithCas = function() {
  var key = H.genKey();
  var value = "Value";
  c.set(key, value, H.okCallback(function(meta1){
    c.set(key, "new value", H.okCallback(function(meta2){
      c.remove(key, { cas: meta1.cas }, function(err, meta){
        assert(err, "Remove fails with bad CAS");
        c.remove(key, {cas: meta2.cas}, H.okCallback(function(meta){
          harness.end(0);
        }));
      })
    }))
  }))
}();

var removeNonExistent = function() {
  var key = H.genKey();
  var value = "some value";
  c.set(key, value, H.okCallback(function(meta) {
    c.remove(key, H.okCallback(function(meta){
      c.remove(key, function(err, meta) {
        assert(err, "Can't remove key twice");
        harness.end(0);
      });
    }));
  }));
}();

var removeMulti = function() {
  var kv = H.genMultiKeys(10, "removeMulti");

  c.setMulti(kv, {spooled: true}, H.okCallback(function(results){
    c.getMulti(Object.keys(kv), {spooled: true}, H.okCallback(function(results){
      c.removeMulti(results, {spooled: true}, H.okCallback(function(results){
        harness.end(0);
      }));
    }));
  }));
}();