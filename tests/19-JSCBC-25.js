var setup = require('./setup'),
    assert = require('assert');

setup(function(err, cb) {
    assert(!err, "setup failure");
    keys = [[1,2,3],[4,6,3]];
    try {
        cb.get(keys,
               function (err, doc, meta) {
                   console.log('All bad', err);
               });
        assert(false, "Invalid keys should throw exceptions");
    } catch (err) {
    }

    keys = [1];
    try {
        cb.get(keys,
               function (err, doc, meta) {
                   console.log('All bad', err);
               });
        assert(false, "Invalid keys should throw exceptions");
    } catch (err) {
    }

    cb.shutdown();
});
