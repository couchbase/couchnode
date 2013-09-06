var harness = require('./harness.js');
var assert = require('assert');
var couchbase = require('../lib/couchbase.js');

harness.plan(9);
var H = new harness.Harness();

var t1 = function() {
  var key = H.genKey("test2-02get");
  H.setGet(key, {foo: "bar"}, function(doc) {
    assert.equal("bar", doc.foo,"JSON values should be converted back to objects");
    harness.end(0);
  });
}();

var t2 = function() {
  var key = H.genKey("test3-02get");
  var value = [1, "2", true, null, false, {}, []];
  H.setGet(key, value, function(doc){
    assert.deepEqual(value, doc, "JSON objects should match");
    harness.end(0);
  });
}();

var t3 = function() {
  var key = H.genKey("test4-02get");
  var value = ['☆'];
  H.setGet(key, value, function(doc){
    assert.deepEqual(value, doc, "JSON with Unicode characters should round trip");
    harness.end(0);
  });
}();


// 2 tests here
var t4 = function() {
  var value = [1,2,3,4,5,6];
  var key = H.genKey("test_raw");
  var cb = H.client;

  cb.set(key, value, H.okCallback(function(){
    cb.get(key, { format: 'raw' }, H.docCallback(function(doc){
      assert.equal(doc, JSON.stringify(value));
      harness.end(0);
    }));

    cb.get(key, { format: 'auto' }, H.docCallback(function(doc){
      assert.deepEqual(doc, value);
      harness.end(0);
    }));
  }))
}();


// 2 more here
var t5 = function() {
  var value = "hello";
  var key = H.genKey("test-json-strings");
  var cb = H.client;
  cb.set(key, value, { format: 'json' }, H.okCallback(function(){
    cb.get(key, H.docCallback(function(doc){
      assert.equal(doc, value);
      harness.end(0);
    }));
    cb.get(key, { format: 'raw' }, H.docCallback(function(doc){
      assert.equal(doc, '"hello"');
      harness.end(0);
    }))
  }))
}();

var testUnencodable = function() {
  var value = [1,2,3,4];
  var key = H.genKey("test-utf8-inconvertible");
  var cb = H.client;
  cb.set(key, value, { format: 'raw' }, function(err, meta){
    assert(err);
    harness.end(0);
  })
}();

var testRawFormat = function() {
  var cb = H.client;
  var buf = new Buffer([0, 1, 2]);
  // \x00, \x01, \x02
  var key = H.genKey("test-raw-format");

  cb.set(key, buf, H.okCallback(function(){
    cb.get(key, H.okCallback(function(meta){
      var doc = meta.value;
      assert(Buffer.isBuffer(doc));
      assert.deepEqual(buf, doc);
      assert.equal(meta.flags, couchbase.format.raw);
      harness.end(0);
    }))
  }))
}();