var couchnode = require('bindings')('couchbase_impl'),
    bucket = require(__dirname + '/bucket'),
    verbose = false; // change to true to spew debug info

// Helper functions, see below for public API methods
function debugLog() {
    if (verbose) {
        console.log.apply(console, arguments);
    }
}

function callOnce(callback) {
    var called = false;
    return function() {
        if (called) return;
        called = true;
        callback.apply(this, arguments);
    };
}

function prepareConfig(config) {
    var defaults = {
        hosts : [ "localhost:8091" ],
        bucket : "default"
    };
    config = config || defaults;
    ["hosts", "bucket"].forEach(function(key) {
        if (config[key] == undefined) {
            config[key] = defaults[key];
        }
    });
    debugLog('Using the following config:', config);
    return config;
}

// ============ PUBLIC API ============

// List of error codes that can be returned from most calls
exports.errors = {
    success: 0x00,
    authContinue: 0x01,
    authError: 0x02,
    deltaBadVal: 0x03,
    objectTooBig: 0x04,
    serverBusy: 0x05,
    internal: 0x06,
    invalidArguement: 0x07,
    outOfMemory: 0x08,
    invalidRange: 0x09,
    genericError: 0x0a,
    temporaryError: 0x0b,
    keyAlreadyExists: 0x0c,
    keyNotFound: 0x0d,
    failedToOpenSymbol: 0x0e,
    failedToFindSymbol: 0x0f,
    networkError: 0x10,
    wrongServer: 0x11,
    notStored: 0x12,
    notSupported: 0x13,
    unknownCommand: 0x14,
    unknownHost: 0x15,
    protocolError: 0x16,
    timedOut: 0x17,
    connectError: 0x18,
    bucketNotFound: 0x19,
    clientOutOfMemory: 0x1a,
    clientTemporaryError: 0x1b,
    badHandle: 0x1c,
    serverBug: 0x1d,

    maxErrorVal: 0x1d
};

exports.observeStatus = {
    found: 0x00,
    persisted: 0x01,
    notFound: 0x80
};

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
        bucket.create(connection, config, function (readyBucket) {
            callbackOnce(false, readyBucket);
        })
    });
    connection.on("error", function(errorCode) {
        debugLog("connection error", arguments);
        errObj = new Error( 'Connect Error' );
        errObj.code = errorCode;
        callbackOnce(errObj);
    });
};
