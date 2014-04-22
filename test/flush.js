'use strict';
var assert = require('assert');
var H = require('../test_harness');
var util = require('util')

var cb = H.newClient();

describe('#flush', function() {
  this.timeout(10000);

  var key;
  before(function(done) {
    key = H.genKey("set")
    cb.set(key, "bar", done)
  });

  it('should remove all the keys successfully', function(done) {
    cb.flush(function(err) {
      assert.ifError(err);
      cb.get(key, function(err, res) {
        assert.equal(err.code, H.errors.keyNotFound);
        done();
      });
    });
  })
});

