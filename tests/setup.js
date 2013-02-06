var cb = require('../lib/couchbase.js'),
    fs = require('fs'),
    util = require('util');

var assert = require('assert');
var old_toString = assert.AssertionError.prototype.toString;

assert.AssertionError.prototype.toString = function() {
    var ret = util.format(
            "Caught '%s', at:\n%s",
            old_toString.call(this),
            this.stack
    );
    return ret;
};

var config;
var configFilename = 'config.json';

if (fs.existsSync(configFilename)) {
    config = JSON.parse(fs.readFileSync(configFilename));

} else {
    console.log(configFilename + " not found. Using default test setup..");
    config = {
        hosts : [ "localhost:8091" ],
        bucket : "default"
    };
}

module.exports = function(callback) {
//    setTimeout(function() {
//        console.log("timeout, assuming failure")
//        process.exit(1)
//    }, 10000);
    // Instead of waiting for the test to time out if we
    // can't connect to the cluster, lets bail out immediately
    cb.connect(config, function(err, cb) {
        if (err) {
            console.log("Filed to connect to the cluster")
            process.exit(1)
        } else {
            callback(err, cb);
        }
    });
};

// very lightweight "test framework"
var planned = 1;
module.exports.plan = function(count) {
    planned = count;
};
module.exports.end = function(code) {
    if (code > 0) {
        process.exit(code)
    } else {
        planned--;
        if (!planned) {
            process.exit(0);
        }
    }
};
