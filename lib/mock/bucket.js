'use strict';

var events = require('events');
var util = require('util');
var ViewQuery = require('../viewquery');

// Mock version should match the latest fully supported version of couchnode.
var MOCK_VERSION = '2.4.0';

var casCounter = 0;
/* istanbul ignore next */
function _createCas() {
  return {x:casCounter++};
}
/* istanbul ignore next */
function _compareCas(a, b) {
  if (!b) {
    return true;
  } else if (!a && b) {
    return false;
  } else {
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

/* istanbul ignore next */
MockBucket.prototype.enableN1ql = function(uri) {
  throw new Error('not supported on mock');
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

/* istanbul ignore next */
MockBucket.prototype.query = function(query, params, callback) {
  throw new Error('not supported on mock');
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
    if (typeof options.expiry !== 'number' || options.expiry < 1) {
      throw new TypeError('expiry option needs to be a positive integer.');
    }
  }
};

MockBucket.prototype._checkCasOption = function(options) {
  if (options.cas !== undefined) {
    if (typeof options.cas !== 'object') {
      throw new TypeError('cas option needs to be a CAS object.');
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
      return callback(new Error('key not found'), null);
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
  if (typeof expiry !== 'number' || expiry < 1) {
    throw new TypeError('Second argument needs to be a positive integer.');
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
      return callback(new Error('key not found'), null);
    }
    if (origItem.lockExpiry && origItem.lockExpiry > new Date()) {
      return callback(new Error('temporary error - key locked'), null);
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
      return callback(new Error('key not found'), null);
    }
    if (origItem.lockExpiry && origItem.lockExpiry > new Date()) {
      return callback(new Error('temporary error - key locked'), null);
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
      return callback(new Error('key not found'), null);
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
  if (typeof expiry !== 'number' || expiry < 1) {
    throw new TypeError('Second argument needs to be a positive integer.');
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
      return callback(new Error('key not found'), null);
    }
    if (origItem.lockExpiry && origItem.lockExpiry > new Date()) {
      return callback(new Error('temporary error - key locked'), null);
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
      return callback(new Error('key not found'), null);
    }
    if (!_compareCas(origItem.cas, cas)) {
      return callback(new Error('cas does not match'), null);
    }
    if (!origItem.lockExpiry || origItem.lockExpiry <= new Date()) {
      return callback(new Error('key not locked'), null);
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
      return callback(new Error('key not found'), null);
    }
    if (origItem.lockExpiry && origItem.lockExpiry > new Date()) {
      return callback(new Error('temporary error - key locked'), null);
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
        return callback(new Error('temporary error - key locked'), null);
      }
      if (origSetItem && !_compareCas(origSetItem.cas, options.cas)) {
        return callback(new Error('cas mismatch'), null);
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
        return callback(new Error('key already exists'), null);
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
        return callback(new Error('key does not exist'), null);
      }
      if (origReplaceItem.lockExpiry && origReplaceItem.lockExpiry > new Date() && !options.cas) {
        return callback(new Error('temporary error - key locked'), null);
      }

      if (origReplaceItem && !_compareCas(origReplaceItem.cas, options.cas)) {
        return callback(new Error('cas mismatch'), null);
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
        return callback(new Error('key does not exist'), null);
      }
      if (origAppendItem.lockExpiry && origAppendItem.lockExpiry > new Date()) {
        return callback(new Error('temporary error - key locked'), null);
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
        return callback(new Error('key does not exist'), null);
      }
      if (origPrependItem.lockExpiry && origPrependItem.lockExpiry > new Date()) {
        return callback(new Error('temporary error - key locked'), null);
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
      return callback(new Error('key does not exist'), null);
    }
    if (origCountItem.lockExpiry && origCountItem.lockExpiry > new Date()) {
      return callback(new Error('temporary error - key locked'), null);
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

module.exports = MockBucket;
