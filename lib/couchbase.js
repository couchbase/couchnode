var couchnode = require("bindings")("couchbase_impl");
var bucket = require("./bucket");

function callOnce(callback) {
    var called = false;
    return function() {
        if (called) return;
        called = true;
        callback.apply(this, arguments);
    };
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
    serverBug: 0x1d
};

exports.observeStatus = {
    found: 0x00,
    persisted: 0x01,
    notFound: 0x80
};

// Initialize a new connection
// it calls your callback with the bucket object
exports.connect = function(config, callback) {
    if (config == undefined) {
	config = {};
    }
    if (config.debug) console.log("Using the following config: ", config);

    if (config.hosts == undefined) {
	config.hosts = [];
    }

    var hosts = config.hosts.toString().replace(/,/g,';');
    var connection = new couchnode.CouchbaseImpl(hosts, config.user, config.password, config.bucket);

    // here we merge the responses to give a more idiomatic API
    // todo this could probably be done more cleanly in C-land
    var callbackOnce = callOnce(callback);

    connection.on("connect", function() {
        if (config.debug) console.log("connected", arguments);
        bucket.create(connection, config, function (readyBucket) {
            callbackOnce(false, readyBucket);
        })
    });
    connection.on("error", function(errorCode) {
        if (config.debug) console.log("connection error", arguments);
        errObj = new Error("Connect Error");
        errObj.code = errorCode;
        callbackOnce(errObj);
    });
};
