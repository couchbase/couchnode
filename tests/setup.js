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
    // this is turned off because it doesn't seem to work...
    // process.on("uncaughtException", function() {
    //     console.log("uncaughtException", arguments)
    //     process.exit(1)
    // })
    setTimeout(function() {
        console.log("timeout, assuming failure")
        process.exit(1)
    }, 10000)
    cb.connect(config, callback);
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
