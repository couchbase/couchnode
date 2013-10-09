var assert = require('assert');
var H = require('../test_harness.js');
var couchbase = require('../lib/couchbase.js');

var cb = H.newClient();

describe('#prepend/append', function() {

  it('should fail to prepend to missing key', function(done) {
    var key = H.genKey("append");

    cb.remove(key, function(){});

    cb.append(key, 'willnotwork', function(err, result){
      assert.equal(err.code, couchbase.errors.notStored);
      done();
    });
  });

  it('should fail to append to missing key', function(done) {
    var key = H.genKey("prepend");
    cb.remove(key, function(){});
    cb.prepend(key, 'willnotwork', function(err, result){
      assert.equal(err.code, couchbase.errors.notStored);
      done();
    });
  });

});
