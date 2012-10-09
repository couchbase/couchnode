var setup = require('./setup'),
    assert = require('assert');

setup(function(err, cb) {
    assert(!err, "setup failure");

    cb.on("error", function (message) {
        console.log("ERROR: [" + message + "]");
        process.exit(1);
    });

    var testkey = "04-delete.js"

    cb.set(testkey, "bar", function (err, meta) {
        assert(!err, "Failed to store object");
        assert.equal(testkey, meta.id, "Get callback called with wrong key!")

        cb.delete(testkey, function (err, meta) {
            assert(!err, "Failed to delete object");
            assert.equal(testkey, meta.id, "Delete existing called with wrong key!")

            // now delete it even when it doesn't exist
            cb.delete(testkey, function (err, meta) {
                assert(err, "Can't delete object that is already deleted");
                assert.equal(testkey, meta.id, "Delete missing called with wrong key!")
                process.exit(0);
            });
        });
    });
})
