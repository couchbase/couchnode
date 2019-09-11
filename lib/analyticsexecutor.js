const events = require('events');
const binding = require('./binding');
const errors = require('./errors');

class AnalyticsExecutor {
  constructor(conn) {
    this._conn = conn;
  }

  _parseError(errData, baseErr) {
    var err = new errors.QueryError(errData.msg, baseErr);
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
   * @param {Object|Array} params
   * @param {*} [options]
   * @param {boolean} [options.priority]
   * @param {integer} [options.timeout]
   */
  query(query, params, options) {
    var queryObj = {};
    var queryFlags = 0;

    queryObj.statement = query.toString();

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

    this._conn.analyticsQuery(
      queryData, queryFlags, options.timeout,
      (err, flags, data) => {
        if (flags & binding.LCB_RESP_F_FINAL) {
          if (err) {
            err = this._translateError(err, data);

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
