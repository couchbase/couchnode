var setup = require("./setup");
var assert = require("assert");
var testkey = "08-views.js"
var designdoc = "dev_test-design";

function do_run_view(cb) {
   // now lets find our key in the view.
   // We need to add stale=false in order to force the
   // view to be generated (since we're trying to look
   // for our key and it may not be in the view yet due
   // to race conditions..
   var params =  {key : testkey, full_set : "true", stale : "false"};
   cb.view(designdoc, "test-view", params, function(err, view) {
       if (err && err.code == 10) {
         // Lets assume that the view isn't created yet... try again..
         do_run_view(cb);
       } else {
         assert(!err, "error fetching view");
         assert(view.length == 1);
         assert.equal(testkey, view[0].key);
         cb.deleteDesignDoc(designdoc, function() { cb.shutdown(); });
       }
   });
}

setup(function(err, cb) {
    assert(!err, "setup failure");

    cb.on("error", function (message) {
        console.log("ERROR: [" + message + "]");
        process.exit(1);
    });

    cb.set(testkey, "bar", function (err, meta) {
        assert(!err, "Failed to store object");
        assert.equal(testkey, meta.id, "Set callback called with wrong key!")

        cb.get(testkey, function (err, doc, meta) {
            assert(!err, "Failed to get object");
            assert.equal(testkey, meta.id, "Get existing called with wrong key!");
            var ddoc = {
                 "views": {
                     "test-view": {
                         "map": "function(doc,meta){emit(meta.id)}"
                     }
                 }
             };
             cb.deleteDesignDoc(designdoc, function() {
                 cb.setDesignDoc(designdoc, ddoc, function(err, data) {
                     assert(!err, "error creating design document");
                     // The ns_server API is async here for some reason,
                     // so the view may not be ready to use yet...
                     // Try to poll the vire
                     do_run_view(cb);
                 });
             });
        });
    });
})
