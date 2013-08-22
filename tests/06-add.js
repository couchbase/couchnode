var harness = require('./harness.js'),
    assert = require('assert');

var H = new harness.Harness();
var cb = H.client;

harness.plan(1);
var t1 = function() {
  var testkey = H.genKey("add");
  cb.remove(testkey, function(){
    cb.add(testkey, "bar", H.okCallback(function() {
      // try to add existing key, should fail
      cb.add(testkey, "baz", function (err, meta) {
        assert(err, "Can't add object at empty key");
        harness.end(0);
      });
    }));
  });
}();