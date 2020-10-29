'use strict';

const events = require('events');
const binding = require('./binding');
const errors = require('./errors');
const utils = require('./utils');

/**
 * @private
 */
class QueryExecutor {
  constructor(conn) {
    this._conn = conn;
  }

  /**
   *
   * @param {string} query
   * @param {Object} [options]
   * @param {Object|Array} [options.parameters]
   * @param {QueryScanConsistency} [options.scanConsistency]
   * @param {MutationState} [options.consistentWith]
   * @param {boolean} [options.adhoc]
   * @param {boolean} [options.flexIndex]
   * @param {string} [options.clientContextId]
   * @param {number} [options.maxParallelism]
   * @param {number} [options.pipelineBatch]
   * @param {number} [options.pipelineCap]
   * @param {number} [options.scanWait]
   * @param {number} [options.scanCap]
   * @param {boolean} [options.readOnly]
   * @param {QueryProfileMode} [options.profile]
   * @param {boolean} [options.metrics]
   * @param {string} [options.queryContext]
   * @param {Object} [options.raw]
   * @param {number} [options.timeout]
   *
   * @private
   */
  query(query, options) {
    var queryObj = {};
    var queryFlags = 0;

    queryObj.statement = query.toString();

    if (options.scanConsistency) {
      queryObj.scan_consistency = options.scanConsistency;
    }
    if (options.consistentWith) {
      if (queryObj.scan_consistency) {
        throw new Error(
          'cannot specify consistency and consistentWith together'
        );
      }

      queryObj.scan_consistency = 'at_plus';
      queryObj.scan_vectors = options.consistentWith.toObject();
    }
    if (options.adhoc === false) {
      queryFlags |= binding.LCBX_QUERYFLAG_PREPCACHE;
    }
    if (options.flexIndex) {
      queryObj.use_fts = true;
    }
    if (options.clientContextId) {
      queryObj.client_context_id = options.clientContextId;
    }
    if (options.maxParallelism) {
      queryObj.max_parallelism = options.maxParallelism.toString();
    }
    if (options.pipelineBatch) {
      queryObj.pipeline_batch = options.pipelineBatch.toString();
    }
    if (options.pipelineCap) {
      queryObj.pipeline_cap = options.pipelineCap.toString();
    }
    if (options.scanWait) {
      queryObj.scan_wait = utils.msToGoDurationStr(options.scanWait);
    }
    if (options.scanCap) {
      queryObj.scan_cap = options.scanCap.toString();
    }
    if (options.readOnly) {
      queryObj.readonly = !!options.readOnly;
    }
    if (options.profile) {
      queryObj.profile = options.profile;
    }
    if (options.metrics) {
      queryObj.metrics = options.metrics;
    }
    if (options.queryContext) {
      queryObj.query_context = options.queryContext;
    }

    if (options.parameters) {
      var params = options.parameters;
      if (Array.isArray(params)) {
        queryObj.args = params;
      } else {
        Object.entries(params).forEach(([key, value]) => {
          queryObj['$' + key] = value;
        });
      }
    }

    if (options.raw) {
      for (var i in options.raw) {
        if (Object.prototype.hasOwnProperty.call(options.raw, i)) {
          queryObj[i] = options.raw[i];
        }
      }
    }

    var queryData = JSON.stringify(queryObj);

    var emitter = new events.EventEmitter();

    this._conn.query(
      queryData,
      queryFlags,
      options.timeout * 1000,
      (err, flags, data) => {
        if (flags & binding.LCB_RESP_F_FINAL) {
          if (err) {
            err = errors.wrapLcbErr(err);

            emitter.emit('error', err);
            emitter.emit('end');
            return;
          }

          var metaInfo = JSON.parse(data);
          var meta = {
            requestId: metaInfo.requestID,
            clientContextId: metaInfo.clientContextID,
            status: metaInfo.status,
            signature: metaInfo.signature,
            profile: metaInfo.profile,
          };
          if (metaInfo.warnings) {
            meta.warnings = [];
            metaInfo.warnings.forEach((warning) => {
              meta.warnings.push({
                code: warning.code,
                message: warning.message,
              });
            });
          }
          if (metaInfo.metrics) {
            var metricsInfo = metaInfo.metrics;
            meta.metrics = {
              elapsedTime: utils.goDurationStrToMs(metricsInfo.elapsedTime),
              executionTime: utils.goDurationStrToMs(metricsInfo.executionTime),
              sortCount: metricsInfo.sortCount,
              resultCount: metricsInfo.resultCount,
              resultSize: metricsInfo.resultSize,
              mutationCount: metricsInfo.mutationCount,
              errorCount: metricsInfo.errorCount,
              warningCount: metricsInfo.warningCount,
            };
          }

          emitter.emit('meta', meta);
          emitter.emit('end');

          return;
        }

        if (err) {
          err = errors.wrapLcbErr(err);

          emitter.emit('error', err);
          return;
        }

        var row = JSON.parse(data);
        emitter.emit('row', row);
      }
    );

    return emitter;
  }
}

module.exports = QueryExecutor;
