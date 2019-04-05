const events = require('events');
const binding = require('./binding');
const qs = require('qs');

/**
 * @private
 */
class ViewExecutor {
    constructor(conn) {
        this._conn = conn;
    }

    /**
     * 
     * @param {string} designDoc 
     * @param {string} viewName 
     * @param {*} options 
     * @param {boolean} options.include_docs
     * @param {ViewUpdateMode} [options.stale]
     * @param {integer} [options.skip]
     * @param {integer} [options.limit]
     * @param {ViewOrderMode} [options.order]
     * @param {string} [options.reduce]
     * @param {boolean} [options.group]
     * @param {integer} [options.group_level]
     * @param {string} [options.key]
     * @param {string[]} [options.keys]
     * @param {*} [options.range]
     * @param {string|string[]} [options.range.start]
     * @param {string|string[]} [options.range.end]
     * @param {boolean} [options.range.inclusive_end]
     * @param {string[]} [options.id_range]
     * @param {string} [options.id_range.start]
     * @param {string} [options.id_range.end]
     * @param {number[]} [options.bbox]
     * @param {string} [options.include_docs]
     * @param {boolean} [options.full_set]
     * @param {ViewErrorMode} [options.on_error]
     * @param {integer} [options.timeout]
     */
    query(isSpatial, designDoc, viewName, options) {
        var queryOpts = {};
        var queryFlags = 0;

        // TODO: Maybe verify types/values?
        if (options.stale) {
            queryOpts.stale = options.stale;
        }
        if (options.skip) {
            queryOpts.skip = options.skip;
        }
        if (options.limit) {
            queryOpts.limit = options.limit;
        }
        if (options.order > 0) {
            queryOpts.descending = false;
        } else if (options.order < 0) {
            queryOpts.descending = true;
        }
        if (options.reduce) {
            queryOpts.reduce = options.reduce;
        }
        if (options.group) {
            queryOpts.group = options.group;
        }
        if (options.group_level) {
            queryOpts.group_level = options.group_level;
        }
        if (options.key) {
            queryOpts.key = JSON.stringify(options.key);
        }
        if (options.keys) {
            queryOpts.keys = JSON.stringify(options.keys);
        }
        if (options.full_set) {
            queryOpts.full_set = options.full_set;
        }
        if (options.on_error) {
            queryOpts.on_error = options.on_error;
        }
        if (options.range) {
            // TODO: Verify the whole thing is set...
            queryOpts.startkey = JSON.stringify(options.range.start);
            queryOpts.endkey = JSON.stringify(options.range.end);
            queryOpts.inclusive_end = JSON.stringify(options.range.inclusive_end);
        }
        if (options.id_range) {
            // TODO: Verify the whole thing is set...
            queryOpts.startkey_docid = JSON.stringify(options.id_range.start);
            queryOpts.endkey_docid = JSON.stringify(options.id_range.end);
        }
        if (options.bbox) {
            // TODO: Verify that bbox is of the correct types...
            queryOpts.bbox = options.bbox.join(',');
        }
        if (options.include_docs) {
            queryFlags |= binding.LCBX_VIEWFLAG_INCLUDEDOCS;
        }

        var queryData = qs.stringify(queryOpts);

        var emitter = new events.EventEmitter();

        this._conn.viewQuery(
            isSpatial, designDoc, viewName,
            queryData, null, queryFlags, options.timeout,
            (err, flags, data) => {
            if (flags & binding.LCB_RESP_F_FINAL) {
                if (err) {
                    emitter.emit('error', err);
                    emitter.emit('end');
                    return;
                }

                var meta = JSON.parse(data);
                emitter.emit('meta', meta);
                emitter.emit('end');
                
                return;
            }

            if (err) {
                emitter.emit('error', err);
                return;
            }
            
            var row = JSON.parse(data);
            emitter.emit('row', row);
        });

        return emitter;
    }
}

module.exports = ViewExecutor;
