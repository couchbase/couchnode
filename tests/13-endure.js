var setup = require('./setup'),
    assert = require('assert');

setup.plan(1);

setup(function(err, cb) {
    assert(!err, "setup failure");

    cb.on("error", function (message) {
        console.log("ERROR: [" + message + "]");
        process.exit(1);
    });

    var testkey = "13-endure.js"

    cb.set(testkey, "bar", function(err,meta) {
        assert(!err, "Failed to store object");

        var endureOpts = {
            persisted: 1,
            replicated: 0
        };
        cb.endure(testkey, endureOpts, function(err, meta) {
            assert(!err, "Failed to complete endure");
            assert(meta);

            setup.end();
        });
    });
});
