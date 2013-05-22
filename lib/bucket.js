var qs = require("querystring");

exports.create = function(connection, config, ready) {
    // We aren't using prototype inheritance here for two reasons:
    //
    // 1) even though they may be faster, this constructor won't be
    //    called frequently
    //
    // 2) doing it this way means we get better inspectability in
    //    the repl, etc.

    var doJsonConversions = config.doJsonConversions != false;
    var getHandler = doJsonConversions ? getParsedHandler : getRawHandler;

    var OPERATION_ADD = 1;
    var OPERATION_REPLACE = 2;
    var OPERATION_SET = 3;
    var OPERATION_APPEND = 4;
    var OPERATION_PREPEND = 5;


    /**
     * Register a new event emitter
     *
     * @param event The name of the event to register the listener
     * @param callback The callback for the event. The callback function
     *                 takes a different set of arguments depending on
     *                 the callback.
     * @todo document the legal set of callback
     * @todo throw exeption for unknown callbacks
     */
    function on(event, callback) {
        if (config.debug) console.log("couchbase.bucket.on()");
        connection.on(event, callback);
    }

    /**
     * Change the expiration time for a document
     *
     * @param key The key identifying the document to touch
     * @param expiry The new expiration time for the document
     * @param callback The function to call when the operation completes.
     *                 The signature for the callback is
     *                 <code>callback(error, meta);</code>.
     *
     */
    function touch(key, expiry, callback) {
        requiredArgs(key, expiry, callback);
        validateKeys(key, false);
        if (typeof expiry != "number") {
            throw new Error("Expiry must be specified as a number");
        }

        if (config.debug) console.log("couchbase.bucket.touch("+key+","+expiry+")");
        connection.touch(key, expiry, touchHandler, [callback,this]);
    }

    function shutdown() {
        if (config.debug) console.log("couchbase.bucket.shutdown()");
        connection.shutdown();
    }

    function _multiGet(keys, callback, spooledCallback) {
        // Spools multiple gets on the client and hit the callback only once
        var errors = [];
        var values = [];
        var metas = [];
        var callsRemaining;

        if (keys.length > 0 ) {
            function handleValue(err, value, meta) {
                if (callback) {
                    callback(err, value, meta);
                }
                if (spooledCallback) {
                    if (err) {
                        err.id = meta.id;
                        errors.push(err);
                    }
                    values.push(value);
                    metas.push(meta);

                    callsRemaining--;
                    if (callsRemaining == 0) {
                        spooledCallback(errors.length ? errors : null, values, metas);
                    }
                }
            }

            callsRemaining = keys.length;
            connection.get(keys, getHandler, [handleValue,this]);
        } else {
            if (spooledCallback) {
                spooledCallback(null, [], []);
            }
        }
    }

    function _singleGet(key, callback, spooledCallback) {
        // We provide a handler function here to allow for the spooledCallback
        //   to still be called, even for a single get to maintain consistency
        function handleValue(err, value, meta) {
            if (callback) {
                callback(err, value, meta);
            }
            if (spooledCallback) {
                spooledCallback(err, value, meta);
            }
        }

        connection.get(key, getHandler, [handleValue,this]);
    }

    function get(key, callback, spooledCallback) {
        requiredArgs(key, callback);
        validateKeys(key, true);
        if (config.debug) console.log("couchbase.bucket.get("+key+")");
        if (Array.isArray(key)) {
            _multiGet.call(this, key, callback, spooledCallback);
        } else {
            _singleGet.call(this, key, callback, spooledCallback);
        }
    }

    function _multiGetAndLock(keys, exptime, callback, spooledCallback) {
        // Spools multiple gets on the client and hit the callback only once
        var errors = [];
        var values = [];
        var metas = [];
        var callsRemaining;

        function handleValue(err, value, meta) {
            if (callback) {
                callback(err, value, meta);
            }

            // No spooled callback. Return early.
            if (!spooledCallback) {
                return;
            }

            if (err) {
                err.id = meta.id;
                errors.push(err);
            }

            values.push(value);
            metas.push(meta);

            callsRemaining -= 1;

            if (callsRemaining === 0) {
                var e = errors.length !== 0 ? errors : undefined;
                spooledCallback(e, values, metas);
            }
        }

        if (keys.length > 0) {
            callsRemaining = keys.length;
            return connection.getAndLock(keys, exptime, getHandler, [handleValue,this]);
        }

        if (spooledCallback) {
            return spooledCallback(null, [], []);
        }
    }

    function _singleGetAndLock(key, exptime, callback, spooledCallback) {
        // We provide a handler function here to allow for the spooledCallback
        //   to still be called, even for a single get to maintain consistency
        function handleValue(err, value, meta) {
            if (callback) {
                callback(err, value, meta);
            }

            if (spooledCallback) {
                spooledCallback(err, value, meta);
            }
        }

        connection.getAndLock(key, exptime, getHandler, [handleValue,this]);
    }

    function getAndLock(key, exptime, callback, spooledCallback) {
        requiredArgs(key, callback);
        validateKeys(key, true);
        if (exptime) {
            if (typeof exptime != "number") {
                throw new Error("Expiry should be specified as a number");
            }
        } else {
            exptime = 0;
        }
        if (config.debug) {
            console.log("couchbase.bucket.getAndLock("+key+")");
        }

        if (Array.isArray(key)) {
            _multiGetAndLock.call(this, key, exptime, callback, spooledCallback);
        } else {
            _singleGetAndLock.call(this, key, exptime, callback, spooledCallback);
        }
    }

    function _multiUnlock(keys, callback, spooledCallback) {
        // Spools multiple gets on the client and hit the callback only once
        var errors = [];
        var values = [];
        var metas = [];
        var callsRemaining;

        function handleValue(err, value, meta) {
            if (callback) {
                callback(err, value, meta);
            }

            // No spooled callback. Return early.
            if (!spooledCallback) {
                return;
            }

            if (err) {
                err.id = meta.id;
                errors.push(err);
            }

            values.push(value);
            metas.push(meta);

            callsRemaining -= 1;

            if (callsRemaining === 0) {
                spooledCallback(errors.length !== 0 ? errors : null, values, metas);
            }
        }

        if (keys.length > 0 ) {
            callsRemaining = keys.length;
            return connection.unlock(keys, unlockHandler, [handleValue,this]);
        }

        if (spooledCallback) {
            return spooledCallback(null, [], []);
        }
    }

    function _singleUnlock(key, callback, spooledCallback) {
        // We provide a handler function here to allow for the spooledCallback
        //   to still be called, even for a single get to maintain consistency
        function handleValue(err, value, meta) {
            if (callback) {
                callback(err, value, meta);
            }

            if (spooledCallback) {
                spooledCallback(err, value, meta);
            }
        }

        connection.unlock(key, unlockHandler, [handleValue,this]);
    }

    function unlock(key, callback, spooledCallback) {
        requiredArgs(key, callback);
        validateKeys(key, true);
        if (config.debug) {
            console.log("couchbase.bucket.unlock("+key+")");
        }

        if (Array.isArray(key)) {
            _multiUnlock.call(this, key, callback, spooledCallback);
        } else {
            _singleUnlock.call(this, key, callback, spooledCallback);
        }
    }

    function set(key, doc, meta, callback) {
        if (typeof meta == "function") {
            callback = meta;
            meta = {};
        }
        requiredArgs(key, doc, callback);
        validateKeys(key, false);
        if (config.debug) console.log("couchbase.bucket.set("+key+")");

        if (doJsonConversions) {
            doc = makeDoc(doc);
        }

        if (typeof doc != "string") {
            throw new Error("Document must be provided as a string");
        }

        if (meta.expiry && typeof meta.expiry != "number") {
            throw new Error("Expiration must be specified as a number");
        }

        if (meta.flags && typeof meta.flags != "number") {
            throw new Error("Flags must be specified as a number");
        }

        if (meta.cas && typeof meta.cas != "object") {
            throw new Error("Invalid cas specified");
        }

        connection.store(OPERATION_SET,
            key,
            doc,
            meta.expiry || 0,
            meta.flags || 0,
            meta.cas,
            setHandler,
            [callback,this]);
    }

    function incr(key, meta, callback) {
        if (typeof meta == "function") {
            callback = meta;
            meta = {};
        }
        validateKeys(key, false);
        if (config.debug) console.log("couchbase.bucket.incr("+key+")");

        if (meta.offset && typeof meta.offset != "number") {
            throw new Error("Offset must be specified as an number " + typeof meta.offset);
        }
        if (meta.defaultValue && typeof meta.defaultValue != "number") {
            throw new Error("default value must be specified as an number");
        }
        if (meta.expiry && typeof meta.expiry != "number") {
            throw new Error("Expiry must be specified as an number");
        }

        connection.arithmetic(key,
                    meta.offset || 1,
                    meta.defaultValue || 0,
                    meta.expiry || 0,
                    arithmeticHandler,
                    [callback,this]);
    }

    function decr(key, meta, callback) {
        if (typeof meta == "function") {
            callback = meta;
            meta = {};
        }
        validateKeys(key, false);
        if (config.debug) console.log("couchbase.bucket.decr("+key+")");
        if (meta.offset && typeof meta.offset != "number") {
            throw new Error("Offset must be specified as an number " + typeof meta.offset );
        }
        if (meta.defaultValue && typeof meta.defaultValue != "number") {
            throw new Error("default value must be specified as an number");
        }
        if (meta.expiry && typeof meta.expiry != "number") {
            throw new Error("Expiry must be specified as an number");
        }

        connection.arithmetic(key,
                    (meta.offset || 1) *-1,
                    meta.defaultValue || 0,
                    meta.expiry || 0,
                    arithmeticHandler,
                    [callback,this]);
    }

    function observe(key, meta, callback) {
        if (typeof meta == "function") {
            callback = meta;
            meta = {};
        }
        validateKeys(key, false);
        if (config.debug) console.log("couchbase.bucket.observe("+key+")");

        connection.observe(key, observeHandler, [callback,this]);
    }

    function endure(key, meta, callback) {
        if (typeof meta == "function") {
            callback = meta;
            meta = {};
        }
        validateKeys(key, false);
        if (config.debug) console.log("couchbase.bucket.endure("+key+")");

        // Apply defaults if needed
        var defaults = {
            timeout: 60000,
            persisted: 1,
            replicated: 0
        };

        if (meta == undefined) {
            meta = defaults;
        }
        ["timeout", "persisted", "replicated"].forEach(function(key) {
            if (meta[key] == undefined) {
                meta[key] = defaults[key];
            }
        });

        // Set up a timer to ensure we timeout if we
        //   don't ever reach proper replication/persistence
        var timedOut = false;
        var persisted = 0;
        var replicated = 0;
        var timer = setTimeout(function(){
            timedOut = true;
            var errObj = new Error('Timeout');
            errObj.code = 9998;
            callback(errObj);
        }, meta.timeout);

        var _this = this;
        function handleReplica(err, data) {
            if (timedOut) return;
            if (data) {
                // Ensure that the cas matches
                if (!meta.cas || !data.cas || meta.cas.str == data.cas.str) {
                    // If the status is persisted or replicated and this
                    //   is not the master, count as 1 replication
                    if ((data.status == 0 || data.status == 1) && !data.from_master) {
                        replicated++;
                    }
                    // If the status for this server is persisted, count as 1 persistence
                    if (data.status == 1) {
                        persisted++;
                    }
                }
            } else {
                if (replicated >= meta.replicated && persisted >= meta.persisted) {
                    clearTimeout(timer);
                    callback(null, {
                        replicated: replicated,
                        persisted: persisted
                    });
                } else {
                    // Don't have request replication/persistence yet
                    //   (retry in 100ms, though this should probably be a variable delay)
                    setTimeout(function(){
                        // Don't bother polling if we already timed out
                        if (timedOut) return;

                        // Restart Observe
                        persisted = 0;
                        replicated = 0;
                        _this.observe(key, {}, handleReplica);
                    }, 100);
                }
            }
        }

        // Begin observe
        this.observe(key, {}, handleReplica);
    }

    function remove(key, meta, callback) {
        if (typeof meta == "function") {
            callback = meta;
            meta = {};
        }
        requiredArgs(key, callback);
        validateKeys(key, false);
        if (config.debug) console.log("couchbase.bucket.remove("+key+")");
        if (meta.cas && typeof meta.cas != "object") {
            throw new Error("Invalid cas specified");
        }

        connection.remove(key, meta.cas, removeHandler, [callback,this]);
    }

    function replace(key, doc, meta, callback) {
        if (typeof meta == "function") {
            callback = meta;
            meta = {};
        }
        requiredArgs(key, doc, callback);
        validateKeys(key, false);
        if (config.debug) console.log("couchbase.bucket.replace("+key+")");
        if (doJsonConversions) doc = makeDoc(doc);
        connection.store(OPERATION_REPLACE,
            key,
            doc,
            meta.expiry || 0,
            meta.flags || 0,
            meta.cas,
            setHandler,
            [callback,this]);
    }

    function add(key, doc, meta, callback) {
        if (typeof meta == "function") {
            callback = meta;
            meta = {};
        }
        requiredArgs(key, doc, callback);
        validateKeys(key, false);
        if (config.debug) console.log("couchbase.bucket.add("+key+")");
        if (doJsonConversions) doc = makeDoc(doc);
        connection.store(OPERATION_ADD,
            key,
            doc,
            meta.expiry || 0,
            meta.flags || 0,
            meta.cas,
            setHandler,
            [callback,this]);
    }

    function append(key, doc, meta, callback) {
        if (typeof meta == "function") {
            callback = meta;
            meta = {};
        }
        meta = meta || {};
        requiredArgs(key, doc, callback);
        validateKeys(key, false);
        if (config.debug) console.log("couchbase.bucket.append("+key+')');
        if (doJsonConversions) doc = makeDoc(doc);
        connection.store(OPERATION_APPEND,
            key,
            doc,
            meta.expiry || 0,
            meta.flags || 0,
            meta.cas || null ,
            appendHandler,
            [callback, this]);
    }

    function prepend(key, doc, meta, callback) {
        if (typeof meta == "function") {
          callback = meta;
          meta = {};
        }
        meta = meta || {};
        requiredArgs(key, doc, callback);
        validateKeys(key, false);
        if (config.debug) console.log("couchbase.bucket.prepend("+key+')');
        if (doJsonConversions) doc = makeDoc(doc);
        connection.store(OPERATION_PREPEND,
            key,
            doc,
            meta.expiry || 0,
            meta.flags || 0,
            meta.cas || null ,
            prependHandler,
            [callback, this]);
    }

    function getVersion() {
        if (config.debug) console.log("couchbase.bucket.getVersion()");
        return connection.getVersion();
    }

    function strError(errorCode) {
        if (config.debug) console.log("couchbase.bucket.strError()");
        return connection.strError(errorCode);
    }

    function view(ddoc, name, query, callback) {
        if (config.debug) console.log("couchbase.bucket.view("+ddoc+","+name+")");

        var fields = ["descending", "endkey", "endkey_docid",
            "full_set", "group", "group_level", "inclusive_end",
            "key", "keys", "limit", "on_error", "reduce", "skip",
            "stale", "startkey", "startkey_docid"];
        var jsonFields = ["endkey", "key", "keys", "startkey"];

        for (var q in query) {
            if (fields.indexOf(q) == -1) {
                delete query[q];
            } else if (jsonFields.indexOf(q) != -1) {
                query[q] = JSON.stringify(query[q]);
            }
        }

        if (typeof ddoc != "string") {
            throw new Error("Design document must be specified as a string");
        }

        if (typeof name != "string") {
            throw new Error("View must be specified as a string");
        }


        connection.view(ddoc, name + "?" + qs.stringify(query),
                        couchnodeRestHandler, [callback, this]);
    }

    function setDesignDoc(name, data, callback) {
        if (config.debug) console.log("couchbase.bucket.setDesignDoc("+name+")");
        if (typeof name != "string") {
            throw new Error("Design document must be specified as a string");
        }

        connection.setDesignDoc(name, makeDoc(data),
                                couchnodeRestHandler, [callback, this]);
    }

    function getDesignDoc(name, callback) {
        if (config.debug) console.log("couchbase.bucket.getDesignDoc("+name+")");
        if (typeof name != "string") {
            throw new Error("Design document must be specified as a string");
        }
        connection.getDesignDoc(name, couchnodeRestHandler, [callback, this]);
    }

    function deleteDesignDoc(name, callback) {
        if (config.debug) console.log("couchbase.bucket.deleteDesignDoc("+name+")");
        if (typeof name != "string") {
            throw new Error("Design document must be specified as a string");
        }
        connection.deleteDesignDoc(name, couchnodeRestHandler, [callback, this]);
    }

    ready({
        on : on,
        shutdown : shutdown,
        touch : touch,
        get : get,
        getAndLock : getAndLock,
        unlock : unlock,
        set : set,
        remove: remove,
        replace : replace,
        add : add,
        append : append,
        prepend: prepend,
        view : view,
        incr : incr,
        decr : decr,
        observe: observe,
        endure: endure,
        setDesignDoc: setDesignDoc,
        getDesignDoc: getDesignDoc,
        deleteDesignDoc: deleteDesignDoc,
        getVersion: getVersion,
        strError: strError
    });
};

function validateKeys(key, allowArray) {
   if (Array.isArray(key)) {
      if (!allowArray) {
          throw new Error("Invalid key specified (array instead of string)");
      } else {
          for (var i = 0; i < key.length; ++i) {
              if (typeof key[i] == "object") {
                  if (!key.key) {
                      throw new Error("The specified key[" + i + "] is missing key: " + JSON.stringify(key));
                  }
                  if (typeof key[i].key != "string") {
                      throw new Error("The specified key[" + i + "] is not a string: " + typeof key[i]);

                  }
                  if (key[i].hashkey && typeof key[i].hashkey != "string") {
                      throw new Error("The specified hashkey[" + i + "] is not a string: " + typeof key[i]);
                  }
              } else if (typeof key[i] != "string") {
                  throw new Error("The specified key[" + i + "] is not a string: " + typeof key[i]);
              }
          }
      }
   } else {
       if (typeof key == "object") {
           if (!key.key) {
               throw new Error("The specified key is missing key: " + JSON.stringify(key));
           }
           if (typeof key.key != "string") {
               throw new Error("The specified key is not a string: " + typeof key);

           }
           if (key.hashkey && typeof key.hashkey != "string") {
               throw new Error("The specified hashkey is not a string: " + typeof key);
           }
       } else if (typeof key != "string") {
           throw new Error("The specified key (" + key + ") is not a string: " + typeof key);
       }
   }
}

function requiredArgs() {
    for (var i = 0; i < arguments.length; i++) {
        if (typeof arguments[i] == "undefined") {
            throw new ReferenceError("missing required argument");
        }
    }
}

function makeDoc(doc) {
    if (typeof doc == "string") {
        return doc;
    } else {
        return JSON.stringify(doc);
    }
}

function makeError(conn, errorCode) {
    // Early-out for success
    if (errorCode == 0) {
        return null;
    }

    // Build a standard NodeJS Error object with the passed errorCode
    var errObj = new Error(conn.strError(errorCode));
    errObj.code = errorCode;
    return errObj;
}

// convert the c-based set callback format to something sane
function setHandler(data, errorCode, key, cas) {
    var error = makeError(data[1], errorCode);
    data[0](error, {
        id : key,
        cas : cas
    });
}

function arithmeticHandler(data, errorCode, key, cas, value) {
    var error = makeError(data[1], errorCode);
    data[0](error, value, {
        id: key,
        cas: cas
    });
}

function observeHandler(data, errorCode, key, cas, status, from_master, ttp, ttr) {
    var error = makeError(data[1], errorCode);
    if (key) {
        data[0](error, {
            id: key,
            cas: cas,
            status: status,
            from_master: from_master,
            ttp: ttp,
            ttr: ttr
        });
    } else {
        data[0](error, null);
    }
}

function getParsedHandler(data, errorCode, key, cas, flags, value) {
    // if it looks like it might be JSON, try to parse it
    if (/[\{\[]/.test(value)) {
        try {
            value = JSON.parse(value);
        } catch (e) {
        // console.log("JSON.parse error", e, value)
        }
    }
    var error = makeError(data[1], errorCode);
    data[0](error, value, {
        id : key,
        cas: cas,
        flags : flags
    });
}

function getRawHandler(data, errorCode, key, cas, flags, value) {

    var error = makeError(data[1], errorCode);
    data[0](error, value, {
        id : key,
        cas: cas,
        flags : flags
    });
}

function unlockHandler(data, errorCode, key) {
    var error = makeError(data[1], errorCode);
    data[0](error, {
        id: key
    });
}

function touchHandler(data, errorCode, key) {
    var error = makeError(data[1], errorCode);
    data[0](error, {
        id: key
    });
}

function removeHandler(data, errorCode, key, cas) {
    var error = makeError(data[1], errorCode);
    data[0](error, {
        id : key,
        cas: cas
    });
}

function appendHandler(data, errorCode, key, cas) {
    var error = makeError(data[1], errorCode);
    data[0](error, {id: key, cas: cas});
}

function prependHandler(data, errorCode, key, cas) {
    var error = makeError(data[1], errorCode);
    data[0](error, {id: key, cas: cas});
}

function couchnodeRestHandler(data, errorCode, httpError, body) {
    var error = makeError(data[1], errorCode);
    if (errorCode == 0 && (httpError < 200 || httpError > 299)) {
        // Build a standard NodeJS Error object with the passed errorCode
        error = new Error("HTTP error " + httpError);
        error.code = 0x0a;
    }

    try {
        body = JSON.parse(body)
    } catch (err) { }

    if (error) {
        // Error talking to server, pass the error on for now
        return data[0](error, null);
    } else if (body && body.error) {
        // This should probably be updated to act differently
        var errObj = new Error("REST error " + body.error);
        errObj.code = 9999;
        if (body.reason) {
            errObj.reason = body.reason;
        }
        return data[0](errObj, null);
    } else {
        if (body.rows) {
            return data[0](null, body.rows);
        } else if (body.results) {
            return data[0](null, body.results);
        } else {
            return data[0](null, body);
        }
    }
}
