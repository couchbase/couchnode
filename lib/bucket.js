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
                connection.get(key[i], undefined, getHandler, callback);
            }
        } else {
            connection.get(key, undefined, getHandler, callback);
        }
    };

    function set(key, doc, meta, callback) {
        if (meta instanceof Function) {
            callback = meta;
            meta = {};
        }
        requiredArgs(key, doc, callback);
        connection.set(key, makeDoc(doc), meta.flags, meta.cas, setHandler, callback);
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
                    callback);
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
                    callback);
    }

    function _delete(key, meta, callback) {
        if (meta instanceof Function) {
            callback = meta;
            meta = {};
        }
        requiredArgs(key, callback);
        connection.delete(key, meta.cas, deleteHandler, callback);
    }

    function replace(key, doc, meta, callback) {
        if (meta instanceof Function) {
            callback = meta;
            meta = {};
        }
        requiredArgs(key, doc, callback);
        connection.replace(key, makeDoc(doc), meta.flags, meta.cas, setHandler, callback);
    };

    function add(key, doc, meta, callback) {
        if (meta instanceof Function) {
            callback = meta;
            meta = {};
        }
        requiredArgs(key, doc, callback);
        connection.add(key, makeDoc(doc), meta.flags, meta.cas, setHandler, callback);
    };

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
                decr : decr
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

// convert the c-based set callback format to something sane
function setHandler(data, error, key, cas) {
    data(error, {id : key, cas : cas});
}

function getHandler(data, error, key, cas, flags, value) {
    // if it looks like it might be JSON, try to parse it
    if (/[\{\[]/.test(value)) {
        try {
            value = JSON.parse(value)
        } catch (e) {
            // console.log("JSON.parse error", e, value)
        }
    }
    data(error, value, {id : key, cas: cas, flags : flags});
};

function deleteHandler(data, error, key) {
    data(error, {id : key});
}
