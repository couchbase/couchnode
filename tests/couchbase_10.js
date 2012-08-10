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

// A callback function that is called from libcouchbase
// when it encounters a problem without an operation context
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
var driver = require('couchbase');
var handles = [];

for (var i = 0; i < 10; i++) {
    var cb = new driver.Couchbase("localhost:8091",
            "Administrator",
            "123456",
            "membase0");

    cb.id = "Couchbase " + i;
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
        }
    })(cb.id);
    cb.setGetHandler(cbget);

    var cbset = (function(iter) {
        return function() {
            console.log("Got storage handler for " + iter);
            storageHandler.apply(this, arguments);
        }
    })(cb.id);
    cb.setStorageHandler(cbset);

    // Try to connect to the server
    if (!cb.connect()) {
        console.log("Failed to connect! [" + cb.getLastError() + "]");
        process.exit(1);
    }

    console.log("Created new handle " + cb.id);
    handles[i] = cb;
}

// We set a manual delay because we don't currently have a way of being
// notified when things are connected

setTimeout(function() {
    for (var i in handles) {
        var cb = handles[i];
        console.log("Requesting operations for " + cb.id);
        cb.add("key", "add");
        cb.replace("key", "replaced");
        cb.set("key", "set");
        cb.append("key", "append");
        cb.prepend("key", "prepend");
        cb.get("key");
    }
}, 2000);
