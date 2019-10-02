const events = require('events');
const binding = require('./binding');
const errors = require('./errors');
const utils = require('./utils');

/**
 * @private
 */
class N1qlExecutor {
  constructor(conn) {
    this._conn = conn;
  }

  _parseError(errData, baseErr) {
    var err = new errors.AnalyticsError(errData.msg, baseErr);
    err.code = errData.code;
    return err;
  }

  _translateError(err, data) {
    if (err && err.code === 59) {
      try {
        var parsedData = JSON.parse(data);
        var errData = parsedData.errors;

        if (errData.length > 0) {
          err = this._parseError(errData[0], err);

          err.otherErrors = [];
          for (var i = 1; i < errData.length; ++i) {
            err.otherErrors.push(
              this._parseError(errData[i], err));
          }
        }
      } catch (e) {}
    }

    return err;
  }

  /**
   *
   * @param {string} query
   * @param {Object} [options]
   * @param {Object|Array} [options.parameters]
   * @param {QueryScanConsistency} [options.scanConsistency]
   * @param {MutationState} [options.consistentWith]
   * @param {boolean} [options.adhoc]
   * @param {string} [options.clientContextId]
   * @param {number} [options.maxParallelism]
   * @param {number} [options.pipelineBatch]
   * @param {number} [options.pipelineCap]
   * @param {number} [options.scanWait]
   * @param {number} [options.scanCap]
   * @param {boolean} [options.readOnly]
   * @param {QueryProfile} [options.profile]
   * @param {boolean} [options.metrics]
   * @param {Object} [options.raw]
   * @param {integer} [options.timeout]
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
        throw new Error('cannot specify consistency and consistentWith together');
      }

      queryObj.scan_consistency = 'at_plus';
      queryObj.scan_vectors = options.consistentWith.toObject();
    }
    if (options.adhoc === false) {
      queryFlags |= binding.LCBX_N1QLFLAG_PREPCACHE;
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

    if (options.parameters) {
      var params = options.parameters;
      if (Array.isArray(params)) {
        queryObj.args = params;
      } else {
        queryObj.args = {};
        Object.entries(params).forEach(([key, value]) => {
          queryObj.args['$' + key] = value;
        });
      }
    }

    if (options.raw) {
      for (var i in options.raw) {
        if (options.raw.hasOwnProperty(i)) {
          queryObj[i] = options.raw[i];
        }
      }
    }

    var queryData = JSON.stringify(queryObj);

    var emitter = new events.EventEmitter();

    this._conn.n1qlQuery(
      queryData, queryFlags, options.timeout,
      (err, flags, data) => {
        if (flags & binding.LCB_RESP_F_FINAL) {
          if (err) {
            err = this._translateError(err, data);

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
