var setup = require('./setup'),
    assert = require('assert');

setup(function(err, cb) {
    assert(!err, "setup failure");

    cb.on("error", function (message) {
        console.log("ERROR: [" + message + "]");
        process.exit(1);
    });

    var calledTimes = 0,
        testkey = "12-observe.js"

    cb.set(testkey, "bar", function(err,meta) {
        assert(!err, "Failed to store object");

        cb.observe(testkey, function(err, meta) {
            if( calledTimes == 0 ) {
                // First callback should not be the terminator
                assert(!err, "Failed to get observe data");
                assert(meta, "Invalid observe data");
            } else if( calledTimes >= 1 ) {
                if( meta ) {
                    // This is another replica
                    assert(!err, "Failed to get observe data");
                    assert(meta, "Invalid observe data");
                } else {
                    // This is the terminator
                    assert(!err)
                    assert(!meta)
                    process.exit(0);
                }
            }

            calledTimes++;
        });
    });
});
