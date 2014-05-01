var assert = require('assert');
var H = require('../test_harness.js');

describe('#strerror', function() {

  it('should work for all error types', function(done) {
    var cb = H.newClient();

    cb.strError(1000); // don't crash on bad values
    assert(cb.strError(0).search(/success/i) !== -1, '0 should be success');

    // Should still work with shutdown connection
    cb.shutdown();

    for (var errKey in H.errors) {
      var errValue = H.errors[errKey];
      assert.equal(typeof errValue, "number", "Bad constant for : " + errKey);
      assert(errValue >= 0);
    }

    done();
  });

});