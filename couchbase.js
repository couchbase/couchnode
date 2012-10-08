var couchnode = require('couchbase_impl');

var config = {
    hosts : [ "localhost:8091", "localhost:9000" ],
    bucket : "default",
    password : "asdasd",
    user : "Administrator"
};

var options = {
    expiration : 1000 * 60 * 24
}

var handle = null;

function create(cfg) {
    if (cfg != null) {
        if (cfg.hosts != undefined) {
            config.hosts = cfg.hosts;
        }
        if (cfg.bucket != undefined) {
            config.bucket = cfg.bucket;
        }
        if (cfg.user != undefined) {
            config.user = cfg.user;
        }
        if (cfg.password != undefined) {
            config.password = cfg.password;
        }
    }

    console.log('Using the following config: ', config);
    hosts = config.hosts.toString().replace(/,/g, ";")
    handle = new couchnode.CouchbaseImpl(hosts, config.user, config.password, config.bucket);

    return this;
};

function on(type, handler) {
    if (type == "error") {
        handle.on(type, handler);
    } else if (type = "connect") {
	handle.on(type, handler);
    } else {
        throw 'Unknown event: Use "error"';
    }
}

function connect(params, handler) {
    // the params is an optional parameter.. There might be a better
    // way to do this..
    if (params instanceof Function) {
        console.log("called without config");
        handler = params;
        params = null;
    }

    // Create the instance if the user hasn't called it already
    if (handle == null) {
        create();
    }

    on("connect", handler);
};

function my_get_handler(data, error, key, cas, flags, value) {
    meta = new Object;
    meta.id = key;
    meta.cas = cas;
    meta.flags = flags;
    data(error, value, meta);
};

function get(key, handler) {
    if (key instanceof Array) {
	for (i = 0; i < key.length; i++) {
	    handle.get(key[i], undefined, my_get_handler, handler);
	}
    } else {
	handle.get(key, undefined, my_get_handler, handler);
    }
};

function my_set_handler(data, error, key, cas) {
    meta = new Object;
    meta.id = key;
    meta.cas = cas;
    data(error, meta);
}

function set(key, doc, meta, handler) {
    /* meta is an optional parameter */
    if (meta instanceof Function) {
	handler = meta;
	meta = new Object();
    }

    // @todo where do I specify flags?
    handle.set(key, doc, meta.flags, meta.cas, my_set_handler, handler);
}

function add(key, doc, meta, handler) {
    /* meta is an optional parameter */
    if (meta instanceof Function) {
	handler = meta;
	meta = new Object();
    }

    // @todo where do I specify flags?
    handle.add(key, doc, meta.flags, meta.cas, my_set_handler, handler);
}

function replace(key, doc, meta, handler) {
    /* meta is an optional parameter */
    if (meta instanceof Function) {
	handler = meta;
	meta = new Object();
    }

    // @todo where do I specify flags?
    handle.replace(key, doc, meta.flags, meta.cas, my_set_handler, handler);
}

function my_delete_handler(data, error, key) {
    data(error, key);
}

function remove(key, meta, handler) {
    /* meta is an optional parameter */
    if (meta instanceof Function) {
	handler = meta;
	meta = new Object();
    }
    handle.delete(key, meta.cas, my_delete_handler, handler);
}

// Export everything!
exports.on = on;
exports.config = config;
exports.options = options;
exports.connect = connect;
exports.create = create;
exports.get = get;
exports.add = add;
exports.replace = replace;
exports.set = set;
exports.delete = remove;
