var assert = require('assert');
var H = require('../test_harness.js');
var couchbase = require('../lib/couchbase.js');

var cb = H.newClient();

describe('#strerror', function() {

  it('should work for all error types', function(done) {
    cb.strError(1000); // don't crash on bad values
    assert.equal(cb.strError(0), 'Success');

    // Should still work with shutdown connection
    cb.shutdown();

    for (var errKey in couchbase.errors) {
      var errValue = couchbase.errors[errKey];
      assert.equal(typeof errValue, "number", "Bad constant for : " + errKey);
      assert(errValue >= 0);
    }

    done();
  });

});