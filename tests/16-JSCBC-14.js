var setup = require('./setup'),
    assert = require('assert');

var max=60000;
var current=0;

setup(function(err, cb) {
    assert(!err, "setup failure");

    cb.on("error", function (message) {
        console.log("ERROR: [" + message + "]");
        process.exit(1);
    });


    for (var i=0; i < max; ++i){
	cb.set("new_"+i, "something", function(err, meta) {
            assert(!err, "Failed to store value");
            ++current;
            if (current == max) {
               process.exit(0);
            }
	})
    }
});
