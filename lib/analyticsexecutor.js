'use strict';

const events = require('events');
const binding = require('./binding');
const errors = require('./errors');
const utils = require('./utils');

/**
 * AnalyticsExecutor
 *
 * @private
 */
class AnalyticsExecutor {
  constructor(conn) {
    this._conn = conn;
  }

  /**
   *
   * @param {string} query
   * @param {Object} [options]
   * @param {Object|Array} [options.parameters]
   * @param {AnalyticsScanConsistency} [options.scanConsistency]
   * @param {string} [options.clientContextId]
   * @param {boolean} [options.priority]
   * @param {boolean} [options.readOnly]
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
    if (options.clientContextId) {
      queryObj.client_context_id = options.clientContextId;
    }
    if (options.priority === true) {
      queryFlags |= binding.LCBX_ANALYTICSFLAG_PRIORITY;
    }
    if (options.readOnly) {
      queryObj.readonly = !!options.readOnly;
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

    this._conn.analyticsQuery(
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
              resultCount: metricsInfo.resultCount,
              resultSize: metricsInfo.resultSize,
              errorCount: metricsInfo.errorCount,
              processedObjects: metricsInfo.processedObjects,
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

module.exports = AnalyticsExecutor;
