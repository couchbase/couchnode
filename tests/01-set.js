var assert = require('assert');
var harness = require('./harness.js');
harness.plan(2);

var t1 = function() {
  var H = new harness.Harness();
  var cb = H.client;
  
  var key = H.genKey("set1");
  cb.set(key, "bar", H.okCallback(function(firstmeta){
    // nothing broke
    cb.set(key, "baz", H.okCallback(function(secondmeta){
      assert.notDeepEqual(firstmeta.cas, secondmeta.cas, "CAS should change");
      cb.set(key, "bam", firstmeta, function(err, meta){
        assert(err, "Key should fail with stale CAS");
        cb.get(key, H.docCallback(function(doc){
          assert.equal(doc, "baz");
          cb.set(key, "grr", secondmeta, H.okCallback(function(meta){
            cb.get(key, H.docCallback(function(doc){
              assert.equal("grr", doc);
              harness.end(0);
            }))
          }))
        }))
      })
    }))
  }))
}();

var t2 = function() {
  var H = new harness.Harness();
  var cb = H.client;
  var key = H.genKey("set2");
  cb.set(key, JSON.stringify({foo: "bar"}), H.okCallback(function(){
    cb.set(key, JSON.stringify({foo: "baz"}), H.okCallback(function(){
      cb.get(key, H.docCallback(function(doc){
        assert.equal(JSON.stringify({foo: "baz"}), doc);
        harness.end(0);
      }))
    }));
  }));
}();