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
var cb = new driver.Couchbase("freebsd:9000");

// Set up the handlers
cb.setErrorHandler(errorHandler);
cb.setGetHandler(getHandler);
cb.setStorageHandler(storageHandler);

// Try to connect to the server
if (!cb.connect()) {
	console.log("Failed to connect! [" + cb.getLastError() + "]");
	process.exit(1);
}
// Wait for the connect attempt to complete
cb.wait();

// Schedule a couple of operations
cb.add(function onAdd(state, key, cas) {
	if (state) {
		console.log("Added \"" + key + "\" - [" + cas + "]");
	} else {
		console.log("Failed to add \"" + key + "\" [" + cas + "]");
	}
}, "key", "add")
cb.replace("key", "replaced")
cb.set("key", "set")
cb.append("key", "append")
cb.prepend("key", "prepend")
cb.get(function onGet(state, key, value, flags, cas) {
	if (state) {
		console.log("onGet found \"" + key + "\" - [" + value + "]");
	} else {
		console.log("onGet failed for \"" + key + "\" [" + value + "]");
	}
}, "key", "bar");

cb.get("key2", "bar2");


// Wait for all operations to complete
cb.wait();

// console.log(cb.getVersion());
// console.log(cb.getTimeout());
// cb.setTimeout(1000);
// console.log(cb.getTimeout());
// console.log(cb.getRestUri());
// console.log(cb.isSynchronous());
// cb.setSynchronous(true);
// console.log(cb.isSynchronous());
