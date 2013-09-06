var harness = require('./harness');
var assert = require('assert');

harness.plan(1);

var testSingleEndure = function() {
  var H = new harness.Harness();
  var cb = H.client;
  var key = H.genKey("endure");

  cb.set(key, "value", {persist_to:1, replicate_to:0}, H.okCallback(function(meta){
    cb.remove(key, {persist_to:1, replicate_to:0}, H.okCallback(function(mera) {
      cb.add(key, "value", {persist_to:1, replicate_to:0}, H.okCallback(function(meta){
        harness.end(0);
      }));
    }));
  }));
}();
