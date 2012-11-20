var setup = require('./setup'),
assert = require('assert');

setup.plan(1);

setup(function(err, cb) {
    assert(!err, "setup failure");

    cb.on("error", function (message) {
        console.log("ERROR : [" + message + "]");
        process.exit(1);
    });

    var testkey = "11-jscbc-4.js";

    // Remove the key to ensure that it is missing when we're trying
    // to do the incr
    cb.remove(testkey, function (err, meta) {});
    // Calling increment on a missing key will create the key with
    // the default value (0)
    cb.incr(testkey, function(err, value, meta) {});
    // Retrieve the key and validate that the value is set to the
    // default value
    cb.get(testkey, function (err, doc, meta) {
        assert.equal(testkey, meta.id, "Callback called with wrong key!")
        assert.equal("0", doc, "Callback called with wrong value!")
    });
    // Finally remove the key and terminate
    cb.remove(testkey, function (err, meta) {
        setup.end();
    });
})
