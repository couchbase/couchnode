var harness = require('./harness.js'),
    assert = require('assert');

var H = new harness.Harness();
var c = H.client;

harness.plan(2);


var t1 = function() {
  var calledTimes = 0;
  var keys = [];
  var values = {};

  for (var i = 0; i < 10; i++) {
    var k = H.genKey("test-multiget-" + i);
    var v = {value: "value" + i};
    keys.push(k);
    values[k] = v;
  }

  function doGets() {
    c.get(keys[0], H.docCallback(function(doc){
      assert.equal(doc, values[keys[0]].value);
    }));

    c.getMulti(keys, null, H.okCallback(function(meta){
      assert.equal(keys.length, Object.keys(meta).length);
      Object.keys(meta).forEach(function(k){
        assert(values[k] !== undefined);
        assert(meta[k] !== undefined);
        assert(meta[k].value === values[k].value);
      });
      harness.end(0);
    }));
  }

  var setHandler = H.okCallback(function(meta) {
    calledTimes++;
    if (calledTimes > 9) {
      calledTimes = 0;
      doGets();
    }
  });

  // Finally, put it all together
  c.setMulti(values, { spooled: false }, setHandler);

}();

var testNoSuchKeyErrorSpooled = function() {
  var H = new harness.Harness();
  var c = H.client;

  var badKey = H.genKey("test-multiget-error");
  var goodKey = H.genKey("test-multiget-spooled");
  var goodValue = 'foo';

  c.set(goodKey, goodValue, function(err, meta) {
    assert.ifError(err);
    var keys = [badKey, goodKey];

    c.getMulti(keys, null, function(err, meta) {
      assert.strictEqual(err.code, couchbase.errors.checkResults);
      var goodResult = meta[goodKey];
      assert.equal(goodResult.value, goodValue);

      var badResult = meta[badKey];
      assert.strictEqual(badResult.error.code, couchbase.errors.keyNotFound);

      harness.end(0);
    });
  });
}();

