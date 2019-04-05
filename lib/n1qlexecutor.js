const events = require('events');
const binding = require('./binding');

class N1qlExecutor {
    constructor(conn) {
        this._conn = conn;
    }

    /**
     * 
     * @param {string} query 
     * @param {Object|Array} params 
     * @param {Object} [options]
     * @param {QueryConsistencyMode} [options.consistency]
     * @param {MutationState} [options.consistentWith]
     * @param {boolean} [options.adhoc]
     * @param {number} [options.scanCap]
     * @param {number} [options.pipelineBatch]
     * @param {number} [options.pipelineCap]
     * @param {boolean} [options.readOnly]
     * @param {QueryProfileMode} [options.profile]
     * @param {integer} [options.timeout]
     */
    query(query, params, options) {
        var queryObj = {};
        var queryFlags = 0;

        queryObj.statement = query.toString();
        
        // TODO: Maybe verify types/values?
        if (options.consistency) {
            queryObj.scan_consistency = options.consistency;
        }
        if (options.consistentWith) {
            if (queryObj.scan_consistency) {
                throw new Error('cannot specify consistency and consistentWith together');
            }

            queryObj.scan_consistency = 'at_plus';
            queryObj.scan_vectors = options.consistentWith.toObject();
        }
        if (options.adhoc === false) {
            queryFlags |= binding.LCBX_N1QLFLAG_PREPCACHE;
        }
        if (options.scanCap) {
            queryObj.scan_cap = options.scanCap;
        }
        if (options.pipelineBatch) {
            queryObj.pipeline_batch = options.pipelineBatch;
        }
        if (options.pipelineCap) {
            queryObj.pipeline_cap = options.pipelineCap;
        }
        if (options.readOnly) {
            queryObj.readonly = !!options.readOnly;
        }
        if (options.profile) {
            queryObj.profile = options.profile;
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

        this._conn.n1qlQuery(
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

module.exports = N1qlExecutor;
