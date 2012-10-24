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

            // todo: defineView code...
            // cb.defineView("test-design","test-view", {
            //     map : 'function(doc, meta){emit(meta.id)}'
            // }, function(err) {
                // now lets find our key in the view
                cb.view("test-design","test-view", {key : testkey}, function(err, resp, view) {
                    assert(!err, "error fetching view");
                    assert(view.rows.length > 0)
                    assert.equal(testkey, view.rows[0].key)
                    setup.end()
                });
            // }); // defineView callback
        });
    });
})
