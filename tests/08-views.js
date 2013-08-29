var harness = require('./harness.js');
var assert = require("assert");
var testkey = "08-views.js"
var designdoc = "dev_test-design";

harness.plan(1);

function do_run_view(cb) {
  // now lets find our key in the view.
  // We need to add stale=false in order to force the
  // view to be generated (since we're trying to look
  // for our key and it may not be in the view yet due
  // to race conditions..
  var params =  {key : testkey, full_set : "true", stale : "false"};
  var q = cb.view(designdoc, "test-view", params)
  q.query(function(err, view) {
    if (err && err.reason == "view_undefined") {
      // Lets assume that the view isn't created yet... try again..
      do_run_view(cb);
    } else {
      assert(!err, "error fetching view");
      assert(view.length == 1);
      assert.equal(testkey, view[0].key);
      cb.removeDesignDoc(designdoc, function() { cb.shutdown(); });
      harness.end(0);
    }
  });
}

var viewsTest = function() {
  var H = new harness.Harness();
  var cb = H.client;

  H.setGet(testkey, "bar", function(doc) {
    var ddoc = {
      "views": {
        "test-view": {
          "map": "function(doc,meta){emit(meta.id)}"
        }
      }
    };
    cb.removeDesignDoc(designdoc, function() {
      cb.setDesignDoc(designdoc, ddoc, function(err, data) {
        assert(!err, "error creating design document");
        // The ns_server API is async here for some reason,
        // so the view may not be ready to use yet...
        // Try to poll the vire
        do_run_view(cb);
      });
    });
  });
}();
