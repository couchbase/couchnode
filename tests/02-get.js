var setup = require('./setup'),
    assert = require('assert');

setup.plan(2); // exit at second call to setup.end()

setup(function(err, cb) {
    assert(!err, "setup failure");

    cb.on("error", function (message) {
        console.log("ERROR: [" + message + "]");
        process.exit(1);
    });

    var testkey = "02-get.js", testkey2 = "02-get.js2";

    cb.set(testkey, "{bar}", function (err, meta) {
        assert(!err, "Failed to store object");
        assert.equal(testkey, meta.id, "Callback called with wrong key!")

        cb.get(testkey, function (err, doc, meta) {
            assert.equal(testkey, meta.id, "Callback called with wrong key!")
            assert.equal("{bar}", doc, "Callback called with wrong value!")

            cb.set(testkey, "bam", meta, function (err, meta) {
                assert(!err, "Failed to set with cas");
                assert.equal(testkey, meta.id, "Callback called with wrong key!");
                cb.get(testkey, function (err, doc, meta) {
                    assert(!err, "Failed to get");
                    assert.equal("bam", doc, "Callback called with wrong value!")
                    setup.end();
                })
            })
        })
    });

    cb.set(testkey2, {foo : "bar"}, function (err, meta) {
        assert(!err, "Failed to store object");
        assert.equal(testkey2, meta.id, "Callback called with wrong key!")

        cb.get(testkey2, function (err, doc, meta) {
            assert.equal(testkey2, meta.id, "Callback called with wrong key!")
            assert.equal("bar", doc.foo, "JSON values should be converted back to objects")
            setup.end();
        })
    });
})

