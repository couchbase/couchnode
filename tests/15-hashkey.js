var harness = require('./harness.js');
var assert = require('assert');
var couchbase = require('../lib/couchbase.js');
harness.plan(1);

var t1 = function() {
  var H = new harness.Harness();
  var cb = H.client;
  var key = H.genKey("hashkey");
  var hashkey = key + "_hashkey";

  cb.set(key, "bar", { hashkey: hashkey }, H.okCallback(function(){
    cb.get(key, { hashkey: hashkey }, H.docCallback(function(doc){
      assert.equal(doc, "bar");
      cb.get(key, function(err, meta){
        assert.ok(err);
        assert.equal(err.code, couchbase.errors.keyNotFound);
        harness.end(0);
      });
    }));
  }));
}();
