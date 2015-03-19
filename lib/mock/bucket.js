'use strict';

var events = require('events');
var util = require('util');
var ViewQuery = require('../viewquery');
var SpatialQuery = require('../spatialquery');
var N1qlQuery = require('../n1qlquery');
var BucketManager = require('./bucketmgr');
var CbError = require('./error');
var errs = require('../errors');

// Mock version should match the latest fully supported version of couchnode.
var MOCK_VERSION = '2.0.0';

function MockCouchbaseCas(idx) {
  this.x = idx;
}
MockCouchbaseCas.prototype.toString = function() {
  return this.x.toString(10);
};
MockCouchbaseCas.prototype.toJSON = function() {
  return this.x.toString(10);
};
MockCouchbaseCas.prototype.inspect = function() {
  return 'MockCouchbaseCas<' + this.x + '>';
};

var casCounter = 0;
/* istanbul ignore next */
function _createCas() {
  return new MockCouchbaseCas(casCounter++);
}
/* istanbul ignore next */
function _compareCas(a, b) {
  if (!b) {
    return true;
  } else if (!a && b) {
    return false;
  } else {
    if (typeof a === 'string') {
      a = {x: parseInt(a, 10)};
    }
    if (typeof b === 'string') {
      b = {x: parseInt(b, 10)};
    }
    return a.x === b.x;
  }
}
/* istanbul ignore next */
function _makeExpiryDate(expiry) {
  if (!expiry) {
    return null;
  }

  if (expiry < 30*24*60*60) {
    var dt = new Date();
    dt.setTime(dt.getTime() + (expiry*1000));
    return dt;
  } else {
    return new Date(expiry * 1000);
  }
}
/* istanbul ignore next */
function _makeLockDate(lockTime) {
  var dt = new Date();
  dt.setTime(dt.getTime() + (lockTime*1000));
  return dt;
}

var FLAGS = {
  // Node Flags - Formats
  NF_JSON: 0x00,
  NF_RAW: 0x02,
  NF_UTF8: 0x04,
  NF_MASK: 0xFF
};
function _defaultEncode(doc) {
  if (typeof doc === 'string') {
    return {
      flags: FLAGS.NF_UTF8,
      value: new Buffer(doc, 'utf8')
    };
  } else if (Buffer.isBuffer(doc)) {
    return {
      flags: FLAGS.NF_RAW,
      value: new Buffer(doc)
    };
  } else {
    return {
      flags: FLAGS.NF_JSON,
      value: new Buffer(JSON.stringify(doc), 'utf8')
    };
  }
}
function _defaultDecode(info) {
  if (info.flags === FLAGS.NF_UTF8) {
    return info.value.toString('utf8');
  } else if (info.flags === FLAGS.NF_RAW) {
    return new Buffer(info.value);
  } else if (info.flags === FLAGS.NF_JSON) {
    return JSON.parse(info.value.toString('utf8'));
  } else {
    return new Buffer(info.value);
  }
}

/* istanbul ignore next */
function MockStorage() {
  this.items = {};
}
/* istanbul ignore next */
MockStorage.prototype._encodeKey = function(key) {
  return key;
};
/* istanbul ignore next */
MockStorage.prototype.get = function(key, hashkey) {
  if (!hashkey) {
    throw new Error('invalid hashkey');
  }

  var keyItem = this.items[this._encodeKey(key)];
  if (!keyItem) {
    return null;
  }
  var item = keyItem[this._encodeKey(hashkey)];
  if (!item) {
    return null;
  }
  if (item.expiry && item.expiry <= new Date()) {
    return null;
  }
  return item;
};
/* istanbul ignore next */
MockStorage.prototype.set = function(key, hashkey, item) {
  if (!hashkey) {
    throw new Error('invalid hashkey');
  }

  var keyE = this._encodeKey(key);
  var hashkeyE = this._encodeKey(hashkey);
  if (!this.items[keyE]) {
    this.items[keyE] = {};
  }
  this.items[keyE][hashkeyE] = item;
};
/* istanbul ignore next */
MockStorage.prototype.remove = function(key, hashkey) {
  if (!hashkey) {
    throw new Error('invalid hashkey');
  }

  var keyE = this._encodeKey(key);
  var hashkeyE = this._encodeKey(hashkey);
  if (!this.items[keyE]) {
    return null;
  }

  delete this.items[keyE][hashkeyE];
  return _createCas();
};

function MockBucket(options) {
  this.storage = new MockStorage();
  this.ddocs = {};
  this.operationTimeout = 2500;
  this.viewTimeout = 2500;
  this.durabilityTimeout = 2500;
  this.durabilityInterval = 2500;
  this.managementTimeout = 2500;
  this.configThrottle = 2500;
  this.connectionTimeout = 2500;
  this.nodeConnectionTimeout = 2500;
  this._encodeDoc = _defaultEncode;
  this._decodeDoc = _defaultDecode;

  var self = this;

  var connOpts = options.dsnObj;

  this.connected = null;
  process.nextTick(function() {
    if (connOpts.bucket !== 'invalid_bucket') {
      self.connected = true;
      self.emit('connect');
    } else {
      self.connected = false;
      self.emit('error', new Error('invalid bucket name'));
    }
  });

  this.waitQueue = [];
  this.on('connect', function() {
    for (var i = 0; i < this.waitQueue.length; ++i) {
      this.waitQueue[i][0].call(this);
    }
    this.waitQueue = [];
  });
  this.on('error', function(err) {
    for (var i = 0; i < this.waitQueue.length; ++i) {
      this.waitQueue[i][1].call(this, err,  null);
    }
    this.waitQueue = [];
  });
}
util.inherits(MockBucket, events.EventEmitter);

MockBucket.prototype.dump = function() {
  console.log(util.inspect({
    data: this.storage,
    ddocs: this.ddocs
  }, {depth: 16}));
};

/* istanbul ignore next */
MockBucket.prototype.enableN1ql = function(uri) {
  throw new Error('not supported on mock');
};

MockBucket.prototype.manager = function() {
  return new BucketManager(this);
};

MockBucket.prototype.disconnect = function() {
  this.connected = false;
};

MockBucket.prototype.setTranscoder = function(encoder, decoder) {
  if (encoder) {
    this._encodeDoc = encoder;
  } else {
    this._encodeDoc = _defaultEncode;
  }
  if (decoder) {
    this._decodeDoc = decoder;
  } else {
    this._decodeDoc = _defaultDecode;
  }
};

MockBucket.prototype._maybeInvoke = function(fn, callback) {
  if (this.connected === true) {
    fn.call(this);
  } else if (this.connected === false) {
    throw new Error('cannot perform operations on a shutdown bucket');
  } else {
    this.waitQueue.push([fn, callback]);
  }
};

MockBucket.prototype._isValidKey = function(key) {
  return typeof key === 'string' || key instanceof Buffer;
};

MockBucket.prototype._checkHashkeyOption = function(options) {
  if (options.hashkey !== undefined) {
    if (!this._isValidKey(options.hashkey)) {
      throw new TypeError('hashkey option needs to be a string or buffer.');
    }
  }
};

MockBucket.prototype._checkExpiryOption = function(options) {
  if (options.expiry !== undefined) {
    if (typeof options.expiry !== 'number' || options.expiry < 0) {
      throw new TypeError('expiry option needs to be 0 or a positive integer.');
    }
  }
};

MockBucket.prototype._checkCasOption = function(options) {
  if (options.cas !== undefined) {
    if (typeof options.cas !== 'object' && typeof options.cas !== 'string') {
      throw new TypeError('cas option needs to be a CAS object or string.');
    }
  }
};

MockBucket.prototype._checkDuraOptions = function(options) {
  if (options.persist_to !== undefined) {
    if (typeof options.persist_to !== 'number' ||
      options.persist_to < 0 || options.persist_to > 8) {
      throw new TypeError(
        'persist_to option needs to be an integer between 0 and 8.');
    }
  }
  if (options.replicate_to !== undefined) {
    if (typeof options.replicate_to !== 'number' ||
      options.replicate_to < 0 || options.replicate_to > 8) {
      throw new TypeError(
        'replicate_to option needs to be an integer between 0 and 8.');
    }
  }
};

MockBucket.prototype.get = function(key, options, callback) {
  if (options instanceof Function) {
    callback = arguments[1];
    options = {};
  }

  if (!this._isValidKey(key)) {
    throw new TypeError('First argument needs to be a string or buffer.');
  }
  if (typeof options !== 'object') {
    throw new TypeError('Second argument needs to be an object or callback.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Third argument needs to be a callback.');
  }
  this._checkHashkeyOption(options);

  this._maybeInvoke(function() {
    if (!options.hashkey) {
      options.hashkey = key;
    }

    var origItem = this.storage.get(key, options.hashkey);
    if (!origItem) {
      return callback(new CbError('key not found', errs.keyNotFound), null);
    }
    var decValue = this._decodeDoc({value:origItem.value,flags:origItem.flags});
    if (origItem.lockExpiry && origItem.lockExpiry > new Date()) {
      // If the key is locked, the server actually responds with a -1 cas value
      //   which is considered special, here we just make a fake cas.
      callback(null, {
        value: decValue,
        cas: _createCas()
      });
    } else {
      callback(null, {
        value: decValue,
        cas: origItem.cas
      });
    }
  }, callback);
};

MockBucket.prototype.getMulti = function(keys, callback) {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new TypeError('First argument needs to be an array of non-zero length.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Second argument needs to be a callback.');
  }

  var self = this;
  var outMap = {};
  var resCount = 0;
  var errCount = 0;
  function getSingle(key) {
    self.get(key, function(err, res) {
      resCount++;
      if (err) {
        errCount++;
        outMap[key] = { error: err };
      } else {
        outMap[key] = res;
      }
      if (resCount === keys.length) {
        return callback(errCount, outMap);
      }
    });
  }
  for (var i = 0; i < keys.length; ++i) {
    getSingle(keys[i]);
  }
};

MockBucket.prototype.getAndTouch = function(key, expiry, options, callback) {
  if (options instanceof Function) {
    callback = arguments[2];
    options = {};
  }

  if (typeof key !== 'string' && !(key instanceof Buffer)) {
    throw new TypeError('First argument needs to be a string or buffer.');
  }
  if (typeof expiry !== 'number' || expiry < 0) {
    throw new TypeError('Second argument needs to be 0 or a positive integer.');
  }
  if (typeof options !== 'object') {
    throw new TypeError('Third argument needs to be an object or callback.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Fourth argument needs to be a callback.');
  }
  this._checkHashkeyOption(options);
  this._checkDuraOptions(options);

  this._maybeInvoke(function() {
    if (!options.hashkey) {
      options.hashkey = key;
    }

    var origItem = this.storage.get(key, options.hashkey);
    if (!origItem) {
      return callback(new CbError('key not found', errs.keyNotFound), null);
    }
    if (origItem.lockExpiry && origItem.lockExpiry > new Date()) {
      return callback(new CbError(
          'temporary error - key locked', errs.temporaryError), null);
    }
    origItem.expiry = _makeExpiryDate(expiry);
    var decValue = this._decodeDoc({value:origItem.value,flags:origItem.flags});
    callback(null, {
      value: decValue,
      cas: origItem.cas
    });
  }, callback);
};

MockBucket.prototype.getAndLock = function(key, options, callback) {
  if (options instanceof Function) {
    callback = arguments[1];
    options = {};
  }

  if (!this._isValidKey(key)) {
    throw new TypeError('First argument needs to be a string or buffer.');
  }
  if (typeof options !== 'object') {
    throw new TypeError('Second argument needs to be an object or callback.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Third argument needs to be a callback.');
  }
  if (options.lockTime !== undefined) {
    if (typeof options.lockTime !== 'number' || options.lockTime < 1) {
      throw new TypeError('lockTime option needs to be a positive integer.');
    }
  }
  this._checkHashkeyOption(options);

  this._maybeInvoke(function() {
    if (!options.hashkey) {
      options.hashkey = key;
    }

    var origItem = this.storage.get(key, options.hashkey);
    if (!origItem) {
      return callback(new CbError('key not found', errs.keyNotFound), null);
    }
    if (origItem.lockExpiry && origItem.lockExpiry > new Date()) {
      return callback(new CbError(
          'temporary error - key locked', errs.temporaryError), null);
    }
    if (options.lockTime) {
      origItem.lockExpiry = _makeLockDate(options.lockTime);
    } else {
      origItem.lockExpiry = _makeLockDate(15);
    }
    origItem.cas = _createCas();
    var decValue = this._decodeDoc({value:origItem.value,flags:origItem.flags});
    callback(null, {
      value: decValue,
      cas: origItem.cas
    });
  }, callback);
};

MockBucket.prototype.getReplica = function(key, options, callback) {
  if (options instanceof Function) {
    callback = arguments[1];
    options = {};
  }
  if (typeof key !== 'string' && !(key instanceof Buffer)) {
    throw new TypeError('First argument needs to be a string or buffer.');
  }
  if (typeof options !== 'object') {
    throw new TypeError('Second argument needs to be an object or callback.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Third argument needs to be a callback.');
  }
  if (options.hashkey !== undefined) {
    if (!this._isValidKey(options.hashkey)) {
      throw new TypeError('hashkey option needs to be a string or buffer.');
    }
  }
  this._checkHashkeyOption(options);

  /* istanbul ignore next */
  this._maybeInvoke(function() {
    if (!options.hashkey) {
      options.hashkey = key;
    }

    var origItem = this.storage.get(key, options.hashkey);
    if (!origItem) {
      return callback(new CbError('key not found', errs.keyNotFound), null);
    }
    var decValue = this._decodeDoc({value:origItem.value,flags:origItem.flags});
    callback(null, {
      value: decValue,
      cas: origItem.cas
    });
  }, callback);
};

MockBucket.prototype.touch = function(key, expiry, options, callback) {
  if (options instanceof Function) {
    callback = arguments[2];
    options = {};
  }

  if (!this._isValidKey(key)) {
    throw new TypeError('First argument needs to be a string or buffer.');
  }
  if (typeof expiry !== 'number' || expiry < 0) {
    throw new TypeError('Second argument needs to be 0 or a positive integer.');
  }
  if (typeof options !== 'object') {
    throw new TypeError('Third argument needs to be an object or callback.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Fourth argument needs to be a callback.');
  }
  this._checkHashkeyOption(options);
  this._checkCasOption(options);
  this._checkDuraOptions(options);

  this._maybeInvoke(function() {
    if (!options.hashkey) {
      options.hashkey = key;
    }

    var origItem = this.storage.get(key, options.hashkey);
    if (!origItem) {
      return callback(new CbError('key not found', errs.keyNotFound), null);
    }
    if (origItem.lockExpiry && origItem.lockExpiry > new Date()) {
      return callback(new CbError(
          'temporary error - key locked', errs.temporaryError), null);
    }
    origItem.expiry = _makeExpiryDate(expiry);
    callback(null, {
      cas: origItem.cas
    });
  }, callback);
};

MockBucket.prototype.unlock = function(key, cas, options, callback) {
  if (options instanceof Function) {
    callback = arguments[2];
    options = {};
  }
  if (typeof key !== 'string' && !(key instanceof Buffer)) {
    throw new TypeError('First argument needs to be a string or buffer.');
  }
  if (typeof cas !== 'object') {
    throw new TypeError('Second argument needs to be a CAS object.');
  }
  if (typeof options !== 'object') {
    throw new TypeError('Third argument needs to be an object or callback.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Fourth argument needs to be a callback.');
  }
  this._checkHashkeyOption(options);

  this._maybeInvoke(function() {
    if (!options.hashkey) {
      options.hashkey = key;
    }

    var origItem = this.storage.get(key, options.hashkey);
    if (!origItem) {
      return callback(new CbError('key not found', errs.keyNotFound), null);
    }
    if (!_compareCas(origItem.cas, cas)) {
      return callback(new CbError(
          'cas does not match', errs.keyAlreadyExists), null);
    }
    if (!origItem.lockExpiry || origItem.lockExpiry <= new Date()) {
      return callback(new CbError(
          'key not locked', errs.temporaryError), null);
    }
    origItem.lockExpiry = null;
    callback(null, {
      cas: origItem.cas
    });
  }, callback);
};

MockBucket.prototype.remove = function(key, options, callback) {
  if (options instanceof Function) {
    callback = arguments[1];
    options = {};
  }

  if (!this._isValidKey(key)) {
    throw new TypeError('First argument needs to be a string or buffer.');
  }
  if (typeof options !== 'object') {
    throw new TypeError('Second argument needs to be an object or callback.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Third argument needs to be a callback.');
  }
  this._checkHashkeyOption(options);
  this._checkCasOption(options);
  this._checkDuraOptions(options);

  this._maybeInvoke(function() {
    if (!options.hashkey) {
      options.hashkey = key;
    }

    var origItem = this.storage.get(key, options.hashkey);
    if (!origItem) {
      return callback(new CbError('key not found', errs.keyNotFound), null);
    }
    if (origItem.lockExpiry && origItem.lockExpiry > new Date()) {
      return callback(new CbError(
          'temporary error - key locked', errs.temporaryError), null);
    }
    var delCas = this.storage.remove(key, options.hashkey);
    callback(null, {
      cas: delCas
    });
  }, callback);
};

MockBucket.prototype._store = function(key, value, options, callback, opType) {
  if (options instanceof Function) {
    callback = arguments[2];
    options = {};
  }

  if (!this._isValidKey(key)) {
    throw new TypeError('First argument needs to be a string or buffer.');
  }
  if (value === undefined) {
    throw new TypeError('Second argument must not be undefined.');
  }
  if (typeof options !== 'object') {
    throw new TypeError('Third argument needs to be an object or callback.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Fourth argument needs to be a callback.');
  }
  this._checkHashkeyOption(options);
  this._checkExpiryOption(options);
  this._checkCasOption(options);
  this._checkDuraOptions(options);

  this._maybeInvoke(function() {
    /*
    The following is intentionally verbose and repeated to make it
    easier to see test-coverage of different paths that would occur
    on the server.
     */
    if (opType === 'set') {
      if (!options.hashkey) {
        options.hashkey = key;
      }
      var origSetItem = this.storage.get(key, options.hashkey);
      if (origSetItem && origSetItem.lockExpiry &&
          origSetItem.lockExpiry > new Date() && !options.cas) {
        return callback(new CbError(
            'temporary error - key locked', errs.temporaryError), null);
      }
      if (origSetItem && !_compareCas(origSetItem.cas, options.cas)) {
        return callback(new CbError(
            'cas mismatch', key.keyAlreadyExists), null);
      }

      var encItemSet = this._encodeDoc(value);
      var newSetItem = {
        value: encItemSet.value,
        flags: encItemSet.flags,
        expiry: _makeExpiryDate(options.expiry),
        cas: _createCas()
      };
      this.storage.set(key, options.hashkey, newSetItem);
      callback(null, {cas: newSetItem.cas});
    } else if (opType === 'add') {
      if (!options.hashkey) {
        options.hashkey = key;
      }
      var origAddItem = this.storage.get(key, options.hashkey);
      if (origAddItem) {
        return callback(new CbError(
            'key already exists', errs.keyAlreadyExists), null);
      }

      var encItemAdd = this._encodeDoc(value);
      var newAddItem = {
        value: encItemAdd.value,
        flags: encItemAdd.flags,
        expiry: _makeExpiryDate(options.expiry),
        cas: _createCas()
      };
      this.storage.set(key, options.hashkey, newAddItem);
      callback(null, {cas: newAddItem.cas});
    } else if (opType === 'replace') {
      if (!options.hashkey) {
        options.hashkey = key;
      }
      var origReplaceItem = this.storage.get(key, options.hashkey);
      if (!origReplaceItem) {
        return callback(new CbError(
            'key does not exist', errs.keyNotFound), null);
      }
      if (origReplaceItem.lockExpiry && origReplaceItem.lockExpiry > new Date() && !options.cas) {
        return callback(new CbError(
            'temporary error - key locked', errs.temporaryError), null);
      }

      if (origReplaceItem && !_compareCas(origReplaceItem.cas, options.cas)) {
        return callback(new CbError(
            'cas mismatch', errs.keyAlreadyExists), null);
      }

      var encItemReplace = this._encodeDoc(value);
      var newReplaceItem = {
        value: encItemReplace.value,
        flags: encItemReplace.flags,
        expiry: _makeExpiryDate(options.expiry),
        cas: _createCas()
      };
      this.storage.set(key, options.hashkey, newReplaceItem);
      callback(null, {cas: newReplaceItem.cas});
    } else if (opType === 'append') {
      if (!options.hashkey) {
        options.hashkey = key;
      }
      var origAppendItem = this.storage.get(key, options.hashkey);
      if (!origAppendItem) {
        return callback(new CbError(
            'key does not exist', errs.keyNotFound), null);
      }
      if (origAppendItem.lockExpiry && origAppendItem.lockExpiry > new Date()) {
        return callback(new CbError(
            'temporary error - key locked', errs.temporaryError), null);
      }

      var encValAppend = this._encodeDoc(value);
      origAppendItem.value = Buffer.concat([
          origAppendItem.value, encValAppend.value]);
      origAppendItem.cas = _createCas();

      callback(null, {
        cas: origAppendItem.cas
      });
    } else if (opType === 'prepend') {
      if (!options.hashkey) {
        options.hashkey = key;
      }
      var origPrependItem = this.storage.get(key, options.hashkey);
      if (!origPrependItem) {
        return callback(new CbError(
            'key does not exist', errs.keyNotFound), null);
      }
      if (origPrependItem.lockExpiry && origPrependItem.lockExpiry > new Date()) {
        return callback(new CbError(
            'temporary error - key locked', errs.temporaryError), null);
      }

      var encValPrepend = this._encodeDoc(value);
      origPrependItem.value = Buffer.concat([
        encValPrepend.value, origPrependItem.value]);
      origPrependItem.cas = _createCas();

      callback(null, {
        cas: origPrependItem.cas
      });
    }
  }, callback);
};

MockBucket.prototype.upsert = function(key, value, options, callback) {
  this._store(key, value, options, callback, 'set');
};

MockBucket.prototype.insert = function(key, value, options, callback) {
  this._store(key, value, options, callback, 'add');
};

MockBucket.prototype.replace = function(key, value, options, callback) {
  this._store(key, value, options, callback, 'replace');
};

MockBucket.prototype.append = function(key, fragment, options, callback) {
  this._store(key, fragment, options, callback, 'append');
};

MockBucket.prototype.prepend = function(key, fragment, options, callback) {
  this._store(key, fragment, options, callback, 'prepend');
};

MockBucket.prototype.counter = function(key, delta, options, callback) {
  if (options instanceof Function) {
    callback = arguments[2];
    options = {};
  }

  if (!this._isValidKey(key)) {
    throw new TypeError('First argument needs to be a string or buffer.');
  }
  if (typeof delta !== 'number' || delta === 0) {
    throw new TypeError('Second argument must be a non-zero integer.');
  }
  if (typeof options !== 'object') {
    throw new TypeError('Third argument needs to be an object or callback.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Fourth argument needs to be a callback.');
  }
  if (options.initial) {
    if (typeof options.initial !== 'number' || options.initial < 0) {
      throw new TypeError('initial option must be 0 or a positive integer.');
    }
  }
  this._checkHashkeyOption(options);
  this._checkExpiryOption(options);
  this._checkDuraOptions(options);

  this._maybeInvoke(function() {
    if (!options.hashkey) {
      options.hashkey = key;
    }
    var origCountItem = this.storage.get(key, options.hashkey);
    if (options.initial !== undefined && !origCountItem) {
      var newCountItem = {
        value: new Buffer(options.initial.toString(), 'utf8'),
        flags: 0,
        cas: _createCas()
      };
      this.storage.set(key, options.hashkey, newCountItem);
      return callback(null, {
        value: options.initial,
        cas: newCountItem.cas
      });
    }
    if (!origCountItem) {
      return callback(new CbError(
          'key does not exist', errs.keyNotFound), null);
    }
    if (origCountItem.lockExpiry && origCountItem.lockExpiry > new Date()) {
      return callback(new CbError(
          'temporary error - key locked', errs.temporaryError), null);
    }

    var strValue = origCountItem.value.toString('utf8');
    var numValue = parseInt(strValue, 10);
    numValue += delta;
    origCountItem.value = new Buffer(numValue.toString(), 'utf8');
    origCountItem.cas = _createCas();

    callback(null, {
      value: numValue,
      cas: origCountItem.cas
    });
  }, callback);
};

MockBucket.prototype.query = function(query, params, callback) {
  if (params instanceof Function) {
    callback = arguments[1];
    params = undefined;
  }

  if (query instanceof ViewQuery) {
    return this._view(query.ddoc, query.name, query.options, callback);
  } else if (query instanceof SpatialQuery) {
    throw new Error('Spatial queries are not supported in the mock.');
  } else if (query instanceof N1qlQuery) {
    throw new Error('N1QL queries are not supported in the mock.');
  } else {
    throw new TypeError(
        'First argument needs to be a ViewQuery, SpatialQuery or N1qlQuery.');
  }
};

Object.defineProperty(MockBucket.prototype, 'lcbVersion', {
  get: function() {
    return '0.0.0';
  },
  writeable: false
});

Object.defineProperty(MockBucket.prototype, 'clientVersion', {
  get: function() {
    return MOCK_VERSION;
  },
  writeable: false
});

function ViewQueryResponse(req) {
}
util.inherits(ViewQueryResponse, events.EventEmitter);

MockBucket.prototype._view = function(ddoc, name, q, callback) {
  var req = new ViewQueryResponse();

  var self = this;
  process.nextTick(function() {
    self._execView(ddoc, name, q, function(err, rows, meta) {
      if (err) {
        return req.emit('error', err);
      }
      for (var i = 0; i < rows.length; ++i) {
        req.emit('row', rows[i]);
      }
      req.emit('rows', rows, meta);
      req.emit('end', meta);
    });
  });

  if (callback) {
    req.on('rows', function(rows, meta) {
      callback(null, rows, meta);
    });
    req.on('error', function(err) {
      callback(err, null, null);
    });
  }
  return req;
};

MockBucket.prototype._indexView = function(ddoc, name, options, callback) {
  var ddocObj = this.ddocs[ddoc];
  if (!ddocObj) {
    return callback(new Error('not_found'));
  }
  if (ddocObj.views) {
    ddocObj = ddocObj.views;
  }
  var viewObj = ddocObj[name];
  if (!viewObj) {
    return callback(new Error('not_found'));
  }
  var viewMapFunc = viewObj.map;

  var retvals = [];

  var curdocval = null;
  var curdockey = null;
  var curdocmeta = null;
  function emit(key, val) {
    var row = {
      key: key,
      id: curdockey,
      value: val,
      doc: {
        meta: curdocmeta
      }
    };
    if (curdocmeta.type === 'json') {
      row.doc.json = curdocval;
    } else {
      row.doc.base64 = curdocval;
    }
    retvals.push(row);
  }

  var procOne = function(doc,meta){};
  eval('procOne = ' + viewMapFunc);

  for (var keyName in this.storage.items) {
    if (this.storage.items.hasOwnProperty(keyName)) {
      var thisKey = this.storage.items[keyName];
      for (var hashKey in thisKey) {
        if (thisKey.hasOwnProperty(hashKey)) {
          var thisVal = thisKey[hashKey];

          curdockey = keyName;

          curdocval = null;
          try {
            curdocval = JSON.parse(thisVal.value.toString());
          } catch (e) {
          }

          var curdoctype = curdocval ? 'json' : 'base64';
          if (!curdocval) {
            curdocval = thisVal.value.toString('base64');
          }

          curdocmeta = {
            id: curdockey,
            rev: '?NOTVALIDFORMOCK?',
            expiration: thisVal.expiry ? thisVal.expiry : 0,
            flags: thisVal.flags,
            type: curdoctype
          };

          procOne(curdocval, curdocmeta);
        }
      }
    }
  }

  var reducer = viewObj.reduce;
  if (reducer) {
    if (reducer === '_count') {
      reducer = function(key, values, rereduce) {
        if (rereduce) {
          var result = 0;
          for (var i = 0; i < values.length; i++) {
            result += values[i];
          }
          return result;
        } else {
          return values.length;
        }
      };
    } else if (reducer === '_sum') {
      reducer = function(key, values, rereduce) {
        var sum = 0;
        for(var i = 0; i < values.length; i++) {
          sum = sum + values[i];
        }
        return(sum);
      };
    } else if (reducer === '_stats') {
      reducer = function(key, values, rereduce) {
        return null;
      };
    } else {
      eval('reducer = ' + reducer);
    }
  }

  callback(null, retvals, reducer);
};

// http://docs.couchdb.org/en/latest/couchapp/views/collation.html
var SORT_ORDER = function() {
  var ordered_array = [
    'null',
    'false',
    'true',
    'number',
    'string',
    'array',
    'object',
    'unknown'
  ];

  var obj = {};
  for (var i = 0; i < ordered_array.length; i++) {
    obj[ordered_array[i]] = i;
  }
  return obj;
}();

/**
 * Returns the sorting priority for a given type
 * @param v The value whose type should be evaluated
 * @return The numeric sorting index
 */
function getSortIndex(v) {
  if (typeof v === 'string') {
    return SORT_ORDER['string'];
  } else if (typeof v === 'number') {
    return SORT_ORDER['number'];
  } else if (Array.isArray(v)) {
    return SORT_ORDER['array'];
  } else if (v === true) {
    return SORT_ORDER['true'];
  } else if (v === false) {
    return SORT_ORDER['false'];
  } else if (typeof v === 'object') {
    return SORT_ORDER['object'];
  } else {
    return SORT_ORDER['unknown'];
  }
}

/**
 * Compares one value with another
 * @param a The first value
 * @param b The second value
 * @param [exact] If both @c b and @c b are arrays, setting this parameter to true
 * ensures that they will only be equal if their length matches and their
 * contents match. If this value is false (the default), then only the common
 * subset of elements are evaluated
 *
 * @return {number} greater than 0 if @c a is bigger than @b; a number less
 * than 0 if @a is less than @b, or 0 if they are equal
 */
function cbCompare(a, b, exact) {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (exact === true) {
      if (a.length !== b.length) {
        return a.length > b.length ? +1 : -1;
      }
    }
    var maxLength = a.length > b.length ? b.length : a.length;
    for (var i = 0; i < maxLength; ++i) {
      var subCmp = cbCompare(a[i], b[i], true);
      if (subCmp !== 0) {
        return subCmp;
      }
    }
    return 0;
  }

  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b);
  }

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  // Now we need to do special things
  var aPriority = getSortIndex(a);
  var bPriority = getSortIndex(b);
  if (aPriority !== bPriority) {
    return aPriority - bPriority;
  } else {
    if (a < b) {
      return -1;
    } else if (a > b) {
      return 1;
    } else {
      return 0;
    }
  }
}

/**
 * Find the index of @c val in the array @arr
 * @param arr The array to search in
 * @param val The value to search for
 * @return {number} the index in the array, or -1 if the item does not exist
 */
function cbIndexOf(arr, val) {
  for (var i = 0; i < arr.length; ++i) {
    if (cbCompare(arr[i], val, true) === 0) {
      return i;
    }
  }
  return -1;
}

/**
 * Normalize a key for reduce
 * @param key The key to normalize
 * @param groupLevel The group level
 * @return {*}
 */
function cbNormKey(key, groupLevel) {
  if (groupLevel === 0) {
    return null;
  }

  if (Array.isArray(key)) {
    if (groupLevel === -1) {
      return key;
    } else {
      return key.slice(0, groupLevel);
    }
  } else {
    return key;
  }
}

MockBucket.prototype._execView = function(ddoc, name, options, callback) {
  this._indexView(ddoc, name, options, function(err, results, reducer) {
    if (err) {
      return callback(err);
    }

    // Store total emitted rows
    var rowcount = results.length;

    // Parse if needed
    var startkey = options.startkey ? JSON.parse(options.startkey) : undefined;
    var startkey_docid = options.startkey_docid ? JSON.parse(options.startkey_docid) : undefined;
    var endkey = options.endkey ? JSON.parse(options.endkey) : undefined;
    var endkey_docid = options.endkey_docid ? JSON.parse(options.endkey_docid) : undefined;
    var group_level = options.group_level ? options.group_level : 0;

    var inclusive_start = true;
    var inclusive_end = true;
    if (options.inclusive_end !== undefined) {
      inclusive_end = options.inclusive_end;
    }

    // Invert if descending
    if (options.descending) {
      var _startkey = startkey;
      startkey = endkey;
      endkey = _startkey;
      var _startkey_docid = startkey_docid;
      startkey_docid = endkey_docid;
      endkey_docid = _startkey_docid;
      var _inclusive_start = inclusive_start;
      inclusive_start = inclusive_end;
      inclusive_end = _inclusive_start;
    }

    var key = options.key ? JSON.parse(options.key) : undefined;
    var keys = options.keys ? JSON.parse(options.keys) : undefined;

    var newResults = [];
    for (var i = 0; i < results.length; ++i) {
      var dockey = results[i].key;
      var docid = results[i].id;

      if (key !== undefined) {
        if (cbCompare(dockey, key) !== 0) {
          continue;
        }
      }
      if (keys !== undefined) {
        if (cbIndexOf(keys, dockey) < 0) {
          continue;
        }
      }

      if (inclusive_start) {
        if (startkey && cbCompare(dockey, startkey) < 0) {
          continue;
        }
        if (startkey_docid && cbCompare(docid, startkey_docid) < 0) {
          continue;
        }
      } else {
        if (startkey && cbCompare(dockey, startkey) <= 0) {
          continue;
        }
        if (startkey_docid && cbCompare(docid, startkey_docid) <= 0) {
          continue;
        }
      }

      if (inclusive_end) {
        if (endkey && cbCompare(dockey, endkey) > 0) {
          continue;
        }
        if (endkey_docid && cbCompare(docid, endkey_docid) > 0) {
          continue;
        }
      } else {
        if (endkey && cbCompare(dockey, endkey) >= 0) {
          continue;
        }
        if (endkey_docid && cbCompare(docid, endkey_docid) >= 0) {
          continue;
        }
      }

      if (!options.include_docs) {
        delete results[i].doc;
      }

      newResults.push(results[i]);
    }
    results = newResults;

    if (options.descending) {
      results.sort(function(a,b){
        if (a.key > b.key) { return -1; }
        if (a.key < b.key) { return +1; }
        return 0;
      });
    } else {
      results.sort(function(a,b){
        if (b.key > a.key) { return -1; }
        if (b.key < a.key) { return +1; }
        return 0;
      });
    }

    if (options.skip && options.limit) {
      results = results.slice(options.skip, options.skip + options.limit);
    } else if (options.skip) {
      results = results.slice(options.skip);
    } else if (options.limit) {
      results = results.slice(0, options.limit);
    }

    // Reduce Time!!
    if (reducer && options.reduce !== false) {
      var keys = [];
      for (var i = 0; i < results.length; ++i) {
        var keyN = cbNormKey(results[i].key, group_level);
        if (cbIndexOf(keys, keyN) < 0) {
          keys.push(keyN);
        }
      }

      var newResults = [];
      for (var j = 0; j < keys.length; ++j) {
        var values = [];
        for (var k = 0; k < results.length; ++k) {
          var keyN = cbNormKey(results[k].key, group_level);
          if (cbCompare(keyN, keys[j]) === 0) {
            values.push(results[k].value);
          }
        }
        var result = reducer(keys[j], values, false);
        newResults.push({
          key: keys[j],
          value: result
        });
      }
      results = newResults;
    }

    var meta = {
      total_rows: rowcount
    };

    callback(null, results, meta);
  });
};

module.exports = MockBucket;
