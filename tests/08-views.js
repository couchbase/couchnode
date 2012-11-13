var setup = require('./setup'),
    assert = require('assert');

setup(function(err, cb) {
    assert(!err, "setup failure");

    cb.on("error", function (message) {
        console.log("ERROR: [" + message + "]");
        process.exit(1);
    });

    var testkey = "08-views.js"

    cb.set(testkey, "bar", function (err, meta) {
        assert(!err, "Failed to store object");
        assert.equal(testkey, meta.id, "Set callback called with wrong key!")

        cb.get(testkey, function (err, doc, meta) {
            assert(!err, "Failed to get object");
            assert.equal(testkey, meta.id, "Get existing called with wrong key!")

            // todo: figure out how to get around the delay in view creation
            // var ddoc = {
            //     "views": {
            //         "test-view": {
            //             "map": "function(doc,meta){emit(meta.id)}"
            //         }
            //     }
            // };
            // cb.createDesignDoc('dev_test-design', ddoc, function(err, resp, data) {
            //     assert(!err, "error creating design document");

                // now lets find our key in the view
                cb.view("dev_test-design","test-view", {key : testkey}, function(err, resp, view) {
                    assert(!err, "error fetching view");
                    assert(view.rows.length > 0)
                    assert.equal(testkey, view.rows[0].key)
                    setup.end()
                });
            // });
        });
    });
})
