var harness = require('./harness.js');
var assert = require('assert');

var H = new harness.Harness();
var cb = H.client;
harness.plan(1);

var t1 = function() {
  var testkey = H.genKey("replace");
  cb.remove(testkey, function(){
    // try to replace a missing key, should fail
    cb.replace(testkey, "bar", function(err, meta) {
      assert(err, "Can't replace object that is already removed");
      
      cb.set(testkey, "bar", function (err, meta) {
        assert(!err, "Failed to store object");
        
        cb.replace(testkey, "bazz", function (err, meta) {
          assert(!err, "Failed to replace object");
          
          cb.get(testkey, function (err, doc) {
            assert(!err, "Failed to get object");
            assert.equal("bazz", doc.value, "Replace didn't work")
            harness.end(0);
          })
        });
      });
    });
  });
}();