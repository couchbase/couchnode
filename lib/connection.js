const async_hooks = require('async_hooks');
const binding = require('./binding');
const PromiseHelper = require('./promisehelper');
const debug = require('debug')('couchnode:lcb');

function _logSevToStr(severity) {
  switch (severity) {
    case binding.LCB_LOG_TRACE:
      return 'trace';
    case binding.LCB_LOG_DEBUG:
      return 'debug';
    case binding.LCB_LOG_INFO:
      return 'info';
    case binding.LCB_LOG_WARN:
      return 'warn';
    case binding.LCB_LOG_ERROR:
      return 'error';
    case binding.LCB_LOG_FATAL:
      return 'fatal';
  }
  return 'sev' + severity;
}

function _logToDebug(info) {
  var severity = _logSevToStr(info.severity);
  var location = info.srcFile + ':' + info.srcLine;
  debug.extend(severity)('(' + info.subsys + ' @ ' + location + ') ' + info.message);
}

/**
 * @private
 */
class Connection {
  constructor(opts) {
    var logFunc = _logToDebug;
    if (opts.logFunc) {
      logFunc = opts.logFunc;
    }

    var connType = binding.LCB_TYPE_CLUSTER;
    var connStr = opts.connStr;
    if (opts.bucketName) {
      connType = binding.LCB_TYPE_BUCKET;
      connStr += '/' + opts.bucketName;
    }

    this._inst = new binding.Connection(
      connType,
      connStr,
      opts.username,
      opts.password,
      logFunc);

    this._pendOps = [];
    this._pendBOps = [];
    this._connected = false;
    this._opened = opts.bucketName ? true : false;
  }

  async connect(callback) {
    return PromiseHelper.wrapAsync(async () => {
      return new Promise((resolve, reject) => {
        this._inst.connect((err) => {
          if (err) {
            reject(err);
            return;
          }

          this._connected = true;
          this._flushPendOps();

          if (this._opened) {
            this._flushPendBOps();
          }

          resolve();
        });
      });
    }, callback);
  }

  async selectBucket(bucketName, callback) {
    const _fwdSelectBucket = function() {
      this._maybeFwd(() => this._inst.selectBucket(...arguments), arguments);
    }.bind(this);

    return PromiseHelper.wrapAsync(async () => {
      return new Promise((resolve, reject) => {
        _fwdSelectBucket(bucketName, (err) => {
          if (err) {
            reject(err);
            return;
          }

          this._opened = true;
          this._flushPendBOps();

          resolve();
        });
      });
    }, callback);
  }

  _flushPendOps() {
    for (var i = 0; i < this._pendOps.length; ++i) {
      this._pendOps[i]();
    }
    this._pendOps = [];
  }

  _flushPendBOps() {
    for (var i = 0; i < this._pendBOps.length; ++i) {
      this._pendBOps[i]();
    }
    this._pendBOps = [];
  }

  _maybeFwd(fn, args) {
    if (args.length == 0) {
      throw new Error('attempted to forward function having no arguments');
    }

    var callback = args[args.length - 1];
    if (!(callback instanceof Function)) {
      throw new Error('attempted to forward non-callback-based function');
    }

    if (this._connected) {
      fn.call(this._inst, ...args);
    } else {
      var res = new async_hooks.AsyncResource('cbconnect');
      this._pendOps.push(() => {
        res.runInAsyncScope(fn, this._inst, ...args);
      });
    }
  }

  _maybeBFwd(fn, args) {
    if (args.length == 0) {
      throw new Error('attempted to forward function having no arguments');
    }

    var callback = args[args.length - 1];
    if (!(callback instanceof Function)) {
      throw new Error('attempted to forward non-callback-based function');
    }

    if (this._connected && this._opened) {
      fn.call(this._inst, ...args);
    } else {
      var res = new async_hooks.AsyncResource('cbopen');
      this._pendBOps.push(() => {
        res.runInAsyncScope(fn, this._inst, ...args);
      });
    }
  }

  close() {
    return this._inst.shutdown(...arguments);
  }

  get() {
    this._maybeBFwd(() => this._inst.get(...arguments), arguments);
  }

  exists() {
    this._maybeBFwd(() => this._inst.exists(...arguments), arguments);
  }

  getReplica() {
    this._maybeBFwd(() => this._inst.getReplica(...arguments), arguments);
  }

  store() {
    this._maybeBFwd(() => this._inst.store(...arguments), arguments);
  }

  remove() {
    this._maybeBFwd(() => this._inst.remove(...arguments), arguments);
  }

  touch() {
    this._maybeBFwd(() => this._inst.touch(...arguments), arguments);
  }

  unlock() {
    this._maybeBFwd(() => this._inst.unlock(...arguments), arguments);
  }

  counter() {
    this._maybeBFwd(() => this._inst.counter(...arguments), arguments);
  }

  lookupIn() {
    this._maybeBFwd(() => this._inst.lookupIn(...arguments), arguments);
  }

  mutateIn() {
    this._maybeBFwd(() => this._inst.mutateIn(...arguments), arguments);
  }

  viewQuery() {
    this._maybeFwd(() => this._inst.viewQuery(...arguments), arguments);
  }

  n1qlQuery() {
    this._maybeFwd(() => this._inst.n1qlQuery(...arguments), arguments);
  }

  analyticsQuery() {
    this._maybeFwd(() => this._inst.analyticsQuery(...arguments), arguments);
  }

  ftsQuery() {
    this._maybeFwd(() => this._inst.ftsQuery(...arguments), arguments);
  }

  httpRequest() {
    this._maybeFwd(() => this._inst.httpRequest(...arguments), arguments);
  }

}

module.exports = Connection;
