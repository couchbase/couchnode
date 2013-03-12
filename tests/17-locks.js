var setup = require('./setup'),
    assert = require('assert');

setup.plan(6); // exit at fourth call to setup.end()

setup(function(err, cb) {
    assert(!err, "setup failure");

    cb.on("error", function (message) {
        console.log("ERROR: [" + message + "]");
        process.exit(1);
    });

    var testkey1 = "16-getAndLock.js1";
    var testkey2 = "16-getAndLock.js2";
    var testkey3 = "16-getAndLock.js3";
    var testkey4 = "16-getAndLock.js4";
    var testkey5 = "16-getAndLock.js5";
    var testkey6 = "16-getAndLock.js6";

    // With lock should deny second lock
    cb.set(testkey1, "{bar}", function (err, meta) {
        assert(!err, "Failed to store object");
        assert.equal(testkey1, meta.id, "Callback called with wrong key!");

        cb.getAndLock(testkey1, 1, function (err, doc, meta) {
            assert.equal(testkey1, meta.id, "Callback called with wrong key!");
            assert.equal("{bar}", doc, "Callback called with wrong value!");

            cb.getAndLock(testkey1, 1, function (err, doc, meta) {
                assert(err);
                setup.end();
            });
        });
    });

    // Lock should unlock after expiry.
    cb.set(testkey2, "{baz}", function (err, meta) {
        assert(!err, "Failed to store object");
        assert.equal(testkey2, meta.id, "Callback called with wrong key!");

        cb.getAndLock(testkey2, 1, function (err, doc, meta) {
            assert.equal(testkey2, meta.id, "Callback called with wrong key!");
            assert.equal("{baz}", doc, "Callback called with wrong value!");

            setTimeout(function () {
                cb.getAndLock(testkey2, 1, function (err, doc, meta) {
                    assert(!err, "Should be able to reset lock after expiry.");
                    setup.end();
                });
            }, 2000);
        });
    });

    // Lock should not affect ordinary gets.
    cb.set(testkey3, "{bat}", function (err, meta) {
        assert(!err, "Failed to store object");
        assert.equal(testkey3, meta.id, "Callback called with wrong key!");

        cb.getAndLock(testkey3, 1, function (err, doc, meta) {
            assert.equal(testkey3, meta.id, "Callback called with wrong key!");
            assert.equal("{bat}", doc, "Callback called with wrong value!");

            cb.get(testkey3, function (err, doc, meta) {
                assert(!err);
                setup.end();
            });
        });
    });

    // Lock block sets with keys.
    cb.set(testkey4, "{bam}", function (err, meta) {
        assert(!err, "Failed to store object");
        assert.equal(testkey4, meta.id, "Callback called with wrong key!");

        cb.getAndLock(testkey4, 1, function (err, doc, meta) {
            assert.equal(testkey4, meta.id, "Callback called with wrong key!");
            assert.equal("{bam}", doc, "Callback called with wrong value!");

            cb.set(testkey4, 'nothing', function (err, doc, meta) {
                assert(err);
                setup.end();
            });
        });
    });

    // Lock shouldn't block sets with cas.
    cb.set(testkey5, "{bark}", function (err, meta) {
        assert(!err, "Failed to store object");
        assert.equal(testkey5, meta.id, "Callback called with wrong key!");

        cb.getAndLock(testkey5, 1, function (err, doc, meta) {
            assert.equal(testkey5, meta.id, "Callback called with wrong key!");
            assert.equal("{bark}", doc, "Callback called with wrong value!");

            cb.set(testkey5, "nothing", meta, function (err, doc, meta) {
                assert(!err, "Failed to overwrite locked key by using cas.");

                cb.get(testkey5, function (err, doc, meta) {
                    assert (!err, "Failed to get key");
                    assert.equal(testkey5, meta.id, "Callback called with wrong key!");
                    assert.equal("nothing", doc, "Callback called with wrong value!");

                    setup.end();
                });
            });
        });
    });

    // Unlock reverts lock.
    cb.set(testkey6, "{boo}", function (err, meta) {
        assert(!err, "Failed to store object");
        assert.equal(testkey6, meta.id, "Callback called with wrong key!");

        cb.getAndLock(testkey6, 1, function (err, doc, meta) {
            assert.equal(testkey6, meta.id, "Callback called with wrong key!");
            assert.equal("{boo}", doc, "Callback called with wrong value!");

            cb.unlock({ key: testkey6, cas: meta.cas }, function (err, doc, meta) {
                assert(!err, "Failed to unlock.");

                cb.set(testkey6, 'hello', function (err, doc, meta) {
                    assert(!err, 'Failed to set on unlocked key.');
                    setup.end();
                });
            });
        });
    });
});

