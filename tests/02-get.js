var harness = require('./harness.js'),
    assert = require('assert');

harness.plan(5); // exit at fourth call to setup.end()

var H = harness.create();
var c = H.client;

var t1 = function() {
  var key = H.genKey("test1-02get");
  var value = "{bar}";
  
  c.set(key, value, H.okCallback(function(meta){
    // Ensure we can set a simple key.
    c.get(key, H.okCallback(function(meta){
      assert.equal(meta.value, value);
      
      // Change the value and set again, with CAS
      var value2 = "{bam}";
      c.set(key, value2, H.okCallback(function(meta){
        c.get(key, H.okCallback(function(meta2) {
          assert.deepEqual(meta2.cas, meta.cas);
          assert.equal(meta2.value, value2);
          harness.end();
        }))
      }))
    }))
  }))
}();

var t2 = function() {
  console.trace("Skipping JSON (not yet implemented)");
  harness.end(0);
  return;

  var key = H.genKey("test2-02get");
  H.setGet(key, {foo: "bar"}, function(doc){
    assert.equal("bar", doc.foo,"JSON values should be converted back to objects");
    harness.end(0);
  });
}();

var t3 = function() {
  console.trace("Skipping JSON (not yet implemented)");
  harness.end(0);
  return;

  var key = H.genKey("test3-02get");
  var value = [1, "2", true, null, false, {}, []];
  H.setGet(key, value, function(doc){
    assert.deepEqual(value, doc, "JSON objects should match");
    harness.end(0);
  });
}();
  
var t4 = function() {
  console.trace("Skipping JSON (not yet implemented)");
  harness.end(0);
  return;

  var key = H.genKey("test4-02get");
  var value = ['☆'];
  c.setGet(key, value, function(doc){
    assert.equal(key, value, "JSON with Unicode characters should round trip");
    harness.end(0);
  });
}();

var t5 = function() {
  var key = H.genKey("test5-02get");
  var value = '☆';
  H.setGet(key, value, function(doc){
    assert.equal(doc, value, "Unicode");
    harness.end(0);
  })
}();