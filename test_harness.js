var couchbase = require('./lib/couchbase.js'),
  fs = require('fs'),
  util = require('util');
var assert = require('assert');

var config;
var configFilename = 'config.json';

if (fs.existsSync(configFilename)) {
  config = JSON.parse(fs.readFileSync(configFilename));
} else {
  config = {
    host : "localhost:8091",
    bucket : "default",
    operationTimeout : 20000,
    connectionTimeout : 20000
  };
}

function Harness(callback) {
  this.client = new couchbase.Connection(config, callback);
  this.keySerial = 0;
}

Harness.prototype.newClient = function(callback) {
  return new couchbase.Connection(config, callback);
};

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

  return function(err, result) {
    if (err) {
      console.dir(arguments);
      console.log("Got error (created @):" + stack);
      assert(!err, "Got unrecognized error: " + util.inspect(err));
    }
    assert(typeof result === "object", "Meta is missing");
    target(result);
  };
};

Harness.prototype.setGet = function(key, value, callback) {
  var o = this;
  o.client.set(key, value, o.okCallback(function(result) {
    o.client.get(key, o.okCallback(function(result) {
      callback(result.value);
    }));
  }));
};

module.exports = new Harness();
