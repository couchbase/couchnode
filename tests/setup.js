var cb = require('../lib/couchbase.js'),
    fs = require('fs');

var config = JSON.parse(fs.readFileSync('./config.json'));

module.exports = function(callback) {
    // this is turned off because it doesn't seem to work...
    // process.on("uncaughtException", function() {
    //     console.log("uncaughtException", arguments)
    //     process.exit(1)
    // })
    setTimeout(function() {
        console.log("timeout, assuming failure")
        process.exit(1)
    }, 1000)
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