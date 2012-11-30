var setup = require('./setup'),
    assert = require('assert');

setup(function(err, cb) {
    assert(!err, "setup failure");

    cb.on("error", function (message) {
        console.log("ERROR: [" + message + "]");
        process.exit(1);
    });

    var testkey = "04-remove.js"

    cb.set(testkey, "bar", function (err, meta) {
        assert(!err, "Failed to store object");
        assert.equal(testkey, meta.id, "Get callback called with wrong key!")
        var cas = meta.cas;

        cb.remove(testkey, function (err, meta) {
            assert(!err, "Failed to remove object");
            assert.equal(testkey, meta.id, "Remove existing called with wrong key!")

            // now remove it even when it doesn't exist
            cb.remove(testkey, function (err, meta) {
                assert(err, "Can't remove object that is already removed");
                assert.equal(testkey, meta.id, "Remove missing called with wrong key!")
                assert.notEqual(cas, meta.cas);
                process.exit(0);
            });
        });
    });
})
