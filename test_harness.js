"use strict";

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
    mock : false,
    host : 'localhost:8091',
    queryhosts : 'localhost:8093',
    bucket : 'default',
    operationTimeout : 20000,
    connectionTimeout : 20000
  };
}

if (process.env.CNMOCK !== undefined) {
  config.mock = process.env.CNMOCK ? true : false;
}
if (process.env.CNHOST !== undefined) {
  config.host = process.env.CNHOST;
}
if (process.env.CNQHOSTS !== undefined) {
  config.queryhosts = process.env.CNQHOSTS;
}
if (process.env.CNBUCKET !== undefined) {
  config.bucket = process.env.CNBUCKET;
}

if (config.mock) {
  couchbase = couchbase.Mock;
}
var isMock = config.mock;
delete config.mock;


function Harness(callback) {
  this.client = this.newClient();
  this.lib = couchbase;
  this.errors = couchbase.errors;
  this.format = couchbase.format;
  this.keySerial = 0;
}

Harness.prototype.newClient = function(callback) {
  return new couchbase.Connection(config, callback);
};

Harness.prototype.genKey = function(prefix) {
  if (!prefix) {
    prefix = "generic";
  }

  var ret = "TEST-" +
    (process.env.CNTESTPREFIX ? process.env.CNTESTPREFIX : process.pid) +
    '-' + prefix + this.keySerial;
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

// Skips the test if in no-mock mode.
Harness.prototype.nmIt = function(name, func) {
  if (!isMock) {
    it(name, func);
  } else {
    it.skip(name, func);
  }
};

module.exports = new Harness();
