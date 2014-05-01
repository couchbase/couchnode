var assert = require('assert');
var H = require('../test_harness.js');

// Disabled as it is non-deterministic due to the chances of two vbuckets
//   being on the same server during the test.

/*
describe('#hashkeys', function() {

  it('should work with basic inputs', function(done) {
    var cb = H.client;

    var key = H.genKey("hashkey");
    var hashkey = key + "_hashkey";

    cb.set(key, "bar", { hashkey: hashkey }, H.okCallback(function(){
      cb.get(key, { hashkey: hashkey }, H.okCallback(function(result){
        assert.equal(result.value, "bar");
        cb.get(key, function(err, result){
          assert.ok(err);
          assert.equal(err.code, H.errors.keyNotFound);
          done();
        });
      }));
    }));
  });

});
*/
