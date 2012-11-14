var setup = require('./setup'),
    assert = require('assert');

setup(function(err, cb) {
    assert(!err, "setup failure");

    cb.on("error", function (message) {
        console.log("ERROR: [" + message + "]");
        process.exit(1);
    });

    var testkey = "06-add.js"

    cb.remove(testkey, function(){
        cb.add(testkey, "bar", function(err, meta) {
            assert(!err, "Can add object at empty key");
            assert.equal(testkey, meta.id, "Callback called with wrong key!")
            // try to add existing key, should fail
            cb.add(testkey, "baz", function (err, meta) {
                assert(err, "Can't add object at empty key");
                process.exit(0)
            });
        });
    });
})
