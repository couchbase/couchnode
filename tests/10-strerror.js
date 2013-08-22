var harness = require('./harness.js');
var assert = require('assert');
var Couchbase = require('../lib/couchbase.js');

var H = new harness.Harness();
var cb = H.client;

harness.plan(1)

cb.strError(1000); // don't crash
assert.equal(cb.strError(0), 'Success');
cb.shutdown();

for (var errKey in Couchbase.errors) {
  var errValue = Couchbase.errors[errKey];
  assert.equal(typeof errValue, "number", "Bad constant for : " + errKey);
  assert(errValue >= 0);
}

harness.end()