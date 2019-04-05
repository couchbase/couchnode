const async_hooks = require('async_hooks');
const binding = require('./binding');

/**
 * 
 */
class Connection {
  constructor(opts) {
    // TODO: Implement the log function appropriately...
    //var logFunc = (info) => console.log(info);
    var logFunc = null;

    this._inst = new binding.Connection(
      opts.connStr,
      opts.username,
      opts.password,
      logFunc);

    this._pendOps = [];
    this._connected = false;

    this._inst.connect((err) => {
      this._connected = true;
      this._flushPendOps();
    });
  }

  _flushPendOps() {
    for (var i = 0; i < this._pendOps.length; ++i) {
      this._pendOps[i]();
    }
    this._pendOps = [];
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

  close() {
    return this._inst.shutdown(...arguments);
  }

  get() {
    this._maybeFwd(() => this._inst.get(...arguments), arguments);
  }

  getReplica() {
    this._maybeFwd(() => this._inst.getReplica(...arguments), arguments);
  }

  store() {
    this._maybeFwd(() => this._inst.store(...arguments), arguments);
  }

  remove() {
    this._maybeFwd(() => this._inst.remove(...arguments), arguments);
  }

  touch() {
    this._maybeFwd(() => this._inst.touch(...arguments), arguments);
  }

  unlock() {
    this._maybeFwd(() => this._inst.unlock(...arguments), arguments);
  }

  counter() {
    this._maybeFwd(() => this._inst.counter(...arguments), arguments);
  }

  lookupIn() {
    this._maybeFwd(() => this._inst.lookupIn(...arguments), arguments);
  }

  mutateIn() {
    this._maybeFwd(() => this._inst.mutateIn(...arguments), arguments);
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
