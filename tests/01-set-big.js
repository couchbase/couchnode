var setup = require('./setup');
var assert = require('assert');
var util = require("util");

setup.plan(1);

setup(function(err, cb) {
    assert(!err, "setup failure");

    cb.on("error", function (message) {
        console.log("ERROR: [" + message + "]");
        process.exit(1);
    });

    // test cas updates
    var testkey = "01-set-big.js"
    var object = "";
    for (var ii = 0; ii < 8192; ++ii) {
       object += "012345678\n";
    }

    cb.set(testkey, object, function (err, firstmeta) {
        assert(!err, "Failed to store object");
        setup.end();
    });
})
