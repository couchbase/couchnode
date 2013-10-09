var assert = require('assert');
var H = require('../test_harness.js');
var couchbase = require('../lib/couchbase.js');

var cb = H.newClient();

describe('#durability', function() {

  it('should successfully observe', function(done) {
    var key = H.genKey("observe");

    cb.set(key, "value", H.okCallback(function(result){
      cb.observeMulti([key], {}, H.okCallback(function(result){
        assert(typeof result == "object");
        assert(key in result);
        assert(typeof result[key] == 'object');
        assert('cas' in result[key][0]);
        done();
      }));
    }));
  });

  // skip because durability requirements does not currently work property
  it('should successfully set with durability requirements',
      function(done) {
    var key = H.genKey("endure");

    cb.set(key, "value", {persist_to:1, replicate_to:0},
        H.okCallback(function(result){
      cb.remove(key, {persist_to:1, replicate_to:0},
          H.okCallback(function(result) {
        cb.add(key, "value", {persist_to:1, replicate_to:0},
            H.okCallback(function(result){
          done();
        }));
      }));
    }));
  });

});
