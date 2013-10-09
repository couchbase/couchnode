var assert = require('assert');
var H = require('../test_harness.js');
var couchbase = require('../lib/couchbase.js');

var cb = H.newClient();

describe('#getMulti/setMulti', function() {

  it('should work in basic cases', function(done) {
    var calledTimes = 0;
    var keys = [];
    var values = {};

    for (var i = 0; i < 10; i++) {
      var k = H.genKey("multiget-" + i);
      var v = {value: "value" + i};
      keys.push(k);
      values[k] = v;
    }

    function doGets() {
      cb.get(keys[0], H.okCallback(function(doc){
        assert.equal(doc.value, values[keys[0]].value);
      }));

      cb.getMulti(keys, null, H.okCallback(function(results){
        assert.equal(keys.length, Object.keys(results).length);
        Object.keys(results).forEach(function(k){
          assert(values[k] !== undefined);
          assert(results[k] !== undefined);
          assert(results[k].value === values[k].value);
        });

        done();
      }));
    }

    var setHandler = H.okCallback(function(results) {
      calledTimes++;
      if (calledTimes > 9) {
        calledTimes = 0;
        doGets();
      }
    });

    // Finally, put it all together
    cb.setMulti(values, { spooled: false }, setHandler);
  });

  it('should fail with an invalid key', function(done) {
    var badKey = H.genKey("test-multiget-error");
    var goodKey = H.genKey("test-multiget-spooled");
    var goodValue = 'foo';

    cb.set(goodKey, goodValue, function(err, result) {
      assert.ifError(err);
      var keys = [badKey, goodKey];

      cb.getMulti(keys, null, function(err, results) {
        assert.strictEqual(err.code, couchbase.errors.checkResults);
        var goodResult = results[goodKey];
        assert.equal(goodResult.value, goodValue);

        var badResult = results[badKey];
        assert.strictEqual(badResult.error.code, couchbase.errors.keyNotFound);

        done();
      });
    });
  });

});
