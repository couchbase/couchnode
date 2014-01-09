var assert = require('assert');
var H = require('../test_harness.js');

var cb = H.newClient();

describe('#query', function() {

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

});
/**
 * Created by brettlawson on 1/7/2014.
 */
