var setup = require('./setup'),
    assert = require('assert');

setup.plan(5); // exit at fourth call to setup.end()

setup(function(err, cb) {
    assert(!err, "setup failure");

    cb.on("error", function (message) {
        console.log("ERROR: [" + message + "]");
        process.exit(1);
    });

    var testkey = "02-get.js", testkey2 = "02-get.js2", testkey3 = "02-get.js3";

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

    cb.set(testkey3, [1, "2", true], function (err, meta) {
        assert(!err, "Failed to store object");
        assert.equal(testkey3, meta.id, "Callback called with wrong key!")

        cb.get(testkey3, function (err, doc, meta) {
            assert.equal(testkey3, meta.id, "Callback called with wrong key!")
            assert.equal("2", doc[1], "JSON values should be converted back to objects")
            setup.end();
        })
    });

    var testkey4 = "get-test-4", testJSON4 = ['☆'];
    cb.set(testkey4, testJSON4, function (err, meta) {
        assert(!err, "Failed to store object");
        assert.equal(testkey4, meta.id, "Callback called with wrong key!")

        cb.get(testkey4, function (err, doc, meta) {
            assert.equal(testkey4, meta.id, "Callback called with wrong key!")
            // prove the JSON parser isn't the issue
            assert.equal(testJSON4[0], JSON.parse(JSON.stringify(testJSON4))[0])
            assert.equal(testJSON4[0], doc[0], "JSON values should be converted back to objects")
            setup.end();
        })
    });

    // test the same without JSON
    var testkey5 = "get-test-4", testString5 = '☆';
    cb.set(testkey5, testString5, function (err, meta) {
        assert(!err, "Failed to store object");
        assert.equal(testkey5, meta.id, "Callback called with wrong key!")

        cb.get(testkey5, function (err, doc, meta) {
            assert.equal(testkey5, meta.id, "Callback called with wrong key!")
            assert.equal(testString5, doc, "Unicode characters should round trip.")
            setup.end();
        })
    });
})

