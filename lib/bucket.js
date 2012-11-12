var request = require("request").defaults({json:true}),
    qs = require('querystring');

exports.create = function(connection, config, ready) {
    // We aren't using prototype inheritance here for two reasons:
    // 1) even though they may be faster, this constructor won't be called frequently
    // 2) doing it this way means we get better inspectability in the repl, etc.

    function on(event, callback) {
        connection.on(event, callback);
    };

    function get(key, callback) {
        requiredArgs(key, callback);
        if (key instanceof Array) {
            for (i = 0; i < key.length; i++) {
                connection.get(key[i], undefined, getHandler, [callback,this]);
            }
        } else {
            connection.get(key, undefined, getHandler, [callback,this]);
        }
    };

    function set(key, doc, meta, callback) {
        if (meta instanceof Function) {
            callback = meta;
            meta = {};
        }
        requiredArgs(key, doc, callback);
        connection.set(key, makeDoc(doc), meta.flags, meta.cas, setHandler, [callback,this]);
    };

    function incr(key, meta, callback) {
        if (meta instanceof Function) {
            callback = meta;
            meta = {};
        }

        connection.arithmetic( key,
                    (meta.offset == undefined) ? 1: meta.offset,
                    (meta.defaultValue == undefined) ? 0: meta.defaultValue,
                    (meta.expiry == undefined) ? 0: meta.expiry,
                    meta.cas,
                    arithmeticHandler,
                    [callback,this]);
    };

    function decr(key, meta, callback) {
        if (meta instanceof Function) {
            callback = meta;
            meta = {};
        }

        connection.arithmetic( key,
                    ((meta.offset == undefined) ? 1: meta.offset) *-1,
                    (meta.defaultValue == undefined ) ? 0: meta.defaultValue,
                    (meta.expiry == undefined) ? 0: meta.expiry,
                    meta.cas,
                    arithmeticHandler,
                    [callback,this]);
    }

    function _delete(key, meta, callback) {
        if (meta instanceof Function) {
            callback = meta;
            meta = {};
        }
        requiredArgs(key, callback);
        connection.delete(key, meta.cas, deleteHandler, [callback,this]);
    }

    function replace(key, doc, meta, callback) {
        if (meta instanceof Function) {
            callback = meta;
            meta = {};
        }
        requiredArgs(key, doc, callback);
        connection.replace(key, makeDoc(doc), meta.flags, meta.cas, setHandler, [callback,this]);
    };

    function add(key, doc, meta, callback) {
        if (meta instanceof Function) {
            callback = meta;
            meta = {};
        }
        requiredArgs(key, doc, callback);
        connection.add(key, makeDoc(doc), meta.flags, meta.cas, setHandler, [callback,this]);
    };

    function getVersion( ) {
        return connection.getVersion( );
    }

    function strError( errorCode ) {
        return connection.strError( errorCode );
    }

    var viewHosts;

    // todo this function should be triggered on topology change
    function updateClusterMap(callback) {
        var uiHost = connection.getRestUri();
        request("http://"+uiHost+"/pools/"+encodeURIComponent(config.bucket),
            function(err, resp, clusterMap) {
                if (err) {throw(err);}
                viewHosts = clusterMap.nodes.map(function(info) {
                    return info.couchApiBase;
                });
                if (callback) {
                    callback();
                }
            });
    };

    function view(ddoc, name, query, callback) {
        var jsonFields = ["key", "startkey", "endkey", "start_key", "end_key"],
            // distribute queries across the cluster randomly
            viewHost = viewHosts[Math.floor(Math.random() * viewHosts.length)];

        for (q in query) {
          if (jsonFields.indexOf(q) != -1) {
            query[q] = JSON.stringify(query[q]);
          }
        }

        var url = viewHost +
            [config.bucket, "_design", ddoc,
                "_view", name].map(encodeURIComponent).join('/') +
                '?' + qs.stringify(query);

        return request(url, callback);
    };

    updateClusterMap(function() {
        ready({
                on : on,
                get : get,
                set : set,
                'delete' : _delete,
                replace : replace,
                add : add,
                view : view,
                incr : incr,
                decr : decr,
                getVersion: getVersion,
                strError: strError
            });
    });
};

function requiredArgs() {
    for (var i = 0; i < arguments.length; i++) {
        if (typeof arguments[i] == 'undefined') {
            throw new ReferenceError("missing required argument")
        }
    };
};

function makeDoc(doc) {
    if (typeof doc == "string") {
        return doc;
    } else {
        return JSON.stringify(doc)
    }
};

function makeError( conn, errorCode ) {
    // Early-out for success
    if( errorCode == 0 ) {
        return null;
    }

    // Build a standard NodeJS Error object with the passed errorCode
    var errObj = new Error( conn.strError(errorCode) );
    errObj.code = errorCode;
    return errObj;
}

// convert the c-based set callback format to something sane
function setHandler(data, errorCode, key, cas) {
    error = makeError( data[1], errorCode );
    data[0](error, {id : key, cas : cas});
}

function arithmeticHandler( data, errorCode, key, cas, value ) {
    error = makeError( data[1], errorCode );
    data[0]( error, key, cas, value );
}

function getHandler(data, errorCode, key, cas, flags, value) {
    // if it looks like it might be JSON, try to parse it
    if (/[\{\[]/.test(value)) {
        try {
            value = JSON.parse(value)
        } catch (e) {
            // console.log("JSON.parse error", e, value)
        }
    }
    error = makeError( data[1], errorCode );
    data[0](error, value, {id : key, cas: cas, flags : flags});
};

function deleteHandler(data, errorCode, key) {
    error = makeError( data[1], errorCode );
    data[0](error, {id : key});
}
