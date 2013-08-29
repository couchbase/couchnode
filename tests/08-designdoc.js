var harness = require('./harness.js');
var util = require('util');
var assert = require('assert');

harness.plan(1);


var ddoc = {
  "views": {
    "test-view": {
      "map": "function(doc,meta){emit(meta.id)}"
    }
  }
};

var t1 = function() {
  var H = new harness.Harness();
  var cb = H.client;
  var docname = "dev_ddoc-test";

  // We don't know the state of the server so just
  // do an unconditional delete
  cb.removeDesignDoc(docname, function() {
    // Ok, the design document should be done
    cb.setDesignDoc(docname, ddoc, function(err, data) {
      var util=require("util");
      assert(!err, "error creating design document");
      cb.getDesignDoc(docname, function(err, data) {
        assert(!err, "error getting design document");
        cb.removeDesignDoc(docname, function(err, data) {
          assert(!err, "Failed deleting design document");
          cb.shutdown();
          harness.end(0);
        });
      });
    });
  });
}();
