var assert = require('assert');
var H = require('../test_harness.js');
var couchbase = require('../lib/couchbase.js');

var cb = H.newClient();

describe('#replace', function() {

  it('should work with basic inputs', function(done) {
    var testkey = H.genKey("replace");

    cb.remove(testkey, function(){
      // try to replace a missing key, should fail
      cb.replace(testkey, "bar", function(err, result) {
        assert(err, "Can't replace object that is already removed");

        cb.set(testkey, "bar", function (err, result) {
          assert(!err, "Failed to store object");

          cb.replace(testkey, "bazz", function (err, result) {
            assert(!err, "Failed to replace object");

            cb.get(testkey, function (err, doc) {
              assert(!err, "Failed to get object");
              assert.equal("bazz", doc.value, "Replace didn't work");
              done();
            });
          });
        });
      });
    });
  });

});
