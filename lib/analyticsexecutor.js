const events = require('events');
const binding = require('./binding');

class AnalyticsExecutor {
    constructor(conn) {
        this._conn = conn;
    }

    /**
     * 
     * @param {string} query 
     * @param {Object|Array} params 
     * @param {*} [options]
     * @param {boolean} [options.priority]
     * @param {integer} [options.timeout]
     */
    query(query, params, options) {
        var queryObj = {};
        var queryFlags = 0;

        queryObj.statement = query.toString();
        
        // TODO: Implement Analytics consistency?

        // TODO: Maybe verify types/values?
        if (options.priority) {
            queryObj.priority = !!options.priority;
        }

        if (params) {
            if (Array.isArray(params)) {
                queryObj.args = params;
            } else {
                queryObj.args = {};
                Object.entries(params).forEach(([key, value]) => {
                    queryObj.args['$' + key] = value;
                });
            }
        }

        var queryData = JSON.stringify(queryObj);

        var emitter = new events.EventEmitter();

        this._conn.cbasQuery(
                queryData, queryFlags, options.timeout,
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

module.exports = AnalyticsExecutor;
