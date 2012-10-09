var couchnode = require('../build/Release/couchbase_impl'),
    bucket = require('./bucket'),
    verbose = false; // change to true to spew debug info

// Helper functions, see below for public API methods
function debugLog() {
    if (verbose) {
        console.log.apply(console, arguments);
    }
};

function callOnce(callback) {
    var called = false;
    return function() {
        if (called) return;
        called = true;
        callback.apply(this, arguments);
    };
};

function prepareConfig(config) {
    var defaults = {
        hosts : [ "localhost:8091", "localhost:9000" ],
        bucket : "default",
        password : "asdasd",
        user : "Administrator"
    };
    config = config || defaults;
    ["hosts", "bucket", "password", "user"].forEach(function(key) {
        if (config[key] == undefined) {
            config[key] = defaults[key];
        }
    });
    debugLog('Using the following config:', config);
    return config;
};

// ============ PUBLIC API ============

// Initialize a new connection
// it calls your callback with the bucket object
exports.connect = function(config, callback) {
    config = prepareConfig(config);
    var hosts = config.hosts.toString().replace(/,/g,';'),
        connection = new couchnode.CouchbaseImpl(hosts, config.user, config.password, config.bucket);

    // here we merge the responses to give a more idiomatic API
    // todo this could probably be done more cleanly in C-land
    var callbackOnce = callOnce(callback);

    connection.on("connect", function() {
        debugLog("connected", arguments);
        callbackOnce(false, bucket.create(connection));
    });
    connection.on("error", function(error) {
        debugLog("connection error", arguments);
        callbackOnce(error)
    });
};
