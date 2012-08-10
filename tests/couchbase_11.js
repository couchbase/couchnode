/* -*- Mode: JS; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012 Couchbase, Inc.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */


// Declare globals first
var driver = require('couchbase');
var handles = [];

function seriesPosthook(cb) {
    cb.remaining--;
    if (cb.remaining == 0) {
        console.log("Destroying " + cb.id);
        delete handles[cb.id];
        console.log(handles);
    } else {
        console.log("Handle " + cb.id + " Still has " + cb.remaining + 
                " Operations");
    }
}

// A callback function that is called from libcouchbase
// when it encounters a problem without an operation context
//
function errorHandler(errorMessage) {
    console.log("ERROR: [" + errorMessage + "]");
    process.exit(1);
}

// A callback function that is called for get requests
function getHandler(state, key, value, flags, cas) {
    if (state) {
        console.log("Found \"" + key + "\" - [" + value + "]");
    } else {
        console.log("Get failed for \"" + key + "\" [" + value + "]");
    }
}

// A callback function that is called for storage requests
function storageHandler(state, key, cas) {
    if (state) {
        console.log("Stored \"" + key + "\" - [" + cas + "]");
    } else {
        console.log("Failed to store \"" + key + "\" [" + cas + "]");
    }
}

// Load the driver and create an instance that connects
// to our cluster running at "myserver:8091"

function on_connect(cb) {
    console.log("Requesting operations for " + cb.id);

    var ops = [
        [ cb.add, "key", "add" ],
        [ cb.replace, "key", "replaced" ],
        [ cb.set, "key", "set" ],
        [ cb.append, "key", "append" ],
        [ cb.prepend, "key", "prepend" ],
        [ cb.get, "key" ]
    ];

    cb.remaining = 0;

    for (var i = 0; i < ops.length; i++) {
        var op = ops[i];
        var fn = op[0];
        if (op.length == 3) {
            fn.call(cb, op[1], op[2]);
        } else {
            fn.call(cb, op[1]);
        }
        cb.remaining++;
    }
    return;
}

for (var i = 0; i < 10; i++) {
    var cb = new driver.Couchbase(
            "localhost:8091",
            "Administrator",
            "123456",
            "membase0");

    cb.id = i + 0;
    var cberr = (function(iter) {
        return function() {
            console.log("Error handler for " + iter);
            errorHandler.apply(this, arguments);
        }
    })(cb.id);
    cb.setErrorHandler(cberr);

    var cbget = (function(iter) {
        return function() {
            console.log("Get handler for " + iter);
            getHandler.apply(this, arguments);
            seriesPosthook(handles[iter]);
        }
    })(cb.id);
    cb.setGetHandler(cbget);

    var cbset = (function(iter) {
        return function() {
            console.log("Got storage handler for " + iter);
            storageHandler.apply(this, arguments);
            seriesPosthook(handles[iter]);
        }
    })(cb.id);
    cb.setStorageHandler(cbset);

    // Try to connect to the server
    var clofn = function (cbv) {
        return function() { 
            on_connect(cbv);
        }
    };

    if (!cb.connect(clofn(cb))) {
        console.log("Failed to connect! [" + cb.getLastError() + "]");
        process.exit(1);
    }
    console.log("Created new handle " + cb.id);
    handles[i] = cb;
}
