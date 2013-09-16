var assert = require('assert');
var H = require('../test_harness.js');
var couchbase = require('../lib/couchbase.js');

describe('#regressions', function() {

  it('JSCBC-4', function(done) {
    var cb = H.newClient();

    var key = H.genKey("jscbc-4");

    // Remove the key to ensure that it is missing when we're trying
    // to do the incr
    cb.remove(key, function(){});

    // Calling increment on a missing key will create the key with
    // the default value (0)
    cb.incr(key, {initial: 0 }, function(){});

    // Retrieve the key and validate that the value is set to the
    // default value
    cb.get(key, H.okCallback(function(result){
      assert.equal(result.value, "0");
    }));

    // Finally remove the key and terminate
    cb.remove(key, function(){
      done();
    });
  });

  it('JSCBC-14', function(done) {
    var cb = H.newClient();

    cb.on("error", function (message) {
      done(message);
    });

    var current = 0;
    var max = 10;
    for (var i=0; i < max; ++i){
      var key = H.genKey('jscbc-14');

      cb.set(key, "something", function(err, meta) {
        if (err) {
            process.abort();
        }
        assert(!err, "Failed to store value" + err);
        ++current;
        if (current == max) {
           done();
        }
      });
    }
  });

  // Skipped for now as mocha does not allow gracefully handling
  //  uncaught exceptions
  it.skip('JSCBC-24', function(done) {
    var cb = H.newClient();

    var d = require('domain').create();
    d.on('error', function(err) {
      if (err.message!='expected-error') {
        throw err;
      }
      done();
    });

    d.run(function() {
      var testkey = "18-cb-error.js";
      cb.get(testkey, function(err, meta) {
        throw new Error('expected-error');
      });
    });
  });

  it('JSCBC-25', function(done) {
    var cb = H.newClient();

    var keys = [[1,2,3],[4,6,3]];
    try {
      cb.get(keys, function (err, doc, meta) {
      });
      assert(false, "Invalid keys should throw exceptions");
    } catch (err) {
    }

    var keys = [1];
    try {
      cb.get(keys, function (err, doc, meta) {
      });
      assert(false, "Invalid keys should throw exceptions");
    } catch (err) {
    }

    done();
  });

});