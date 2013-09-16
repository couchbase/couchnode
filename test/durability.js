var assert = require('assert');
var H = require('../test_harness.js');
var couchbase = require('../lib/couchbase.js');

var cb = H.newClient();

describe('#durability', function() {

  it('should successfully observe', function(done) {
    var key = H.genKey("observe");

    cb.set(key, "value", H.okCallback(function(meta){
      cb.observeMulti([key], {}, H.okCallback(function(meta){
        assert(typeof meta == "object");
        assert(key in meta);
        assert(typeof meta[key] == 'object');
        assert('cas' in meta[key][0]);
        done();
      }));
    }));
  });

  // skip because durability requirements does not currently work property
  it.skip('should successfully set with durability requirements',
      function(done) {
    var key = H.genKey("endure");

    cb.set(key, "value", {persist_to:1, replicate_to:0},
        H.okCallback(function(meta){
      cb.remove(key, {persist_to:1, replicate_to:0},
          H.okCallback(function(mera) {
        cb.add(key, "value", {persist_to:1, replicate_to:0},
            H.okCallback(function(meta){
          done();
        }));
      }));
    }));
  });

});