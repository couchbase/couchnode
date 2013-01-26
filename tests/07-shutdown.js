var setup = require('./setup');
process.exit(64);
// Ensure that the application stops when we've shutdown the bucket
setup(function(err, cb) {
    cb.shutdown();
});
