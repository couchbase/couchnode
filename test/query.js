var assert = require('assert');
var H = require('../test_harness.js');

(H.supportsN1ql ? describe : describe.skip)('#query', function() {

  it('should execute a raw query successfully', function(done) {
    var cb = H.client;
    cb.query('SELECT * FROM default', function(err, res) {
      assert(!err, 'Failed to execute query.');
      assert(res, 'No results returned.');
      done();
    });
  });

  it('should handle raw query errors correctly', function(done) {
    var cb = H.client;
    cb.query('SELECT * FROM invalid_bucket', function(err, res) {
      assert(err, 'Query should have failed');
      done();
    });
  });

  it('should execute formated query strings correctly', function(done) {
    var cb = H.client;
    cb.query('SELECT * FROM ??', ['default'], function(err, res) {
      assert(!err, 'Failed to execute query.');
      assert(res, 'No results returned.');
      done();
    });
  });

});
