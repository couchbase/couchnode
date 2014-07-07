'use strict';

var couchbase = require('./../lib/couchbase.js');
var fs = require('fs');
var util = require('util');
var assert = require('assert');

var config = {
  connstr: 'http://localhost:8091/',
  bucket : 'default',
  bpass  : '',
  muser  : 'Administrator',
  mpass  : 'administrator',
  qhosts : null
};

if (process.env.CNCSTR !== undefined) {
  config.connstr = process.env.CNCSTR;
}
if (process.env.CNQHOSTS !== undefined) {
  config.qhosts = process.env.CNQHOSTS;
}
if (process.env.CNBUCKET !== undefined) {
  config.bucket = process.env.CNBUCKET;
}
if (process.env.CNBPASS !== undefined) {
  config.mpass = process.env.CNBPASS;
}
if (process.env.CNMUSER !== undefined) {
  config.muser = process.env.CNMUSER;
}
if (process.env.CNMPASS !== undefined) {
  config.mpass = process.env.CNMPASS;
}

function Harness() {
  this.keyPrefix = (new Date()).getTime();
  this.keySerial = 0;
}

Harness.prototype.key = function() {
  return 'tk-' + this.keyPrefix + '-' + this.keySerial++;
};

Harness.prototype.noCallback = function() {
  return function() {
    throw new Error('callback should not have been invoked');
  };
};

Harness.prototype.okCallback = function(target) {
  var stack = (new Error()).stack;
  return function(err, res) {
    if (err) {
      console.log(stack);
      console.log(err);
      assert(!err, err);
    }
    assert(typeof res === 'object', 'Result is missing');
    target(res);
  };
};

function MockHarness() {
  Harness.call(this);

  this.connstr = 'couchbase://mock-server';
  this.bucket = 'default';
  this.qhosts = null;

  this.lib = couchbase.Mock;

  this.e = this.lib.errors;
  this.c = new this.lib.Cluster(this.connstr);
  this.b = this.c.openBucket(this.bucket);
  if (this.qhosts) {
    this.b.enableN1ql(this.qhosts);
  }

  this.mock = this;
}
util.inherits(MockHarness, Harness);

function RealHarness() {
  Harness.call(this);

  this.connstr = config.connstr;
  this.bucket = config.bucket;
  this.qhosts = config.qhosts;

  this.lib = couchbase;

  this.e = this.lib.errors;
  this.c = new this.lib.Cluster(this.connstr);
  this.b = this.c.openBucket(this.bucket);
  if (this.qhosts) {
    this.b.enableN1ql(this.qhosts);
  }

  this.mock = new MockHarness();
}
util.inherits(RealHarness, Harness);

var myHarness = new RealHarness();
module.exports = myHarness;
