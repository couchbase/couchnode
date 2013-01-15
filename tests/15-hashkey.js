var setup = require('./setup'),
    assert = require('assert');

setup.plan(1);

setup(function(err, cb) {
    assert(!err, "setup failure");

    cb.on("error", function (message) {
        console.log("ERROR: [" + message + "]");
        process.exit(1);
    });

    var testkey = { key : "15-key.js", hashkey : "15-hashkey.js" };
    cb.set(testkey, "{bar}", function (err, meta) {
        assert(!err, "Failed to store object");
        assert.equal(testkey.key, meta.id, "Callback called with wrong key!")

        cb.get(testkey, function (err, doc, meta) {
            assert.equal(testkey.key, meta.id, "Callback called with wrong key!")
            assert.equal("{bar}", doc, "Callback called with wrong value!")
            setup.end();
        })
    });
});
