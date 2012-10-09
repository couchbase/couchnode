exports.create = function(connection) {
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

    function remove(key, meta, callback) {
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
        connection.replace(key, doc, meta.flags, meta.cas, setHandler, callback);
    };

    function add(key, doc, meta, callback) {
        if (meta instanceof Function) {
            callback = meta;
            meta = {};
        }
        requiredArgs(key, doc, callback);
        connection.add(key, doc, meta.flags, meta.cas, setHandler, callback);
    };

	return {
        on : on,
        get : get,
        set : set,
        'delete' : remove,
        replace : replace,
        add : add
    };
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
    if (/\{.*\}/.test(value)) {
        try {
            value = JSON.parse(value)
        } catch (e) {
        }
    }
    data(error, value, {id : key, cas: cas, flags : flags});
};

function deleteHandler(data, error, key) {
    data(error, {id : key});
}
