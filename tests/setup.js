var couchbase = require('../lib/couchbase.js'),
    fs = require('fs'),
    util = require('util');

var assert = require('assert');
var config;
var configFilename = 'config.json';

if (fs.existsSync(configFilename)) {
    config = JSON.parse(fs.readFileSync(configFilename));

} else {
    config = {
        hosts : [ "localhost:8091" ],
        bucket : "default",
        operationTimeout : 20000,
        connectionTimeout : 20000
    };
}

module.exports = function(callback) {
    var cb = new couchbase.Connection(config, function(err) {
        if (err) {
            console.error("Failed to connect to cluster: " + err);
            process.exit(1);
        }
        callback(err, cb);
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
