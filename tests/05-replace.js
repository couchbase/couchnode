var setup = require('./setup'),
    assert = require('assert');

setup(function(err, cb) {
    assert(!err, "setup failure");

    cb.on("error", function (message) {
        console.log("ERROR: [" + message + "]");
        process.exit(1);
    });

    var testkey = "05-replace.js"

    cb.remove(testkey, function(){
        // try to replace a missing key, should fail
        cb.replace(testkey, "bar", function(err, meta) {
            assert(err, "Can't replace object that is already removed");
            cb.set(testkey, "bar", function (err, meta) {
                assert(!err, "Failed to store object");
                cb.replace(testkey, "bazz", function (err, meta) {
                    assert(!err, "Failed to replace object");
                    cb.get(testkey, function (err, doc) {
                        assert(!err, "Failed to get object");
                        assert.equal("bazz", doc, "Replace didn't work")
                        process.exit(0);
                    })
                });
            });
        });
    });
})
