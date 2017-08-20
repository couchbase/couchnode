'use strict';

var couchbase = require('./../lib/couchbase');
var jcbmock = require('./jcbmock');
var fs = require('fs');
var util = require('util');
var assert = require('assert');

var config = {
  connstr: '',
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
  config.bpass = process.env.CNBPASS;
}
if (process.env.CNMUSER !== undefined) {
  config.muser = process.env.CNMUSER;
}
if (process.env.CNMPASS !== undefined) {
  config.mpass = process.env.CNMPASS;
}

var configWaits = [];
function _waitForConfig(callback) {
  if (!configWaits) {
    setImmediate(callback);
    return;
  }

  configWaits.push(callback);
  if (configWaits.length > 1) {
    return;
  }

  var _handleWaiters = function(err) {
    for (var i = 0; i < configWaits.length; ++i) {
      configWaits[i](err);
    }
    configWaits = null;
  };

  if (config.connstr) {
    _handleWaiters(null);
    return;
  }

  before(function(done) {
    this.timeout(60000);

    jcbmock.create({}, function(err, mock) {
      if (err) {
        console.error('failed to start mock', err);
        process.exit(1);
        return;
      }

      config.mockInst = mock;
      config.connstr = 'http://localhost:' + mock.entryPort.toString();
      _handleWaiters(null);
      done();
    });
  });
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

Harness.prototype.timeTravel = function(callback, period) {
  setTimeout(callback, period);
};

function MockHarness() {
  Harness.call(this);

  this.mockInst = null;
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

MockHarness.prototype.timeTravel = function(callback, period) {
  this.b.timeTravel(period);
  setImmediate(callback);
};

function RealHarness() {
  Harness.call(this);

  this.mock = new MockHarness();

  this.lib = couchbase;
  this.e = this.lib.errors;

  _waitForConfig(function() {
    this.mockInst = config.mockInst;
    this.connstr = config.connstr;
    this.bucket = config.bucket;
    this.qhosts = config.qhosts;
    this.bpass = config.bpass;
    this.muser = config.muser;
    this.mpass = config.mpass;

    this.c = new this.lib.Cluster(this.connstr);
    this.b = this.c.openBucket(this.bucket);
    if (this.qhosts) {
      this.b.enableN1ql(this.qhosts);
    }
  }.bind(this));
}
util.inherits(RealHarness, Harness);

RealHarness.prototype.timeTravel = function(callback, period) {
  if (!this.mockInst) {
    Harness.prototype.timeTravel.apply(this, arguments);
  } else {
    var periodSecs = Math.ceil(period / 1000);
    this.mockInst.command('TIME_TRAVEL', {
      Offset: periodSecs
    }, function(err) {
      if (err) {
        console.error('time travel error:', err);
      }

      callback();
    });
  }
};

var myHarness = new RealHarness();
module.exports = myHarness;
