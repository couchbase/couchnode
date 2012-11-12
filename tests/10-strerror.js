var setup = require('./setup'),
    assert = require('assert');

setup(function(err, cb) {
    assert(!err, "setup failure");

    // Make sure an invalid errorCode doesn't crash anything
    cb.strError(1000);

    // Make sure we can get error strings properly
    assert( cb.strError(0) == 'Success', 'Error strings are being returned incorrectly' );

    process.exit(0);
})
