var assert = require('assert');
var fs = require('fs');
var H = require('../test_harness.js');

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

      cb.set(key, "something", function(err, result) {
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

  it('JSCBC-24', function(done) {
    var cb = H.newClient();

    // Wrapping of Unhandle Exceptions to disable mocha's default ones
    var ueListeners = process.listeners('uncaughtException');
    process.removeAllListeners('uncaughtException');
    function restoreListeners() {
      process.removeAllListeners('uncaughtException');
      for (var i = 0; i < ueListeners.length; ++i) {
        process.on('uncaughtException', ueListeners[i]);
      }
    }

    // Add our own timer to kill the test before mocha's timeout
    //  so we have a chance to restore the exception handling appropriately.
    this.timeout(5000);
    setTimeout(function() {
      restoreListeners();
      throw new Error('did not receive expected thrown exception');
    }, 2000);

    // Set up our own exception listener so we can see when our
    //  expected exception occurs.
    process.on('uncaughtException', function(e) {
      restoreListeners();
      if (e.message !== 'expected-error') {
        // Emit to the restored listeners
        process.emit('uncaughtException', e);
      } else {
        done();
      }
    });

    // Perform an operation and throw inside the callback, this should
    //  propagate to the main scope as uncaught.
    var testkey = H.genKey('jscbc-24');
    cb.get(testkey, function(err, result) {
      throw new Error('expected-error');
    });
  });

  describe('JSCBC-25', function() {
    context("when keys arg is a nested array", function() {
      it("calls back with an error", function(done) {
        var cb = H.newClient();

        var keys = [[1, 2, 3], [4, 6, 3]];
        cb.get(keys, function(err) {
          assert.ok(err.message.match(/key is not a string/));
          done();
        });
      });
    });

    context("when keys arg is an array", function() {
      it("calls back with an error", function(done) {
        var cb = H.newClient();

        var keys = [1];
        cb.get(keys, function(err) {
          assert.ok(err.message.match(/key is not a string/));
          done();
        });
      });
    });
  });

  describe('CBSE-1036', function() {
    it('durability callbacks work with configuration cache', function(done) {
      fs.unlink('configcache.txt', function() {
        var cb = H.newClient({cachefile: 'configcache.txt'});
        var testkey = H.genKey('CBSE-1036');
        cb.set(testkey, 'test1', {persist_to:1}, H.okCallback(function(res) {
          var cb2 = H.newClient({cachefile: 'configcache.txt'});
          cb2.set(testkey, 'test2', {persist_to:1}, H.okCallback(function(res) {
            done();
          }));
        }));
      });
    });
  });

});
