var assert = require('assert');
var H = require('../test_harness.js');

var cb = H.newClient();

describe.skip('#query', function() {

  it('should execute a raw query successfully', function(done) {
    cb.query('SELECT * FROM default', function(err, res) {
      assert(!err, 'Failed to execute query.');
      assert(res, 'No results returned.');
      done();
    });
  });

  it('should handle raw query errors correctly', function(done) {
    cb.query('SELECT * FROM invalid_bucket', function(err, res) {
      assert(err, 'Query should have failed');
      done();
    });
  });

  it('should execute formated query strings correctly', function(done) {
    cb.query('SELECT * FROM ??', ['default'], function(err, res) {
      assert(!err, 'Failed to execute query.');
      assert(res, 'No results returned.');
      done();
    });
  });

});
