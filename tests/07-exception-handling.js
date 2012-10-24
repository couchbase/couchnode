var setup = require('./setup'),
    assert = require('assert');

// something is breaking standard node.js exception behavior,
// this will turn out to be an issue for any serious user.

// there is not a simple way to test this, except to ask you to
// comment out different code paths... so please try this with
// normal set to true or false depending.

// var useCouchbase = false;
var useCouchbase = true;

process.on("uncaughtException", function() {
    // console.log("uncaughtException", arguments)
    // console.log("exiting")
    process.exit()
})

if (!useCouchbase) {
    // lets do something async just to minimize the difference between
    // the normal case and the Couchbase case
    setTimeout(function() {
        assert(false, "should exit after error")
    },100)
} else {
    // with couchbase started up, the exceptions aren't handled right
    setup(function(err, cb) {
        // uncomment this line to see the same issue with
        // non-assert based exceptions.
        // foobar()
        assert(false, "should exit after error")
    })
}


