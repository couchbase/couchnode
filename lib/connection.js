'use strict';

const async_hooks = require('async_hooks');
const binding = require('./binding');
const connstr = require('./connstr');
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
  debug.extend(severity)(
    '(' + info.subsys + ' @ ' + location + ') ' + info.message
  );
}

/**
 * @typedef LoggingEntry
 * @type {Object}
 * @property {number} severity
 * @property {string} srcFile
 * @property {number} srcLine
 * @property {string} subsys
 * @property {string} message
 */
/**
 * @typedef LoggingCallback
 * @type {function}
 * @param {LoggingEntry} entry
 */

/**
 * @private
 */
class Connection {
  constructor(opts) {
    var logFunc = _logToDebug;
    if (opts.logFunc) {
      logFunc = opts.logFunc;
    }

    var dsnObj = connstr.parse(opts.connStr);
    var lcbDsnObj = connstr.normalize(dsnObj);

    if (opts.trustStorePath) {
      lcbDsnObj.options.truststorepath = opts.trustStorePath;
    }
    if (opts.certificatePath) {
      lcbDsnObj.options.certpath = opts.certificatePath;
    }
    if (opts.keyPath) {
      lcbDsnObj.options.keypath = opts.keyPath;
    }
    if (opts.bucketName) {
      lcbDsnObj.bucket = opts.bucketName;
    }

    if (opts.kvConnectTimeout) {
      lcbDsnObj.options.config_total_timeout = (
        opts.kvConnectTimeout / 1000
      ).toString();
    }
    if (opts.kvTimeout) {
      lcbDsnObj.options.timeout = (opts.kvTimeout / 1000).toString();
    }
    if (opts.kvDurableTimeout) {
      lcbDsnObj.options.durability_timeout = (
        opts.kvDurableTimeout / 1000
      ).toString();
    }
    if (opts.viewTimeout) {
      lcbDsnObj.options.views_timeout = (opts.viewTimeout / 1000).toString();
    }
    if (opts.queryTimeout) {
      lcbDsnObj.options.query_timeout = (opts.queryTimeout / 1000).toString();
    }
    if (opts.analyticsTimeout) {
      lcbDsnObj.options.analytics_timeout = (
        opts.analyticsTimeout / 1000
      ).toString();
    }
    if (opts.searchTimeout) {
      lcbDsnObj.options.search_timeout = (opts.searchTimeout / 1000).toString();
    }
    if (opts.managementTimeout) {
      lcbDsnObj.options.http_timeout = (
        opts.managementTimeout / 1000
      ).toString();
    }

    // Grab the various versions.  Note that we need to trim them
    // off as some Node.js versions insert strange characters into
    // the version identifiers (mainly newlines and such).
    var couchnodeVer = require('../package.json').version.trim();
    var nodeVer = process.versions.node.trim();
    var v8Ver = process.versions.v8.trim();
    var sslVer = process.versions.openssl.trim();
    var clientString =
      `couchnode/${couchnodeVer}` +
      ` (node/${nodeVer}; v8/${v8Ver}; ssl/${sslVer})`;
    lcbDsnObj.options.client_string = clientString;

    var connType = binding.LCB_TYPE_CLUSTER;
    if (lcbDsnObj.bucket) {
      connType = binding.LCB_TYPE_BUCKET;
    }

    var connStr = connstr.stringify(lcbDsnObj);

    this._inst = new binding.Connection(
      connType,
      connStr,
      opts.username,
      opts.password,
      logFunc
    );

    this._closed = false;
    this._pendOps = [];
    this._pendBOps = [];
    this._connected = false;
    this._opened = opts.bucketName ? true : false;
  }

  async connect() {
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
  }

  async selectBucket(bucketName, callback) {
    const _fwdSelectBucket = function () {
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

  _flushPendOps(err = null) {
    for (var i = 0; i < this._pendOps.length; ++i) {
      this._pendOps[i](err);
    }
    this._pendOps = [];
  }

  _flushPendBOps(err = null) {
    for (var i = 0; i < this._pendBOps.length; ++i) {
      this._pendBOps[i](err);
    }
    this._pendBOps = [];
  }

  _maybeFwd(fn, args) {
    if (this._closed) {
      throw new Error('parent cluster object has been closed');
    }

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
      this._pendOps.push((err) => {
        if (err) return callback(err);
        res.runInAsyncScope(fn, this._inst, ...args);
      });
    }
  }

  _maybeBFwd(fn, args) {
    if (this._closed) {
      throw new Error('parent cluster object has been closed');
    }

    if (args.length == 0) {
      throw new Error('attempted to forward function having no arguments');
    }

    var callback = args[args.length - 1];
    if (!(callback instanceof Function)) {
      throw new Error('attempted to forward non-callback-based function');
    }

    if (this._connected && this._opened) {
      try {
        fn.call(this._inst, ...args);
      } catch (e) {
        callback(e);
      }
      return;
    }

    var res = new async_hooks.AsyncResource('cbopen');
    this._pendBOps.push((err) => {
      if (err) return callback(err);

      try {
        res.runInAsyncScope(fn, this._inst, ...args);
      } catch (e) {
        callback(e);
      }
    });
  }

  close() {
    if (this._closed) {
      return;
    }

    this._closed = true;
    this._flushPendOps(new Error('cluster object was closed'));
    this._flushPendBOps(new Error('cluster object was closed'));
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

  query() {
    this._maybeFwd(() => this._inst.query(...arguments), arguments);
  }

  analyticsQuery() {
    this._maybeFwd(() => this._inst.analyticsQuery(...arguments), arguments);
  }

  searchQuery() {
    this._maybeFwd(() => this._inst.searchQuery(...arguments), arguments);
  }

  httpRequest() {
    this._maybeFwd(() => this._inst.httpRequest(...arguments), arguments);
  }

  ping() {
    this._maybeFwd(() => this._inst.ping(...arguments), arguments);
  }

  diag() {
    this._maybeFwd(() => this._inst.diag(...arguments), arguments);
  }
}

module.exports = Connection;
