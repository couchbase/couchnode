var harness = require('./harness.js');
var assert = require('assert');
harness.plan(3);

var testShutdown = function() {
  var H = new harness.Harness();
  var cb = H.client;
  var key = H.genKey("shutdown-1");
  H.setGet(key, "foo", function(doc){
    cb.shutdown();
    harness.end(0);
  })
}();

// Test shutdown twice..
var testIssue37 = function() {
  var H = new harness.Harness();
  var cb = H.client;
  cb.set("key", "value", H.okCallback(function(meta){
    cb.shutdown();
    cb.get("key", function(err, meta){});
    cb.shutdown();
    harness.end(0);
  }));
}();

var testIssue38 = function() {
  var H = new harness.Harness();
  var cb = H.client;
  cb.set("key", "value", function(err, meta) {
    cb.shutdown();
    setTimeout(function() {
      cb.get("key", function(err, meta){
        assert(err, "Operation fails after shutdown");
        harness.end(0);
      });
    }, 10)
  });
}();
