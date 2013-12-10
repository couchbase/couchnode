"use strict";

// Mock version should match the latest fully supported version
//   of couchnode's libcouchbase implementation.
var MOCK_VERSION = [0x010200, '1.2.0'];

var ViewQuery = require('./viewQuery.js');

var errorsList = [
  'success',
  'authContinue',
  'authError',
  'deltaBadVal',
  'objectTooBig',
  'serverBusy',
  'cLibInternal',
  'cLibInvalidArgument',
  'cLibOutOfMemory',
  'invalidRange',
  'cLibGenericError',
  'temporaryError',
  'keyAlreadyExists',
  'keyNotFound',
  'failedToOpenLibrary',
  'failedToFindSymbol',
  'networkError',
  'wrongServer',
  'notMyVBucket',
  'notStored',
  'notSupported',
  'unknownCommand',
  'unknownHost',
  'protocolError',
  'timedOut',
  'connectError',
  'bucketNotFound',
  'clientOutOfMemory',
  'clientTemporaryError',
  'badHandle',
  'serverBug',
  'invalidHostFormat',
  'notEnoughNodes',
  'duplicateItems',
  'noMatchingServerForKey',
  'badEnvironmentVariable',
  'outOfMemory',
  'invalidArguments',
  'schedulingError',
  'checkResults',
  'genericError',
  'durabilityFailed',
  'restError'
];
var errors = {};
for (var i = 0; i < errorsList.length; ++i) {
  errors[errorsList[i]] = i;
}

var format = {
  json: 0,
  raw: 2,
  utf8: 4,
  auto: 0x777777
};

function asyncTick(callback) {
  return callback();
  setTimeout(callback, 1);
}

function _strError(code) {
  if (code === errors.success) {
    return 'Success';
  } else if (code === errors.keyAlreadyExists) {
    return 'Key already exists';
  } else if (code === errors.keyNotFound) {
    return 'Key not found';
  } else {
    return '';
  }
}

function _cbError(code, message) {
  if (!message) {
    message = _strError(code);
  }
  var err = new Error(message);
  err.code = code;
  return err;
}

function BucketMock() {
  this.isShutdown = false;
  this.values = {};
  this.ddocs = {};
  this.casIdx = 1;

  this.clientVersion = MOCK_VERSION;
}

function _getExpiryDate(expiry) {
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

function _normalizeFmt(fmt) {
  if (fmt === null || fmt === undefined) {
    return format.auto;
  } else if (fmt === 'auto') {
    return format.auto;
  } else if (fmt === 'json') {
    return format.json;
  } else if (fmt === 'utf8') {
    return format.utf8;
  } else if (fmt === 'raw') {
    return format.raw;
  } else {
    return fmt;
  }
}

function _encodeValue(data, fmt) {
  fmt = _normalizeFmt(fmt);

  if (fmt === format.auto) {
    if (Buffer.isBuffer(data)) {
      fmt = format.raw;
    } else {
      fmt = format.json;
    }
  }

  if (fmt === format.raw) {
    if (!Buffer.isBuffer(data)) {
      return null;
    }
  }

  if (fmt === format.json) {
    return [fmt, 'json', JSON.stringify(data)];
  } else if (fmt === format.raw) {
    return [fmt, 'raw', JSON.stringify(data)];
  } else if (fmt === format.utf8) {
    return [fmt, 'utf8', data.toString()];
  }
}

function _decodeValue(data, fmt, flags, iflags) {
  fmt = _normalizeFmt(fmt);

  if (fmt === format.auto) {
    if (flags === 1) {
      fmt = format.json;
    } else if (flags === 2) {
      fmt = format.raw;
    } else if (flags === 3) {
      fmt = format.utf8;
    } else {
      fmt = format.json;
    }
  }

  if (fmt === format.json) {
    if (iflags === 'json' || iflags === 'utf8') {
      return JSON.parse(data);
    } else if (iflags === 'raw') {
      var buf = new Buffer(JSON.parse(data));
      return JSON.parse(buf.toString());
    }
  } else if (fmt === format.raw) {
    if (iflags === 'json' || iflags === 'utf8') {
      return new Buffer(data);
    } else if (iflags === 'raw') {
      return new Buffer(JSON.parse(data));
    }
  } else if (fmt === format.utf8) {
    if (iflags === 'json' || iflags === 'utf8') {
      return data;
    } else if (iflags === 'raw') {
      var bufx = new Buffer(JSON.parse(data));
      return bufx.toString();
    }
  }
}

function _checkResults(results) {
  for (var j in results) {
    if (results.hasOwnProperty(j)) {
      if (results[j].error) {
        return _cbError(errors.checkResults);
      }
    }
  }
  return null;
}

function _normalizeKeys(_keys) {
  var keys = {};
  if (Array.isArray(_keys)) {
    for (var i = 0; i < _keys.length; ++i) {
      if (typeof(_keys[i]) !== 'string') {
        throw new Error('key is not a string');
      }
      keys[_keys[i]] = {};
    }
  } else if(!(_keys instanceof Object)) {
    if (typeof(_keys) !== 'string') {
      throw new Error('key is not a string');
    }
    keys[_keys] = {};
  } else {
    keys = _keys;
  }
  return keys;
}

function _resultDispatch(callback, results, spooled) {
  if (spooled === undefined) {
    spooled = true;
  }

  if (spooled) {
    callback(_checkResults(results), results);
  } else {
    for (var k in results) {
      if (results.hasOwnProperty(k)) {
        if (results[k].error) {
          callback(results[k].error);
        } else {
          callback(null, results[k]);
        }
      }
    }
  }
}

BucketMock.prototype.unlockMulti = function(keys, options, callback) {
  if (!options) {
    options = {};
  }

  var self = this;
  asyncTick(function(){
    if (self.isShutdown) {
      return callback(_cbError(errors.invalidArguments, 'was shutdown'));
    }

    try {
      keys = _normalizeKeys(keys);
    } catch(e) { return callback(e); }

    var results = {};
    for (var key in keys) {
      if (keys.hasOwnProperty(key)) {
        var thisKey = keys[key];

        var value = self.values[key];

        if (value === undefined) {
          results[key] = {error:_cbError(errors.keyNotFound)};
          continue;
        }

        value.locktime = null;
        value.cas = {k:self.casIdx++};

        var result = {
          cas: value.cas
        };
        results[key] = result;
      }
    }

    _resultDispatch(callback, results, options.spooled);
  });
};

BucketMock.prototype.getMulti = function(keys, options, callback) {
  if (!options) {
    options = {};
  }

  var self = this;
  asyncTick(function(){
    if (self.isShutdown) {
      return callback(_cbError(errors.invalidArguments, 'was shutdown'));
    }

    try {
      keys = _normalizeKeys(keys);
    } catch(e) { return callback(e); }

    var results = {};
    for (var key in keys) {
      if (keys.hasOwnProperty(key)) {
        var thisKey = keys[key];
        if (thisKey.expiry === undefined) {
          thisKey.expiry = options.expiry;
        }
        if (thisKey.format === undefined) {
          thisKey.format = options.format;
        }
        if (thisKey.locktime === undefined) {
          thisKey.locktime = options.locktime;
        }

        var value = self.values[key];
        if (value && value.expiry && value.expiry < (new Date())) {
          delete self.values[key];
          value = undefined;
        }
        if (value && value.locktime && value.locktime < (new Date())) {
          value.locktime = undefined;
        }

        if (value === undefined) {
          results[key] = {error:_cbError(errors.keyNotFound)};
          continue;
        }

        if (thisKey.locktime) {
          if (value.locktime) {
            results[key] = {error:_cbError(errors.temporaryError)};
            continue;
          }

          value.locktime = _getExpiryDate(thisKey.locktime);
          value.cas = {k:self.casIdx++};
        }

        if (thisKey.expiry) {
          value.expiry = _getExpiryDate(thisKey.expiry);
        }

        var result = {
          value: _decodeValue(value.value, thisKey.format, value.flags, value.iflags),
          flags: value.flags,
          cas: value.cas
        };
        results[key] = result;
      }
    }

    _resultDispatch(callback, results, options.spooled);
  });
};

BucketMock.prototype.setMulti = function(keys, options, callback) {
  if (!options) {
    options = {};
  }

  var self = this;
  asyncTick(function(){
    if (self.isShutdown) {
      return callback(_cbError(errors.invalidArguments, 'was shutdown'));
    }

    try {
      keys = _normalizeKeys(keys);
    } catch(e) { return callback(e); }

    var results = {};
    for (var key in keys) {
      if (keys.hasOwnProperty(key)) {
        var thisKey = keys[key];
        if (thisKey.value === undefined) {
          thisKey.value = options.value;
        }
        if (thisKey.cas === undefined) {
          thisKey.cas = options.cas;
        }
        if (thisKey.expiry === undefined) {
          thisKey.expiry = options.expiry;
        }
        if (thisKey.format === undefined) {
          thisKey.format = options.format;
        }
        if (thisKey.flags === undefined) {
          thisKey.flags = options.flags;
        }

        var value = self.values[key];
        if (value && value.expiry && value.expiry < (new Date())) {
          delete self.values[key];
          value = undefined;
        }
        if (value && value.locktime && value.locktime < (new Date())) {
          value.locktime = undefined;
        }

        if (value && value.locktime && value.cas !== thisKey.cas) {
          results[key] = {error: _cbError(errors.temporaryError)};
          continue;
        }

        if (thisKey.cas) {
          if (value && value.cas !== thisKey.cas) {
            results[key] = {error: _cbError(errors.keyAlreadyExists)};
            continue;
          }
        }

        var encData = _encodeValue(thisKey.value, thisKey.format);
        if (!encData) {
          results[key] = {error: new Error('failed to encode value for storage')};
          continue;
        }

        var flags = encData[0];
        if (thisKey.flags) {
          flags = thisKey.flags;
        }

        var newValue = {
          value: encData[2],
          flags: flags,
          iflags: encData[1],
          cas: {k:self.casIdx++},
          expiry: _getExpiryDate(thisKey.expiry),
          locktime: null
        };
        self.values[key] = newValue;

        var result = {
          cas: newValue.cas
        };
        results[key] = result;
      }
    }

    _resultDispatch(callback, results, options.spooled);
  });
};

BucketMock.prototype.replaceMulti = function(keys, options, callback) {
  if (!options) {
    options = {};
  }

  var self = this;
  asyncTick(function(){
    if (self.isShutdown) {
      return callback(_cbError(errors.invalidArguments, 'was shutdown'));
    }

    try {
      keys = _normalizeKeys(keys);
    } catch(e) { return callback(e); }

    var results = {};
    for (var key in keys) {
      if (keys.hasOwnProperty(key)) {
        var thisKey = keys[key];
        if (thisKey.value === undefined) {
          thisKey.value = options.value;
        }
        if (thisKey.cas === undefined) {
          thisKey.cas = options.cas;
        }
        if (thisKey.expiry === undefined) {
          thisKey.expiry = options.expiry;
        }
        if (thisKey.format === undefined) {
          thisKey.format = options.format;
        }
        if (thisKey.flags === undefined) {
          thisKey.flags = options.flags;
        }

        var value = self.values[key];
        if (value && value.expiry && value.expiry < (new Date())) {
          delete self.values[key];
          value = undefined;
        }
        if (value && value.locktime && value.locktime < (new Date())) {
          value.locktime = undefined;
        }

        if (value === undefined) {
          results[key] = {error:_cbError(errors.keyNotFound)};
          continue;
        }

        if (value && value.locktime && value.cas !== thisKey.cas) {
          results[key] = {error: _cbError(errors.temporaryError)};
          continue;
        }

        if (thisKey.cas) {
          if (value && value.cas !== thisKey.cas) {
            results[key] = {error: _cbError(errors.keyAlreadyExists)};
            continue;
          }
        }

        var encData = _encodeValue(thisKey.value, thisKey.format);
        if (!encData) {
          results[key] = {error: new Error('failed to encode value for storage')};
          continue;
        }

        var flags = encData[0];
        if (thisKey.flags) {
          flags = thisKey.flags;
        }

        var newValue = {
          value: encData[2],
          flags: flags,
          iflags: encData[1],
          cas: {k:self.casIdx++},
          expiry: _getExpiryDate(thisKey.expiry),
          locktime: null
        };
        self.values[key] = newValue;

        var result = {
          cas: newValue.cas
        };
        results[key] = result;
      }
    }

    _resultDispatch(callback, results, options.spooled);
  });
};

BucketMock.prototype.preappMulti = function(side, keys, options, callback) {
  if (!options) {
    options = {};
  }

  var self = this;
  asyncTick(function(){
    if (self.isShutdown) {
      return callback(_cbError(errors.invalidArguments, 'was shutdown'));
    }

    try {
      keys = _normalizeKeys(keys);
    } catch(e) { return callback(e); }

    var results = {};
    for (var key in keys) {
      if (keys.hasOwnProperty(key)) {
        var thisKey = keys[key];
        if (thisKey.value === undefined) {
          thisKey.value = options.value;
        }
        if (thisKey.cas === undefined) {
          thisKey.cas = options.cas;
        }
        if (thisKey.expiry === undefined) {
          thisKey.expiry = options.expiry;
        }

        var value = self.values[key];
        if (value && value.expiry && value.expiry < (new Date())) {
          delete self.values[key];
          value = undefined;
        }
        if (value && value.locktime && value.locktime < (new Date())) {
          value.locktime = undefined;
        }

        if (value === undefined) {
          results[key] = {error:_cbError(errors.notStored)};
          continue;
        }

        if (value && value.locktime && value.cas !== thisKey.cas) {
          results[key] = {error: _cbError(errors.temporaryError)};
          continue;
        }

        if (thisKey.cas) {
          if (value && value.cas !== thisKey.cas) {
            results[key] = {error: _cbError(errors.keyAlreadyExists)};
            continue;
          }
        }

        if (side === +1) {
          value.value = value.value + thisKey.value;
        } else if (side === -1) {
          value.value = thisKey.value + value.value;
        }
        value.cas = {k:self.casIdx++};

        var result = {
          cas: value.cas
        };
        results[key] = result;
      }
    }

    _resultDispatch(callback, results, options.spooled);
  });
};

BucketMock.prototype.prependMulti = function(keys, options, callback) {
  return this.preappMulti(-1, keys, options, callback);
};

BucketMock.prototype.appendMulti = function(keys, options, callback) {
  return this.preappMulti(+1, keys, options, callback);
};

BucketMock.prototype.removeMulti = function(keys, options, callback) {
  if (!options) {
    options = {};
  }

  var self = this;
  asyncTick(function(){
    if (self.isShutdown) {
      return callback(_cbError(errors.invalidArguments, 'was shutdown'));
    }

    try {
      keys = _normalizeKeys(keys);
    } catch(e) { return callback(e); }

    var results = {};
    for (var key in keys) {
      if (keys.hasOwnProperty(key)) {
        var thisKey = keys[key];
        if (thisKey.cas === undefined) {
          thisKey.cas = options.cas;
        }

        var value = self.values[key];
        if (value && value.expiry && value.expiry < (new Date())) {
          delete self.values[key];
          value = undefined;
        }

        if (value === undefined) {
          results[key] = {error:_cbError(errors.keyNotFound)};
          continue;
        }

        if (thisKey.cas && value.cas !== thisKey.cas) {
          results[key] = {error: _cbError(errors.keyAlreadyExists)};
          continue;
        }

        delete self.values[key];

        var result = {
          cas: null
        };
        results[key] = result;
      }
    }

    _resultDispatch(callback, results, options.spooled);
  });
};

BucketMock.prototype.get = function(key, options, callback) {
  if (callback === undefined) {
    callback = options;
    options = {};
  }

  this.getMulti([key], options, function(err, results) {
    if (err && err.code === errors.checkResults) {
      return callback(results[key].error);
    } else if (err) {
      return callback(err);
    }
    callback(null, results[key]);
  });
};

BucketMock.prototype.set = function(key, value, options, callback) {
  if (callback === undefined) {
    callback = options;
    options = {};
  }

  options.value = value;

  this.setMulti([key], options, function(err, results) {
    if (err && err.code === errors.checkResults) {
      return callback(results[key].error);
    } else if (err) {
      return callback(err);
    }
    callback(null, results[key]);
  });
};

BucketMock.prototype.prepend = function(key, value, options, callback) {
  if (callback === undefined) {
    callback = options;
    options = {};
  }

  options.value = value;

  this.prependMulti([key], options, function(err, results) {
    if (err && err.code === errors.checkResults) {
      return callback(results[key].error);
    } else if (err) {
      return callback(err);
    }
    callback(null, results[key]);
  });
};

BucketMock.prototype.append = function(key, value, options, callback) {
  if (callback === undefined) {
    callback = options;
    options = {};
  }

  options.value = value;

  this.appendMulti([key], options, function(err, results) {
    if (err && err.code === errors.checkResults) {
      return callback(results[key].error);
    } else if (err) {
      return callback(err);
    }
    callback(null, results[key]);
  });
};

BucketMock.prototype.lockMulti = BucketMock.prototype.getMulti;
BucketMock.prototype.lock = function(key, options, callback) {
  if (callback === undefined) {
    callback = options;
    options = {};
  }

  this.lockMulti([key], options, function(err, results) {
    if (err && err.code === errors.checkResults) {
      return callback(results[key].error);
    } else if (err) {
      return callback(err);
    }
    callback(null, results[key]);
  });
};

BucketMock.prototype.unlock = function(key, options, callback) {
  if (callback === undefined) {
    callback = options;
    options = {};
  }

  this.unlockMulti([key], options, function(err, results) {
    if (err && err.code === errors.checkResults) {
      return callback(results[key].error);
    } else if (err) {
      return callback(err);
    }
    callback(null, results[key]);
  });
};

BucketMock.prototype.replace = function(key, value, options, callback) {
  if (callback === undefined) {
    callback = options;
    options = {};
  }

  options.value = value;

  this.replaceMulti([key], options, function(err, results) {
    if (err && err.code === errors.checkResults) {
      return callback(results[key].error);
    } else if (err) {
      return callback(err);
    }
    callback(null, results[key]);
  });
};

BucketMock.prototype.add = function(key, value, options, callback) {
  if (callback === undefined) {
    callback = options;
    options = {};
  }

  var self = this;
  asyncTick(function(){
    if (self.isShutdown) {
      return callback(_cbError(errors.invalidArguments, 'was shutdown'));
    }

    if (self.values[key]) {
      return callback(_cbError(errors.keyAlreadyExists));
    }

    var encData = _encodeValue(value, options.format);
    if (!encData) {
      return callback(new Error('failed to encode value for storage'));
    }

    var flags = encData[0];
    if (options.flags) {
      flags = options.flags;
    }

    var newValue = {
      value: encData[2],
      flags: flags,
      iflags: encData[1],
      cas: {k:self.casIdx++},
      expiry: _getExpiryDate(options.expiry)
    };
    self.values[key] = newValue;

    var result = {
      cas: newValue.cas
    };
    callback(null, result);
  });
};

BucketMock.prototype._arithmetic = function(off, key, options, callback) {
  if (!callback) {
    callback = options;
    options = {};
  }
  if (!options) {
    options = {};
  }
  if (!options.offset) {
    options.offset = 1;
  }
  options.offset *= off;

  var self = this;
  asyncTick(function(){
    if (self.isShutdown) {
      return callback(_cbError(errors.invalidArguments, 'was shutdown'));
    }

    var value = self.values[key];
    if (value && value.expiry && value.expiry < (new Date())) {
      delete self.values[key];
      value = undefined;
    }

    if (value === undefined && options.initial === undefined) {
      return callback(_cbError(errors.keyNotFound));
    }

    if (value) {
      var valInt = parseInt(value.value, 10);
      valInt += options.offset;
      value.value = '' + valInt;
    } else {
      value = {
        value: '' + options.initial,
        flags: 0,
        iflags: 'utf8',
        cas: null,
        expiry: null
      };
      self.values[key] = value;
    }

    if (options.expiry) {
      var newExpiry = _getExpiryDate(options.expiry);
      value.expiry = newExpiry;
    }

    value.cas = {k:self.casIdx++};

    var result = {
      value: value.value,
      flags: value.flags,
      cas: value.cas
    };
    callback(null, result);
  });
}
BucketMock.prototype.incr = function(key, options, callback) {
  this._arithmetic(+1, key, options, callback);
};
BucketMock.prototype.decr = function(key, options, callback) {
  this._arithmetic(-1, key, options, callback);
};

BucketMock.prototype.remove = function(key, options, callback) {
  if (callback === undefined) {
    callback = options;
    options = {};
  }

  this.removeMulti([key], options, function(err, results) {
    if (err && err.code === errors.checkResults) {
      return callback(results[key].error);
    } else if (err) {
      return callback(err);
    }
    callback(null, results[key]);
  });
};

BucketMock.prototype.setDesignDoc = function(name, data, callback) {
  var self = this;
  asyncTick(function(){
    self.ddocs[name] = data;
    callback(null);
  });
};
BucketMock.prototype.getDesignDoc = function(name, callback) {
  var self = this;
  asyncTick(function(){
    var ddoc = self.ddocs[name];
    if (!ddoc) {
      callback(new Error('not_found'), null);
    } else {
      callback(null, ddoc);
    }
  });
}
BucketMock.prototype.removeDesignDoc = function(name, callback) {
  var self = this;
  asyncTick(function() {
    delete self.ddocs[name];
    callback(null);
  });
};

BucketMock.prototype._indexView = function(ddoc, name, options, callback) {
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

  var curdocinfo = null;
  var curdockey = null;
  function emit(key, val) {
    retvals.push({
      key: key,
      id: curdockey,
      value: val,
      doc: {
        json: JSON.parse(curdocinfo.value),
        meta: {
          id: curdockey
        }
    }});
  }

  var procOne = function(doc,meta){};
  eval('procOne = ' + viewMapFunc);

  for (var i in this.values) {
    if (this.values.hasOwnProperty(i)) {
      curdockey = i;
      curdocinfo = this.values[i];
      procOne(JSON.parse(curdocinfo.value), {id: i});
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
        for(i=0; i < values.length; i++) {
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

function cbCompare(a, b) {
  if (a < b) { return -1; }
  if (a > b) { return +1; }
  return 0;
}

function cbIndexOf(arr, val) {
  for (var i = 0; i < arr.length; ++i) {
    if (cbCompare(arr[i], val) === 0) {
      return i;
    }
  }
  return -1;
}

function cbNormKey(key, group_level) {
  if (Array.isArray(key)) {
    if (group_level === 0) return null;
    return key.slice(0, group_level);
  } else {
    return key;
  }
}

BucketMock.prototype._view = function(ddoc, name, options, callback) {
  this._indexView(ddoc, name, options, function(err, results, reducer) {
    if (err) {
      callback(err);
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
        if (keys.indexOf(dockey) < 0) {
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
      results = results.slice(options.skip, options.limit);
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

BucketMock.prototype.view = function(ddoc, name, query) {
  var vq = query === undefined ? {} : query;
  return new ViewQuery(this, ddoc, name, vq);
};

BucketMock.prototype.shutdown = function() {
  this.isShutdown = true;
};

BucketMock.prototype.strError = _strError;

BucketMock.prototype.vbMappingInfo = function(key) {
  return [0, 0];
};

BucketMock.prototype.on = function(evt, callback) {
  // Nothing for Now
};

module.exports.Connection = BucketMock;
module.exports.errors = errors;
module.exports.format = format;