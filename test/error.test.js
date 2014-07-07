'use strict';

var assert = require('assert');
var H = require('./harness.js');

describe('CouchbaseError', function() {
  it('should be the right type', function() {
    var err = H.b._cb._errorTest();
    assert(err instanceof Error);
    assert(err instanceof H.lib.Error);
  });
});