const binding = require('./binding');
const sdutils = require('./sdutils');
const enums = require('./enums');
const BinaryCollection = require('./binarycollection');
const LookupInSpec = require('./lookupinspec');

function durabilityModeToLcbConst(mode) {
  // Unspecified is allowed, and means no sync durability.
  if (mode === null || mode === undefined) {
    return binding.LCB_DURABILITYLEVEL_NONE;
  }

  if (mode === enums.DurabilityLevel.None) {
    return binding.LCB_DURABILITYLEVEL_NONE;
  } else if (mode === enums.DurabilityLevel.Majority) {
    return binding.LCB_DURABILITYLEVEL_MAJORITY;
  } else if (mode === enums.DurabilityLevel.MajorityAndPersistOnMaster) {
    return binding.LCB_DURABILITYLEVEL_MAJORITY_AND_PERSIST_ON_MASTER;
  } else if (mode === enums.DurabilityLevel.PersistToMajority) {
    return binding.LCB_DURABILITYLEVEL_PERSIST_TO_MAJORITY;
  } else {
    throw new Error('Invalid durability level specified');
  }
}

function replicaModeToLcbConst(mode) {
  if (mode === enums.ReplicaMode.Any) {
    return binding.LCB_REPLICA_MODE_ANY;
  } else if (mode === enums.ReplicaMode.All) {
    return binding.LCB_REPLICA_MODE_ALL;
  } else if (mode === enums.ReplicaMode.Replica1) {
    return binding.LCB_REPLICA_MODE_IDX0;
  } else if (mode === enums.ReplicaMode.Replica1) {
    return binding.LCB_REPLICA_MODE_IDX1;
  } else if (mode === enums.ReplicaMode.Replica1) {
    return binding.LCB_REPLICA_MODE_IDX2;
  } else {
    throw new Error('Invalid replica mode specified');
  }
}

/**
 *
 */
class Collection {
  /**
   * This should never be invoked directly by an application.
   * 
   * @hideconstructor
   */
  constructor(scope, collectionName) {
    this._scope = scope;
    this._name = collectionName;
    this._conn = scope._conn;
  }

  _checkKeyParam(key) {
    if (typeof key !== 'string' && !(key instanceof Buffer)) {
      throw new TypeError(
        '`key` parameter expected to be a string or Buffer.');
    }
  }

  _checkCtrDeltaParam(value) {
    if (typeof value !== 'number') {
      throw new TypeError('`value` parameter expected to be an integer.');
    }
  }

  _checkCasParam(cas) {
    if (cas !== undefined) {
      if (typeof cas !== 'object' && typeof cas !== 'string') {
        throw new TypeError(
          '`cas` parameter needs to be a CAS object or string.');
      }
    }
  }

  _checkExpiryParam(expiry) {
    if (typeof expiry !== 'number') {
      throw new TypeError(
        '`expiry` parameter expected to be a number or date.');
    }
  }

  _checkLockTimeParam(lockTime) {
    if (typeof lockTime !== 'number') {
      throw new TypeError('`lockTime` parameter expected to be a number.');
    }
  }

  _checkOptionsParam(options) {
    if (typeof options !== 'object') {
      throw new TypeError(
        '`options` parameter expected to be an object or missing.');
    }
  }

  _checkCallbackParam(callback) {
    if (callback && typeof callback !== 'function') {
      throw new TypeError(
        '`callback` parameter expected to be a function or missing.');
    }
  }

  _checkTimeoutOption(options) {

  }

  _checkExpiryOption(options) {
    if (options.expiry !== undefined) {
      if (typeof options.expiry !== 'number') {
        throw new TypeError('`expiry` option expected to be a number.');
      }
      if (options.expiry < 0 || options.expiry > 2147483647) {
        throw new TypeError(
          '`expiry` option needs to between 0 and 2147483647.');
      }
    }
  }

  _checkCasOption(options) {
    if (options.cas !== undefined) {
      if (typeof options.cas !== 'object' && typeof options.cas !==
        'string') {
        throw new TypeError(
          '`cas` option needs to be a CAS object or string.');
      }
    }
  }

  _checkDuraOption(options) {
    if (options.persist_to !== undefined) {
      if (typeof options.persist_to !== 'number' ||
        options.persist_to < 0 || options.persist_to > 8) {
        throw new TypeError(
          '`persist_to` option needs to be an integer between 0 and 8.');
      }
    }
    if (options.replicate_to !== undefined) {
      if (typeof options.replicate_to !== 'number' ||
        options.replicate_to < 0 || options.replicate_to > 8) {
        throw new TypeError(
          '`replicate_to` option needs to be an integer between 0 and 8.');
      }
    }
  }

  async _promisify(fn, baseCallback) {
    return new Promise((resolve, reject) => {
      fn((err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
        if (baseCallback) {
          baseCallback(err, res);
        }
      });
    });
  }

  /**
   * Contains the results from a previously execute Get operation.
   * 
   * SDK Note: The content in this result would normally be implemented through
   * a `contentAs` method, but this is not relevant to Node.js.
   * 
   * @typedef {Object} GetResult
   * @property {*} content
   * @property {Cas} cas
   * @property {integer} [expiry]
   */
  /**
   * @typedef {function(Error, GetResult)} GetCallback
   */
  /**
   * 
   * @param {string} key 
   * @param {*} [options]
   * @param {string[]} [options.project]
   * @param {boolean} [options.withExpiry=false]
   * @param {integer} [options.timeout]
   * @param {GetCallback} [callback]
   * @returns {Promise<GetResult>}
   */
  async get(key, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    this._checkKeyParam(key);
    this._checkOptionsParam(options);
    this._checkTimeoutOption(options);
    this._checkCallbackParam(callback);

    if (options.project || options.withExpiry) {
      return this._projectedGet(key, options, callback);
    }

    return this._promisify((promCb) => {
      this._conn.get(
        this._scope._name, this._name,
        key, 0, 0, options.timeout, promCb);
    }, callback);
  }

  async _projectedGet(key, options, callback) {
    var expiryStart = -1;
    var projStart = -1;
    var paths = [];
    var spec = [];

    if (options.withExpiry) {
      expiryStart = spec.length;
      spec.push(LookupInSpec.get(LookupInSpec.Expiry));
    }

    projStart = spec.length;
    if (!options.project) {
      paths.push('');
      spec.push(LookupInSpec.get(''));
    } else {
      var projects = options.project;
      if (!Array.isArray(projects)) {
        projects = [projects];
      }

      for (var i = 0; i < projects.length; ++i) {
        paths.push(projects[i]);
        spec.push(LookupInSpec.get(projects[i]));
      }
    }

    return this.lookupIn(key, spec, options).catch((err) => {
      if (callback) {
        callback(err, null);
      }
      throw err;
    }).then((res) => {
      var outRes = {};
      outRes.cas = res.cas;
      outRes.value = null;

      if (expiryStart >= 0) {
        var expiryRes = res.results[expiryStart];
        outRes.expiry = expiryRes.value;
      }
      if (projStart >= 0) {
        for (var i = 0; i < paths.length; ++i) {
          var projPath = paths[i];
          var projRes = res.results[projStart + i];
          if (!projRes.error) {
            outRes.value = sdutils.sdInsertByPath(outRes.value, projPath,
              projRes.value);
          }
        }
      }

      if (callback) {
        callback(null, outRes);
      }
      return outRes;
    });
  }

  // TODO: Implement replica mode enum
  /**
   * 
   * @param {string} key 
   * @param {ReplicaMode} mode
   * @param {*} [options]
   * @param {integer} [options.timeout]
   * @param {GetCallback} [callback]
   * @returns {Promise<GetResult>}
   */
  async getFromReplica(key, mode, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    this._checkKeyParam(key);
    // TODO: Implement replica mode enum
    //this._checkReplicaModeParam(mode);
    this._checkOptionsParam(options);
    this._checkTimeoutOption(options);
    this._checkCallbackParam(callback);

    const lcbMode = replicaModeToLcbConst(mode);

    return this._promisify((promCb) => {
      this._conn.getReplica(
        this._scope._name, this._name,
        key, lcbMode,
        options.timeout, promCb);
    }, callback);
  }

  async _store(opType, key, value, options, callback) {
    if (options instanceof Function) {
      callback = arguments[3];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    this._checkKeyParam(key);
    this._checkOptionsParam(options);
    this._checkExpiryOption(options);
    this._checkDuraOption(options);
    this._checkTimeoutOption(options);
    this._checkCallbackParam(callback);

    const lcbDuraMode = durabilityModeToLcbConst(options.durabilityLevel);
    const persistTo = options.durabilityPersistTo;
    const replicateTo = options.durabilityReplicateTo;

    // TODO: Pass durability
    return this._promisify((promCb) => {
      this._conn.store(this._scope._name, this._name,
        key, value, options.expiry, options.cas,
        lcbDuraMode, persistTo, replicateTo,
        options.timeout, opType,
        (err, res) => {
          promCb(err, res);
        });
    }, callback);
  }

  /**
   * Contains the results from a previously execute Get operation.
   * 
   * 
   * @typedef {Object} MutationResult
   * @property {Cas} cas
   * @property {MutationToken} [mutationToken]
   */
  /**
   * @typedef {function(Error, MutationResult)} MutationCallback
   */
  /**
   * 
   * @param {string} key 
   * @param {*} value 
   * @param {*} options 
   * @param {integer} [options.timeout]
   * @param {MutationCallback} callback 
   * @throws LotsOfStuff
   * @returns {Promise<MutationResult>}
   */
  async insert(key, value, options, callback) {
    return this._store(binding.LCB_STORE_ADD,
      key, value, options, callback);
  }
  /**
   * 
   * @param {string} key 
   * @param {*} value 
   * @param {*} [options]
   * @param {integer} [options.timeout]
   * @param {MutationCallback} callback 
   * @throws LotsOfStuff
   * @returns {Promise<MutationResult>}
   */
  async upsert(key, value, options, callback) {
    return this._store(binding.LCB_STORE_SET,
      key, value, options, callback);
  }
  /**
   * 
   * @param {string} key 
   * @param {*} value 
   * @param {*} options 
   * @param {integer} [options.timeout]
   * @param {Cas} [options.cas]
   * @param {MutationCallback} callback 
   * @throws LotsOfStuff
   * @returns {Promise<MutationResult>}
   */
  async replace(key, value, options, callback) {
    return this._store(binding.LCB_STORE_REPLACE,
      key, value, options, callback);
  }

  /**
   * @typedef {Object} RemoveResult
   * @property {Cas} cas
   * @property {MutationToken} [mutationToken]
   */
  /**
   * @typedef {function(Error, RemoveResult)} RemoveCallback
   */
  /**
   * 
   * @param {string} key 
   * @param {*} options 
   * @param {integer} [options.timeout]
   * @param {RemoveCallback} [callback]
   * @returns {Promise<RemoveResult>}
   */
  async remove(key, options, callback) {
    if (options instanceof Function) {
      callback = arguments[1];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    this._checkKeyParam(key);
    this._checkOptionsParam(options);
    this._checkCasOption(options);
    this._checkDuraOption(options);
    this._checkTimeoutOption(options);
    this._checkCallbackParam(callback);

    // TODO: Pass durability
    return this._promisify((promCb) => {
      this._conn.remove(this._scope._name, this._name,
        key, options.cas, options.timeout, promCb);
    }, callback);
  }

  /**
   * @typedef {Object} GetAndTouchResult
   * @property {*} content
   * @property {Cas} cas
   * @property {MutationToken} [mutationToken]
   */
  /**
   * @typedef {function(Error, GetAndTouchResult)} GetAndTouchCallback
   */
  /**
   * 
   * @param {string} key 
   * @param {integer} expiry 
   * @param {*} [options]
   * @param {GetAndTouchCallback} [callback]
   * @returns {Promise<GetAndTouchResult>}
   */
  async getAndTouch(key, expiry, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    // TODO: RFC change timeout to expiry?

    this._checkKeyParam(key);
    this._checkExpiryParam(expiry);
    this._checkOptionsParam(options);
    this._checkTimeoutOption(options);
    this._checkCallbackParam(callback);

    // TODO: Implement durability
    return this._promisify((promCb) => {
      this._conn.get(this._scope._name, this._name,
        key, expiry, 0, options.timeout, promCb);
    }, callback);
  }

  /**
   * @typedef {Object} TouchResult
   * @property {Cas} cas
   * @property {MutationToken} [mutationToken]
   */
  /**
   * @typedef {function(Error, TouchResult)} TouchCallback
   */
  /**
   * 
   * @param {string} key 
   * @param {integer} expiry 
   * @param {*} [options]
   * @param {integer} [options.timeout]
   * @param {TouchCallback} [callback]
   * @returns {Promise<TouchResult>}
   */
  async touch(key, expiry, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    // TODO: RFC change timeout to expiry?

    this._checkKeyParam(key);
    this._checkExpiryParam(expiry);
    this._checkOptionsParam(options);
    this._checkTimeoutOption(options);
    this._checkCallbackParam(callback);

    // TODO: Implement durability
    return this._promisify((promCb) => {
      this._conn.touch(this._scope._name, this._name,
        key, expiry, options.timeout, promCb);
    }, callback);
  }

  /**
   * @typedef {Object} GetAndLockResult
   * @property {*} content
   * @property {Cas} cas
   * @property {MutationToken} [mutationToken]
   */
  /**
   * @typedef {function(Error, GetAndLockResult)} GetAndLockCallback
   */
  /**
   * 
   * @param {string} key 
   * @param {integer} lockTime
   * @param {*} [options] 
   * @param {integer} [options.timeout]
   * @param {GetAndLockCallback} [callback] 
   * @returns {Promise<GetAndLockCallback>}
   */
  async getAndLock(key, lockTime, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    this._checkKeyParam(key);
    this._checkLockTimeParam(lockTime);
    this._checkOptionsParam(options);
    this._checkTimeoutOption(options);
    this._checkCallbackParam(callback);

    // TODO: Implement durability
    return this._promisify((promCb) => {
      this._conn.get(this._scope._name, this._name,
        key, 0, lockTime, options.timeout, promCb);
    }, callback);
  }

  /**
   * @typedef {Object} UnlockResult
   * @property {*} content
   * @property {Cas} cas
   * @property {MutationToken} [mutationToken]
   */
  /**
   * @typedef {function(Error, UnlockResult)} UnlockCallback
   */
  /**
   * 
   * @param {string} key 
   * @param {Cas} cas
   * @param {*} [options] 
   * @param {integer} [options.timeout]
   * @param {UnlockCallback} [callback] 
   * @returns {Promise<UnlockResult>}
   */
  async unlock(key, cas, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    this._checkKeyParam(key);
    this._checkCasParam(cas);
    this._checkOptionsParam(options);
    this._checkTimeoutOption(options);
    this._checkCallbackParam(callback);

    // TODO: Implement durability
    return this._promisify((promCb) => {
      this._conn.unlock(
        this._scope._name, this._name,
        key, cas, options.timeout, promCb);
    }, callback);
  }

  async _counter(key, delta, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    this._checkKeyParam(key);
    this._checkCtrDeltaParam(delta);
    this._checkOptionsParam(options);
    this._checkTimeoutOption(options);
    this._checkCallbackParam(callback);

    // TODO: Pass durability
    return this._promisify((promCb) => {
      this._conn.counter(this._scope._name, this._name,
        key, delta, options.initial, options.expiry,
        options.timeout, (err, res) => {
          promCb(err, res);
        });
    }, callback);
  }

  async _binaryIncrement(key, value, options, callback) {
    return this._counter(key, +value, options, callback);
  }

  async _binaryDecrement(key, value, options, callback) {
    return this._counter(key, -value, options, callback);
  }

  async _binaryAppend(key, value, options, callback) {
    return this._store(binding.LCB_STORE_APPEND,
      key, value, options, callback);
  }

  async _binaryPrepend(key, value, options, callback) {
    return this._store(binding.LCB_STORE_PREPEND,
      key, value, options, callback);
  }

  /**
   * @typedef {Object} LookupInResult
   * @property {*} content
   */
  /**
   * @typedef {function(Error, LookupInResult)} LookupInCallback
   */
  /**
   * @param {string} key
   * @param {LookupInSpec[]} spec
   * @param {*} [options]
   * @param {integer} [options.timeout]
   * @param {LookupInCallback} [callback]
   * @returns {Promise<LookupInResult>}
   */
  async lookupIn(key, spec, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    var flags = 0;

    var cmdData = [];
    for (var i = 0; i < spec.length; ++i) {
      cmdData.push(spec[i]._op);
      cmdData.push(spec[i]._flags);
      cmdData.push(spec[i]._path);
    }

    return this._promisify((promCb) => {
      this._conn.lookupIn(
        this._scope._name, this._name,
        key, flags, ...cmdData, options.timeout,
        (err, res) => {
          if (res && res.results) {
            for (var i = 0; i < res.results.length; ++i) {
              var itemRes = res.results[i];
              if (itemRes.value) {
                itemRes.value = JSON.parse(itemRes.value);
              }
            }
          }
          promCb(err, res);
        });
    }, callback);
  }

  /**
   * @typedef {Object} MutateInResult
   * @property {*} content
   */
  /**
   * @typedef {function(Error, MutateInResult)} MutateInCallback
   */
  /**
   * @param {string} key
   * @param {MutateInSpec} spec
   * @param {*} [options]
   * @param {integer} [options.timeout]
   * @param {MutateInCallback} [callback]
   * @returns {Promise<MutateInResult>}
   */
  async mutateIn(key, spec, options, callback) {
    if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    var flags = 0;

    var cmdData = [];
    for (var i = 0; i < spec.length; ++i) {
      cmdData.push(spec[i]._op);
      cmdData.push(spec[i]._flags);
      cmdData.push(spec[i]._path);
      cmdData.push(spec[i]._data);
    }

    return this._promisify((promCb) => {
      this._conn.mutateIn(
        this._scope._name, this._name,
        key, options.expiry, options.cas,
        flags, ...cmdData, options.timeout,
        (err, res) => {
          promCb(err, res);
        });
    }, callback);
  }

  /**
   * @typedef {Object} QueryResult
   * @property {Object[]} rows
   */
  /**
   * @typedef {function(Error, QueryResult)} QueryCallback
   */
  /**
   * 
   * @param {string} query
   * The query string to execute. 
   * @param {Object|Array} [params]
   * @param {*} [options]
   * @param {QueryConsistencyMode} [options.consistency]
   * @param {MutationState} [options.consistentWith]
   * @param {boolean} [options.adhoc]
   * @param {number} [options.scanCap]
   * @param {number} [options.pipelineBatch]
   * @param {number} [options.pipelineCap]
   * @param {boolean} [options.readonly]
   * @param {QueryProfileMode} [options.profile]
   * @param {integer} [options.timeout]
   * @param {QueryCallback} [callback]
   * @throws LotsOfStuff
   * @returns {Promise<QueryResult>}
   */
  async query(query, params, options, callback) {
    if (params instanceof Function) {
      callback = arguments[1];
      params = undefined;
      options = undefined;
    } else if (options instanceof Function) {
      callback = arguments[2];
      options = undefined;
    }
    if (!options) {
      options = {};
    }

    if (options.scope) {
      throw new Error('cannot specify a scope name for this query');
    }
    if (options.collection) {
      throw new Error('cannot specify a collection name for this query');
    }

    var scope = this._scope;
    var bucket = scope._bucket;

    options.scope = scope._name;
    options.collection = this._name;

    return bucket.query(query, params, options, callback);
  }

  binary() {
    return new BinaryCollection(this);
  }

}

Collection.DEFAULT_NAME = '_default';

module.exports = Collection;
