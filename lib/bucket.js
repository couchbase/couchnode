var request = require("request").defaults({
    json:true
});
var qs = require("querystring");

exports.create = function(connection, config, ready) {
    // We aren't using prototype inheritance here for two reasons:
    // 1) even though they may be faster, this constructor won't be called frequently
    // 2) doing it this way means we get better inspectability in the repl, etc.

    var doJsonConversions = config.doJsonConversions != false;
    var getHandler = doJsonConversions ? getParsedHandler : getRawHandler;

    function on(event, callback) {
        if (config.debug) console.log("couchbase.bucket.on()");
        connection.on(event, callback);
    }

    function touch(key, expiry, callback) {
        requiredArgs(key, expiry, callback);
        if (config.debug) console.log("couchbase.bucket.touch("+key+","+expiry+")");
        connection.touch(key, expiry, touchHandler, [callback,this]);
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
            connection.get(keys, undefined, getHandler, [handleValue,this]);
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

        connection.get(key, undefined, getHandler, [handleValue,this]);
    }

    function get(key, callback, spooledCallback) {
        requiredArgs(key, callback);
        if (config.debug) console.log("couchbase.bucket.get("+key+")");
        if (Array.isArray(key)) {
            _multiGet.call(this, key, callback, spooledCallback);
        } else {
            _singleGet.call(this, key, callback, spooledCallback);
        }
    }

    function set(key, doc, meta, callback) {
        if (typeof meta == "function") {
            callback = meta;
            meta = {};
        }
        requiredArgs(key, doc, callback);
        if (config.debug) console.log("couchbase.bucket.set("+key+")");
        if (doJsonConversions) doc = makeDoc(doc);
        connection.set(key,
            doc,
            meta.expiry || 0,
            meta.cas,
            setHandler,
            [callback,this]);
    }

    function incr(key, meta, callback) {
        if (typeof meta == "function") {
            callback = meta;
            meta = {};
        }
        if (config.debug) console.log("couchbase.bucket.incr("+key+")");

        connection.arithmetic(key,
                    meta.offset || 1,
                    meta.defaultValue || 0,
                    meta.expiry || 0,
                    meta.cas,
                    arithmeticHandler,
                    [callback,this]);
    }

    function decr(key, meta, callback) {
        if (typeof meta == "function") {
            callback = meta;
            meta = {};
        }
        if (config.debug) console.log("couchbase.bucket.decr("+key+")");

        connection.arithmetic(key,
                    (meta.offset || 1) *-1,
                    meta.defaultValue || 0,
                    meta.expiry || 0,
                    meta.cas,
                    arithmeticHandler,
                    [callback,this]);
    }

    function observe(key, meta, callback) {
        if (typeof meta == "function") {
            callback = meta;
            meta = {};
        }
        if (config.debug) console.log("couchbase.bucket.observe("+key+")");

        connection.observe(key,
                    undefined,
                    observeHandler,
                    [callback,this]);
    }

    function endure(key, meta, callback) {
        if (typeof meta == "function") {
            callback = meta;
            meta = {};
        }
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
        }, meta.timeout)

        function handleReplica(err, data) {
            if (timedOut) return;
            if (data) {
                // Ensure that the cas matches
                if (!meta.cas || meta.cas.str == data.cas.str) {
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
                        observe(key, {}, handleReplica);
                    }, 100);
                }
            }
        }

        // Begin observe
        observe(key, {}, handleReplica);
    }

    function remove(key, meta, callback) {
        if (typeof meta == "function") {
            callback = meta;
            meta = {};
        }
        requiredArgs(key, callback);
        if (config.debug) console.log("couchbase.bucket.remove("+key+")");
        connection.remove(key, meta.cas, removeHandler, [callback,this]);
    }

    function replace(key, doc, meta, callback) {
        if (typeof meta == "function") {
            callback = meta;
            meta = {};
        }
        requiredArgs(key, doc, callback);
        if (config.debug) console.log("couchbase.bucket.replace("+key+")");
        if (doJsonConversions) doc = makeDoc(doc);
        connection.replace(key,
            doc,
            meta.expiry || 0,
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
        if (config.debug) console.log("couchbase.bucket.add("+key+")");
        if (doJsonConversions) doc = makeDoc(doc);
        connection.add(key,
            doc,
            meta.expiry || 0,
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
        if (config.debug) console.log("couchbase.bucket.append("+key+')');
        if (doJsonConversions) doc = makeDoc(doc);
        connection.append(key,
            doc,
            meta.expiry || 0,
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
        if (config.debug) console.log("couchbase.bucket.prepend("+key+')');
        if (doJsonConversions) doc = makeDoc(doc);
        connection.prepend(key,
            doc,
            meta.expiry || 0,
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

    var viewHosts;

    // todo this function should be triggered on topology change
    function updateClusterMap(callback) {
        var uiHost = connection.getRestUri();
        request("http://"+uiHost+"/pools/"+encodeURIComponent(config.bucket),
            function(err, resp, clusterMap) {
                if (err) {
                    throw(err);
                }
                viewHosts = clusterMap.nodes.map(function(info) {
                    return info.couchApiBase;
                });
                if (callback) {
                    callback();
                }
            });
    }

    function restHost()
    {
        // distribute queries across the cluster randomly
        return viewHosts[Math.floor(Math.random() * viewHosts.length)];
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

        var url = restHost() +
            [config.bucket, "_design", ddoc,
                "_view", name].map(encodeURIComponent).join('/') +
                '?' + qs.stringify(query);

        return request(url, function(err,resp,body) {
            restHandler(callback,err,resp,body);
        });
    }

    function createDesignDoc(name, data, callback) {
        if (config.debug) console.log("couchbase.bucket.createDesignDoc("+name+")");
        var options = {};
        options.url = restHost() +
            [config.bucket, "_design", name].map(encodeURIComponent).join('/');
        options.body = data;

        request.put(options, function(err,resp,body) {
            restHandler(callback,err,resp,body);
        });
    }

    function getDesignDoc(name, callback) {
        if (config.debug) console.log("couchbase.bucket.getDesignDoc("+name+")");
        var options = {};
        options.url = restHost() +
            [config.bucket, "_design", name].map(encodeURIComponent).join('/');

        request.get(options, function(err,resp,body) {
            restHandler(callback,err,resp,body);
        });
    }

    function deleteDesignDoc(name, callback) {
        if (config.debug) console.log("couchbase.bucket.deleteDesignDoc("+name+")");
        var options = {};
        options.url = restHost() +
            [config.bucket, "_design", name].map(encodeURIComponent).join('/');

        request.del(options, function(err,resp,body) {
            restHandler(callback,err,resp,body);
        });
    }

    updateClusterMap(function() {
        ready({
                on : on,
                touch : touch,
                get : get,
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
                createDesignDoc: createDesignDoc,
                getDesignDoc: getDesignDoc,
                deleteDesignDoc: deleteDesignDoc,
                getVersion: getVersion,
                strError: strError
            });
    });
};

function requiredArgs() {
    for (var i = 0; i < arguments.length; i++) {
        if (typeof arguments[i] == "undefined") {
            throw new ReferenceError("missing required argument")
        }
    }
}

function makeDoc(doc) {
    if (typeof doc == "string") {
        return doc;
    } else {
        return JSON.stringify(doc)
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

function restHandler(callback, error, resp, body) {
    // Ensure the body was parsed as JSON
    try {
        body = JSON.parse(body)
    } catch (err) { }

    if (error) {
        // Error talking to server, pass the error on for now
        return callback(error, null);
    } else if (body && body.error) {
        // This should probably be updated to act differently
        var errObj = new Error(body.error);
        errObj.code = 9999;
        if (body.reason) {
            errObj.reason = body.reason;
        }
        return callback(errObj, null);
    } else {
        if (body.rows) {
            return callback(null, body.rows);
        } else if (body.results) {
            return callback(null, body.results);
        } else {
            return callback(null, body);
        }
    }
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
            value = JSON.parse(value)
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
    data[0](error, {id: key, cas: cas})
}

function prependHandler(data, errorCode, key, cas) {
    var error = makeError(data[1], errorCode);
    data[0](error, {id: key, cas: cas})
}