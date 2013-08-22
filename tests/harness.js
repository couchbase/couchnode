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
    host : [ "localhost:8091" ],
    bucket : "default",
    operationTimeout : 20000,
    connectionTimeout : 20000
  };
}

function Harness(callback) {
  this.client = new couchbase.Connection(config, callback);
  this.keySerial = 0;
}

Harness.prototype.genKey = function(prefix) {
  if (!prefix) {
    prefix = "generic";
  }

  var ret = "JSCBC-test-" + prefix + this.keySerial;
  this.keySerial++;
  return ret;
};

Harness.prototype.genMultiKeys = function(count, prefix) {
  var ret = {};
  for (var i = 0; i < count; i++) {
    var key = this.genKey(prefix);
    ret[key] = { value: "value_for_" + key };
  }
  return ret;
};

Harness.prototype.okCallback = function(target) {
  // Get the stack
  var stack = new Error().stack;

  return function(err, meta) {
    if (err) {
      console.dir(arguments);
      console.log("Got error (created @):" + stack);
      assert(!err, "Got unrecognized error: " + util.inspect(err));
    }
    assert(typeof meta === "object", "Meta is missing");
    target(meta);
  }
};

Harness.prototype.docCallback = function(target) {
  return this.okCallback(function(meta){
    assert('value' in meta);
    target(meta.value);
  });
};

Harness.prototype.setGet = function(key, value, callback) {
  var o = this;
  o.client.set(key, value, o.okCallback(function(meta) {
    o.client.get(key, o.docCallback(callback));
  }))
};



module.exports.create = function(callback) {
  return new Harness(callback);
};

module.exports.Harness = Harness;

// very lightweight "test framework"
var planned;
var executed = 0;
module.exports.plan = function(count) {
  planned = count;
};
module.exports.end = function(code) {
  if (code > 0) {
    console.log("Test failed with code: " + code);
    process.exit(code)

  } else {
    executed++;
    if (executed == planned) {
        process.exit(0);
      }
  }
};

module.exports.skipAll = function(msg) {
  console.trace("Skipping all tests in file: " + msg);
  executed = planned = -1;
  process.exit(0);
}

module.exports.lib = couchbase;

process.on('uncaughtException', function(err){
  console.log("Got uncaught error: " + err);
  console.log(err.stack);
  process.exit(1);
});

process.on('exit', function(){
  if (planned != executed) {
    console.error(util.format("Planned %d. Ran %d",
                              planned, executed));
    process.abort();
  }
})
