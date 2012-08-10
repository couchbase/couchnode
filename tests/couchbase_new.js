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

// http://stackoverflow.com/questions/610406/javascript-equivalent-to-printf-string-format
String.prototype.format = function() {
  var args = arguments;
  return this.replace(/{(\d+)}/g, function(match, number) {
    return typeof args[number] != 'undefined'
      ? args[number]
      : match
    ;
  });
};


// Declare globals first
var driver = require('couchbase');
var handles = [];
var max_handles = process.argv[2];
if (!max_handles) {
    max_handles = 10;
}

function seriesPosthook(cb) {
    cb.remaining--;
    if (cb.remaining == 0) {
        console.log("Removing %d from global array", cb.id);
        delete handles[cb.id];
    }
}

// A callback function that is called from libcouchbase
// when it encounters a problem without an operation context
//
function errorHandler(errorMessage) {
    console.log("ERROR: [" + errorMessage + "]");
    process.exit(1);
}

function storageHandler(data, error, key, cas) {
    str = "[ID={0}] Store '{1}' : Error: {2}, CAS: {3}".format(
        data[0].id + ":" + data[1],
        key, error, cas);

    console.log(str);
    seriesPosthook(data[0])
}

function getHandler(data, error, key, cas, flags, value) {
    str = "[ID={0}] Get '{1}' => '{2}' (err={3}, cas={4} flags={5})".format(
        data[0].id + ":" + data[1],
        key, value, error, cas, flags
    );
    console.log(str);
    seriesPosthook(data[0]);
}

// Load the driver and create an instance that connects
// to our cluster running at "myserver:8091"

function on_connect(cb) {
    console.log("Requesting operations for " + cb.id);

    var ops = [
        [ cb.add, "key", "add", 0, 0, storageHandler],
        [ cb.replace, "key", "replaced", 0, 0, storageHandler],
        [ cb.set, "key", "set", 0, 0, storageHandler],
        [ cb.append, "key", "append", 0, 0, storageHandler],
        [ cb.prepend, "key", "prepend", 0, 0, storageHandler],
        [ cb.get, "key", 0, getHandler],
        [ cb.arithmetic, "numeric", 42, 0, 0, 0, getHandler],

        [ cb.delete, "key", 0,
         function(data, error, key) {
            console.log("id={0}: Custom remove handler for {1} (err={2})".
                        format(data[0].id, key, error));
        }]
    ];

    cb.remaining = 0;

    for (var i = 0; i < ops.length; i++) {

        var fnparams = ops[i];
        var fn = fnparams.shift();
        fnparams.push([cb, fn.name]);
        fn.apply(cb, fnparams);
    }

    cb.remaining = i-1;
}

for (var i = 0; i < max_handles; i++) {
    var cb = new driver.Couchbase(
            "localhost:8091");

    cb.id = i + 0;
    var cberr = (function(iter) {
        return function() {
            console.log("Error handler for " + iter);
            errorHandler.apply(this, arguments);
        }
    })(cb.id);
    cb.on("error", cberr);

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
