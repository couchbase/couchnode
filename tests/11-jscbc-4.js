var harness = require('./harness'),
assert = require('assert');

harness.plan(1);

var t1 = function() {
  var H = new harness.Harness();
  var cb = H.client;
  var key = H.genKey("jscbc-4");

  // Remove the key to ensure that it is missing when we're trying
  // to do the incr
  cb.remove(key, function(){});

  // Calling increment on a missing key will create the key with
  // the default value (0)
  cb.incr(key, {initial: 0 }, function(){});

  // Retrieve the key and validate that the value is set to the
  // default value
  cb.get(key, H.docCallback(function(doc){
    assert.equal(doc, "0");
  }));

  // Finally remove the key and terminate
  cb.remove(key, function(){
    harness.end(0)
  });
}();
