var harness = require('./harness.js'),
    assert = require('assert');

var H = new harness.Harness();
var c = H.client;

harness.plan(1);


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
