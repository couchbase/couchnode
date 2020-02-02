const events = require('events');
const binding = require('./binding');
const sdutils = require('./sdutils');
const enums = require('./enums');
const errors = require('./errors');
const datastructures = require('./datastructures');
const BinaryCollection = require('./binarycollection');
const LookupInSpec = require('./lookupinspec');
const PromiseHelper = require('./promisehelper');

function _durabilityModeToLcbConst(mode) {
  // Unspecified is allowed, and means no sync durability.
  if (mode === null || mode === undefined) {
    return binding.LCB_DURABILITYLEVEL_NONE;
  }

  if (mode === enums.DurabilityLevel.None) {
    return binding.LCB_DURABILITYLEVEL_NONE;
  } else if (mode === enums.DurabilityLevel.Majority) {
    return binding.LCB_DURABILITYLEVEL_MAJORITY;
  } else if (mode === enums.DurabilityLevel.MajorityAndPersistOnMaster) {
    return binding.LCB_DURABILITYLEVEL_MAJORITY_AND_PERSIST_TO_ACTIVE;
  } else if (mode === enums.DurabilityLevel.PersistToMajority) {
    return binding.LCB_DURABILITYLEVEL_PERSIST_TO_MAJORITY;
  } else {
    throw new Error('Invalid durability level specified');
  }
}

/**
 * Collection provides an interface for performing operations against
 * a collection within the cluster.
 */
class Collection {
  /**
   * @hideconstructor
   */
  constructor(scope, collectionName) {
    this._scope = scope;
    this._name = collectionName;
  }

  get _conn() {
    return this._scope._conn;
  }

  get _transcoder() {
    return this._scope._transcoder;
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

  _checkTranscoderOption(options) {
    if (options.transcoder !== undefined) {
      if (typeof options.transcoder !== 'object') {
        throw new TypeError(
          '`transcoder` option must be an object matching the Transcoder interface.');
      }
      if (typeof options.transcoder.encode !== 'function') {
        throw new TypeError(
          '`transcoder` option must be implement an encode method.');
      }
      if (typeof options.transcoder.decode !== 'function') {
        throw new TypeError(
          '`transcoder` option must be implement a decode method.');
      }
    }
  }

  _selectTranscoder(transcoderOverride) {
    if (transcoderOverride) {
      return transcoderOverride;
    }

    return this._transcoder;
  }

  /**
   * Contains the results from a previously execute Get operation.
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
   * @param {Transcoder} [options.transcoder]
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
    this._checkTranscoderOption(options);
    this._checkCallbackParam(callback);

    if (options.project || options.withExpiry) {
      return this._projectedGet(key, options, callback);
    }

    const transcoder = this._selectTranscoder(options.transcoder);

    return PromiseHelper.wrap((promCb) => {
      this._conn.get(
        this._scope._name, this._name,
        key, transcoder,
        0, 0, options.timeout * 1000,
        (err, cas, value) => {
          err = errors.wrapLcbErr(err);
          if (err) {
            return promCb(err);
          }

          promCb(err, {
            cas: cas,
            value: value
          });
        });
    }, callback);
  }

  async _projectedGet(key, options, callback) {
    var expiryStart = -1;
    var projStart = -1;
    var paths = [];
    var spec = [];
    var needReproject = false;

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

    // The following code relies on the projections being
    // the last segment of the specs array, this way we handle
    // an overburdened operation in a single area.
    if (spec.length > 16) {
      spec = spec.splice(0, projStart);
      spec.push(LookupInSpec.get(''));
      needReproject = true;
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
        if (!needReproject) {
          for (var i = 0; i < paths.length; ++i) {
            var projPath = paths[i];
            var projRes = res.results[projStart + i];
            if (!projRes.error) {
              outRes.value = sdutils.sdInsertByPath(outRes.value, projPath,
                projRes.value);
            }
          }
        } else {
          outRes.value = {};

          var projRes = res.results[projStart];
          for (var i = 0; i < paths.length; ++i) {
            var projPath = paths[i];
            var value = sdutils.sdGetByPath(projRes.value, projPath);
            outRes.value = sdutils.sdInsertByPath(outRes.value, projPath, value);
          }
        }
      }

      if (callback) {
        callback(null, outRes);
      }
      return outRes;
    });
  }

  /**
   * Contains the results from a previously execute Get operation.
   *
   * @typedef {Object} ExistsResult
   * @property {boolean} exists
   * @property {Cas} cas
   */
  /**
   * @typedef {function(Error, ExistsResult)} ExistsCallback
   */
  /**
   *
   * @param {string} key
   * @param {*} [options]
   * @param {integer} [options.timeout]
   * @param {ExistsCallback} [callback]
   * @returns {Promise<ExistsResult>}
   */
  async exists(key, options, callback) {
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

    return PromiseHelper.wrap((promCb) => {
      this._conn.exists(
        this._scope._name, this._name,
        key, options.timeout * 1000,
        (err, cas, exists) => {
          err = errors.wrapLcbErr(err);
          if (err) {
            return promCb(err);
          }

          promCb(err, {
            cas: cas,
            exists: exists
          });
        });
    }, callback);
  }

  async _getReplica(mode, key, options, callback) {
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
    this._checkTranscoderOption(options);
    this._checkCallbackParam(callback);

    var emitter = new events.EventEmitter();

    const transcoder = this._selectTranscoder(options.transcoder);

    this._conn.getReplica(
      this._scope._name, this._name,
      key, transcoder, mode,
      options.timeout * 1000,
      (err, rflags, cas, value) => {
        err = errors.wrapLcbErr(err);
        if (!err) {
          emitter.emit('replica', {
            cas: cas,
            value: value,
            isReplica: true,
          });
        }

        if (rflags & binding.LCB_RESP_F_FINAL) {
          emitter.emit('end');
        }
      });

    return PromiseHelper.wrapStreamEmitter(emitter, 'replica', callback);
  }

  /**
   * Contains the results from a previously executed replica get operation.
   *
   * @typedef {Object} GetReplicaResult
   * @property {*} value
   * @property {Cas} cas
   * @property {boolean} isReplica
   */

  /**
   * @typedef {function(Error, GetReplicaResult)} GetAnyReplicaCallback
   */
  /**
   *
   * @param {string} key
   * @param {*} [options]
   * @param {Transcoder} [options.transcoder]
   * @param {integer} [options.timeout]
   * @param {GetAnyReplicaCallback} [callback]
   * @returns {Promise<GetReplicaResult>}
   */
  async getAnyReplica(key, options, callback) {
    return PromiseHelper.wrapAsync(async () => {
      var replicas = await this._getReplica(
        binding.LCB_REPLICA_MODE_ANY,
        key, options);
      return replicas[0];
    }, callback);
  }

  /**
   * @typedef {function(Error, GetReplicaResult[])} GetAllReplicasCallback
   */
  /**
   *
   * @param {string} key
   * @param {*} [options]
   * @param {Transcoder} [options.transcoder]
   * @param {integer} [options.timeout]
   * @param {GetAllReplicasCallback} [callback]
   * @returns {Promise<GetReplicaResult[]>}
   */
  async getAllReplicas(key, options, callback) {
    return this._getReplica(binding.LCB_REPLICA_MODE_ALL,
      key, options);
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
    this._checkTranscoderOption(options);
    this._checkCallbackParam(callback);

    const transcoder = this._selectTranscoder(options.transcoder);
    const lcbDuraMode = _durabilityModeToLcbConst(options.durabilityLevel);
    const persistTo = options.durabilityPersistTo;
    const replicateTo = options.durabilityReplicateTo;

    return PromiseHelper.wrap((promCb) => {
      this._conn.store(this._scope._name, this._name,
        key, transcoder, value,
        options.expiry, options.cas,
        lcbDuraMode, persistTo, replicateTo,
        options.timeout * 1000, opType,
        (err, cas, token) => {
          err = errors.wrapLcbErr(err);
          if (err) {
            return promCb(err);
          }

          promCb(err, {
            cas: cas,
            token: token
          });
        });
    }, callback);
  }

  /**
   * Contains the results from a previously executed mutation operation.
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
   * @param {Transcoder} [options.transcoder]
   * @param {integer} [options.timeout]
   * @param {MutationCallback} callback
   *
   * @throws {CouchbaseError}
   * @returns {Promise<MutationResult>}
   */
  async insert(key, value, options, callback) {
    return this._store(binding.LCB_STORE_INSERT,
      key, value, options, callback);
  }
  /**
   *
   * @param {string} key
   * @param {*} value
   * @param {*} [options]
   * @param {Transcoder} [options.transcoder]
   * @param {integer} [options.timeout]
   * @param {MutationCallback} callback
   *
   * @throws {CouchbaseError}
   * @returns {Promise<MutationResult>}
   */
  async upsert(key, value, options, callback) {
    return this._store(binding.LCB_STORE_UPSERT,
      key, value, options, callback);
  }
  /**
   *
   * @param {string} key
   * @param {*} value
   * @param {*} options
   * @param {Transcoder} [options.transcoder]
   * @param {integer} [options.timeout]
   * @param {Cas} [options.cas]
   * @param {MutationCallback} callback
   *
   * @throws {CouchbaseError}
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

    const lcbDuraMode = _durabilityModeToLcbConst(options.durabilityLevel);
    const persistTo = options.durabilityPersistTo;
    const replicateTo = options.durabilityReplicateTo;

    return PromiseHelper.wrap((promCb) => {
      this._conn.remove(this._scope._name, this._name,
        key, options.cas,
        lcbDuraMode, persistTo, replicateTo,
        options.timeout * 1000, (err, cas) => {
          err = errors.wrapLcbErr(err);
          if (err) {
            return promCb(err);
          }

          promCb(err, {
            cas: cas
          });
        });
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
   * @param {Transcoder} [options.transcoder]
   * @param {integer} [options.timeout]
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

    this._checkKeyParam(key);
    this._checkExpiryParam(expiry);
    this._checkOptionsParam(options);
    this._checkTimeoutOption(options);
    this._checkTranscoderOption(options);
    this._checkCallbackParam(callback);

    const transcoder = this._selectTranscoder(options.transcoder);

    return PromiseHelper.wrap((promCb) => {
      this._conn.get(this._scope._name, this._name,
        key, transcoder,
        expiry, 0, options.timeout * 1000,
        (err, cas, value) => {
          err = errors.wrapLcbErr(err);
          if (err) {
            return promCb(err);
          }

          promCb(err, {
            cas: cas,
            value: value
          });
        });
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

    this._checkKeyParam(key);
    this._checkExpiryParam(expiry);
    this._checkOptionsParam(options);
    this._checkTimeoutOption(options);
    this._checkCallbackParam(callback);

    const lcbDuraMode = _durabilityModeToLcbConst(options.durabilityLevel);
    const persistTo = options.durabilityPersistTo;
    const replicateTo = options.durabilityReplicateTo;

    return PromiseHelper.wrap((promCb) => {
      this._conn.touch(this._scope._name, this._name,
        key, expiry,
        lcbDuraMode, persistTo, replicateTo,
        options.timeout * 1000,
        (err, cas) => {
          err = errors.wrapLcbErr(err);
          if (err) {
            return promCb(err);
          }

          promCb(err, {
            cas: cas
          });
        });
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
   * @param {Transcoder} [options.transcoder]
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
    this._checkTranscoderOption(options);
    this._checkCallbackParam(callback);

    const transcoder = this._selectTranscoder(options.transcoder);

    return PromiseHelper.wrap((promCb) => {
      this._conn.get(this._scope._name, this._name,
        key, transcoder,
        0, lockTime, options.timeout * 1000,
        (err, cas, value) => {
          err = errors.wrapLcbErr(err);
          if (err) {
            return promCb(err);
          }

          promCb(err, {
            cas: cas,
            value: value
          });
        });
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

    return PromiseHelper.wrap((promCb) => {
      this._conn.unlock(
        this._scope._name, this._name,
        key, cas, options.timeout * 1000,
        (err, cas) => {
          err = errors.wrapLcbErr(err);
          if (err) {
            return promCb(err);
          }

          promCb(err, {
            cas: cas
          });
        });
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

    const lcbDuraMode = _durabilityModeToLcbConst(options.durabilityLevel);
    const persistTo = options.durabilityPersistTo;
    const replicateTo = options.durabilityReplicateTo;

    return PromiseHelper.wrap((promCb) => {
      this._conn.counter(this._scope._name, this._name,
        key, delta, options.initial, options.expiry,
        lcbDuraMode, persistTo, replicateTo,
        options.timeout * 1000, (err, cas, token, value) => {
          err = errors.wrapLcbErr(err);
          if (err) {
            return promCb(err);
          }

          promCb(err, {
            cas: cas,
            token: token,
            value: value
          });
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

    return PromiseHelper.wrap((promCb) => {
      this._conn.lookupIn(
        this._scope._name, this._name,
        key, flags, ...cmdData, options.timeout * 1000,
        (err, res) => {
          err = errors.wrapLcbErr(err);
          if (res && res.results) {
            for (var i = 0; i < res.results.length; ++i) {
              var itemRes = res.results[i];
              itemRes.error = errors.wrapLcbErr(itemRes.error);
              if (itemRes.value && itemRes.value.length > 0) {
                itemRes.value = JSON.parse(itemRes.value);
              } else {
                itemRes.value = null;
              }

              // TODO(brett19): BUG JSCBC-632 - This conversion logic should not be required,
              // it is expected that when JSCBC-632 is fixed, this code is removed as well.
              if (spec[i]._op === binding.LCBX_SDCMD_EXISTS) {
                if (!itemRes.error) {
                  itemRes.value = true;
                } else if (itemRes.error instanceof errors.PathNotFoundError) {
                  itemRes.error = null;
                  itemRes.value = false;
                }
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
    if (options.upsertDocument) {
      flags |= binding.LCBX_SDFLAG_UPSERT_DOC;
    }

    var cmdData = [];
    for (var i = 0; i < spec.length; ++i) {
      cmdData.push(spec[i]._op);
      cmdData.push(spec[i]._flags);
      cmdData.push(spec[i]._path);
      cmdData.push(spec[i]._data);
    }

    const lcbDuraMode = _durabilityModeToLcbConst(options.durabilityLevel);
    const persistTo = options.durabilityPersistTo;
    const replicateTo = options.durabilityReplicateTo;

    return PromiseHelper.wrap((promCb) => {
      this._conn.mutateIn(
        this._scope._name, this._name,
        key, options.expiry, options.cas,
        flags, ...cmdData,
        lcbDuraMode, persistTo, replicateTo,
        options.timeout * 1000,
        (err, res) => {
          err = errors.wrapLcbErr(err);
          promCb(err, res);
        });
    }, callback);
  }

  /**
   *
   * @param {string} key
   *
   * @throws Never
   * @returns {CouchbaseList}
   */
  list(key) {
    return new datastructures.List(this, key);
  }

  /**
   *
   * @param {string} key
   *
   * @throws Never
   * @returns {CouchbaseQueue}
   */
  queue(key) {
    return new datastructures.Queue(this, key);
  }

  /**
   *
   * @param {string} key
   *
   * @throws Never
   * @returns {CouchbaseMap}
   */
  map(key) {
    return new datastructures.Map(this, key);
  }

  /**
   *
   * @param {string} key
   *
   * @throws Never
   * @returns {CouchbaseSet}
   */
  set(key) {
    return new datastructures.Set(this, key);
  }

  /**
   *
   * @throws Never
   * @returns {BinaryCollection}
   */
  binary() {
    return new BinaryCollection(this);
  }

}

Collection.DEFAULT_NAME = '_default';

module.exports = Collection;
