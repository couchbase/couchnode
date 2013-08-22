var harness = require('./harness.js');
var assert = require('assert');
var couchbase = require('../lib/couchbase.js');

harness.plan(4);

var testDefaultStats = function() {
  var H = new harness.Harness();
  var cb = H.client;
  cb.stats(function(err, stats){
    assert(!err);
    assert(Object.keys(stats).length > 0);
    assert(typeof stats === "object");
    harness.end(0);
  })
}();

var testKeyedStats = function() {
  var H = new harness.Harness();
  var cb = H.client;
  cb.stats("memory", function(err, stats){
    assert(!err);
    assert(Object.keys(stats).length > 0);
    
    for (var server in stats) {
      var detail = stats[server];
      assert("mem_used" in detail);
    }
    harness.end(0);
  });
}();

var testBadKey = function() {
  var H = new harness.Harness();
  var cb = H.client;
  cb.stats("blahblah", function(err, stats){
    assert(err);
    assert.equal(err.code, couchbase.errors.keyNotFound);
    harness.end(0);
  })
}();

var testCallbackOnce = function() {
  var timesCalled = 0;
  var H = new harness.Harness();
  var cb = H.client;
  cb.stats(function(){
    timesCalled++;
    assert(timesCalled == 1);
  })
  setTimeout(function(){
    harness.end(0);
  }, 200);
}();