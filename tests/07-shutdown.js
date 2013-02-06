var setup = require('./setup');

// Ensure that the application stops when we've shutdown the bucket
setup(function(err, cb) {
    cb.shutdown();
});
