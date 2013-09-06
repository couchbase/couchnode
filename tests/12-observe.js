var harness = require('./harness');
var assert = require('assert');

harness.plan(1);

var testSingleObserve = function() {
  var H = new harness.Harness();
  var cb = H.client;
  var key = H.genKey("observe");
  
  cb.set(key, "value", H.okCallback(function(meta){
    cb.observeMulti([key], {}, H.okCallback(function(meta){
      assert(typeof meta == "object");
      assert(key in meta);
      assert(typeof meta[key] == 'object');
      assert('cas' in meta[key][0]);
      harness.end(0);
    }));
  }))
}();