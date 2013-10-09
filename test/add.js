var assert = require('assert');
var H = require('../test_harness.js');
var couchbase = require('../lib/couchbase.js');

var cb = H.newClient();

describe('#add', function() {

  it('should work with basic inputs', function(done) {
    var testkey = H.genKey("add");

    cb.remove(testkey, function(){
      cb.add(testkey, "bar", H.okCallback(function() {
        // try to add existing key, should fail
        cb.add(testkey, "baz", function (err, result) {
          assert(err, "Can't add object at empty key");
          done();
        });
      }));
    });
  });

});
