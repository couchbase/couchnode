var setup = require('./setup'),
    assert = require('assert');

setup(function(err, cb) {
    assert(!err, "setup failure");

    cb.on("error", function (message) {
        console.log("ERROR: [" + message + "]");
        process.exit(1);
    });

    // create a bunch of items and get them with multiget
    var calledTimes = 0,
        keys = ["key0", "key1", "key2", "key3", "key4",
            "key5", "key6", "key7", "key8", "key9"];

    function setHandler(err) {
        assert(!err, "set error")
        calledTimes++;
        if (calledTimes > 9) {
            calledTimes = 0;
            doGets();
        }
    };

    keys.forEach(function(k) {
        cb.set(k, "value", setHandler);
    })

    function getHandler(err, doc, meta) {
        assert(!err, "get error")
        calledTimes++;
        if (calledTimes > 9) {
            process.exit(0);
        }
    };

    function doGets() {
        // normal get
        cb.get("key0", function(err, meta) {
            assert(!err, "get error");
            // multiget
            cb.get(keys, getHandler);
        })
    };
})
