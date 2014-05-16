/**
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
 *
 *   (for jsdoc)
 *   @copyright 2013 Couchbase, Inc.
 */

var Util = require("util");

var keyMode = {
    single: 1,
    rotating: 2,
    increasing: 3
};

// Configuration

var globalConfig = {
    // Maximum amount of clients to operate concurrently
    maxClients: 20,

    // How many individual 'threads' scheduling the same key/value
    maxSchedulers: 5,

    // Maximum operations to execute before exiting
    maxOperations: 10000000,

    // Bucket to connect to
    bucket: "default",

    // Password for bucket
    password: "",

    // Hostname to use
    host: "127.0.0.1",

    // Memcached port (for use with 3rd eden)
    memcachedPort: 11210,

    // Default value size to use
    valueSize: 30,

    keyMode: keyMode.rotating
};

var currentOperations = 0;
var keyCounter = 0;
var key = "keybase_PID[" + process.pid + "]#";
var value = "valbase";
var remaining = 0;
/* How many operations are remaining */

var rotatingKeyList = [];
var rotatingKeyIndex = 0;

function setupDefaults() {

    for (var i = 0; i < globalConfig.valueSize; i++) {
        value += '*';
    }

    remaining = globalConfig.maxOperations;

}


for (var i = 0; i < 20; i++) {
    rotatingKeyList[i] = key + "_seq_"+i;
}

function getKey() {
    if (globalConfig.keyMode === keyMode.single) {
        return key;
    } else if (globalConfig.keyMode === keyMode.rotating) {
        rotatingKeyIndex = (rotatingKeyIndex + 1) % rotatingKeyList.length;
        return rotatingKeyList[rotatingKeyIndex];
    } else {
        keyCounter++;
        return key + keyCounter;
    }
}


var BEGIN_TIME = Date.now();

setInterval(function(arg) {
    // Get time elapsed
    var elapsedTime = (Date.now() - BEGIN_TIME) / 1000;
    var opsPerSecond = currentOperations / elapsedTime;
    var s = Util.format("Elapsed: %d; Ops=%d [%d]/S",
        elapsedTime,
        currentOperations,
        Math.round(opsPerSecond));
    for (var i = 0; i < 20; i++) {
        s+= ' ';
    }
    process.stdout.write(s + "\r");
}, 100, null);


function markOperation(err) {
    if (err) {
        throw new Error("Got err: " + err);
    }
    currentOperations++;
    remaining--;
    if (!remaining) {
        console.log("");
        console.log("Done!")
        process.exit(1);
    }
}


function scheduleMemcached(cb) {
    var curKey = getKey();
    cb.set(curKey, value, 0, function(err) {
        markOperation(err);

        cb.get(curKey, function(err, result) {
            markOperation(err);
            scheduleMemcached(cb);
        });
    });
}

function scheduleCouchbase(cb) {
    var curKey = getKey();
    cb.set(curKey, value, {}, function(err, result) {
        markOperation(err);
        cb.get(curKey, function(err, result) {
            markOperation(err);
            scheduleCouchbase(cb);
        })
    })
}

function scheduleNode(cb) {
    var curKey = getKey();
    cb.Set(curKey, value, function(err, result) {
        markOperation(err);
        cb.Get(curKey, function(err, result) {
            markOperation(err);
            scheduleNode(cb);
        });
    });
}

function scheduleOps(fn, client) {
    for (var ii = 0; ii < globalConfig.maxSchedulers; ii++) {
        fn(client);
    }
}


function launchMemcachedClient() {
    var Memcached = require('memcached');
    var mc = new Memcached(globalConfig.host + ":" + globalConfig.memcachedPort);
    scheduleOps(scheduleMemcached, mc);
}

function launchCouchbaseClient() {
    var Couchbase = require('../lib/couchbase.js');

    var cbOptions = {
        bucket: globalConfig.bucket,
        host: globalConfig.host,
        password: globalConfig.password
    };

    var cb = new Couchbase.Connection(cbOptions, function(err) {
        if (err) {
            console.log("Got error on connect: " + err);
            process.exit(1);
        } else {
            console.log("Connected!");
        }
    });
    scheduleOps(scheduleCouchbase, cb);
}

function launchNodeCouchbase() {
    var NodeCouchbase = require('node-couchbase');
    var cb = new NodeCouchbase([globalConfig.host + ':8091'],
                               globalConfig.bucket,
                               globalConfig.password);
    cb.on('connected', function() {
        scheduleOps(scheduleNode, cb);
    });
}

// Parse the configuration
var optimist = require('optimist');
var optionMap = {
    'max-clients': 'maxClients',
    'bucket': 'bucket',
    'value-size': 'valueSize',
    'keymode': 'keyMode',
    'max-operations': 'maxOperations',
    'max-schedulers': 'maxSchedulers',
    'host': 'host',
    'memcached-port': 'memcachedPort'
};

for (var k in optionMap) {
    var globalKey = optionMap[k];
    optimist.default(k, globalConfig[globalKey]);
}

optimist.default('lib', 'couchnode');
var argv = optimist.argv;

for (var k in argv) {
    if (!k in optionMap) {
        continue;
    }
    globalConfig[optionMap[k]] = argv[k];
}

var keyModeFound = false;
for (var k in keyMode) {
    if (globalConfig.keyMode == k) {
        globalConfig.keyMode = keyMode[k];
        keyModeFound = true;
        break;
    } else if (globalConfig.keyMode == keyMode[k]) {
        keyModeFound = true;
        break;
    }
}
if (!keyModeFound) {
    throw new Error("Invalid keymode: " + globalConfig.keyMode);
}

setupDefaults();

if (argv.help || argv.h) {
    optimist.showHelp();
    process.exit(0);
}

for (var i = 0; i < globalConfig.maxClients; i++) {
    if (argv.lib == "memcached") {
        //console.log("Starting Memcached");
        launchMemcachedClient();
    } else if (argv.lib == "node-couchbase") {
        launchNodeCouchbase();
    } else {
        launchCouchbaseClient();
    }
}

/** OUTPUT:
 * Note that for accurate results, you should run the test with both libraries
 * against a memcached bucket. Ensure that the bucket has a "Dedicated Port" so
 * that the eden memcached client can connect to it.
 *
mnunberg@csure:~/src/couchnode$ node ./benchmarks/memdbench.js --lib couchbase --bucket memd --max-operations 1000000
Connected!.256; Ops=0 [0]/S                    
Connected!
Connected!
Connected!
Connected!
Connected!
Connected!
Connected!
Connected!
Connected!
Connected!
Connected!
Connected!
Connected!
Connected!
Connected!
Connected!
Connected!
Connected!
Connected!
Elapsed: 38.878; Ops=997880 [25667]/S                    
Done!

mnunberg@csure:~/src/couchnode$ node ./benchmarks/memdbench.js --lib memcached --memcached-port 11212 --max-operations 1000000
Elapsed: 80.76; Ops=999004 [12370]/S                     
Done!
**/
