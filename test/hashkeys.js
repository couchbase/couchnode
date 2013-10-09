var assert = require('assert');
var H = require('../test_harness.js');
var couchbase = require('../lib/couchbase.js');

var cb = H.newClient();

describe('#hashkeys', function() {

  // No way to accurately test hashkeys with single node cluster
  it.skip('should work with basic inputs', function(done) {
    var key = H.genKey("hashkey");
    var hashkey = key + "_hashkey";

    cb.set(key, "bar", { hashkey: hashkey }, H.okCallback(function(){
      cb.get(key, { hashkey: hashkey }, H.okCallback(function(result){
        assert.equal(result.value, "bar");
        cb.get(key, function(err, result){
          assert.ok(err);
          assert.equal(err.code, couchbase.errors.keyNotFound);
          done();
        });
      }));
    }));
  });

});
