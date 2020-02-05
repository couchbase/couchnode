const events = require('events');
const qs = require('qs');
const binding = require('./binding');
const errors = require('./errors');

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
   * @param {string} [options.include_docs]
   * @param {boolean} [options.full_set]
   * @param {ViewErrorMode} [options.on_error]
   * @param {integer} [options.timeout]
   */
  query(designDoc, viewName, options) {
    var queryOpts = {};
    var queryFlags = 0;

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
      queryOpts.startkey = JSON.stringify(options.range.start);
      queryOpts.endkey = JSON.stringify(options.range.end);
      queryOpts.inclusive_end = JSON.stringify(options.range.inclusive_end);
    }
    if (options.id_range) {
      queryOpts.startkey_docid = JSON.stringify(options.id_range.start);
      queryOpts.endkey_docid = JSON.stringify(options.id_range.end);
    }
    if (options.include_docs) {
      queryFlags |= binding.LCBX_VIEWFLAG_INCLUDEDOCS;
    }

    var queryData = qs.stringify(queryOpts);

    var emitter = new events.EventEmitter();

    this._conn.viewQuery(
      designDoc, viewName,
      queryData,
      null,
      queryFlags,
      options.timeout * 1000,
      (err, flags, data, key, id) => {
        if (flags & binding.LCB_RESP_F_FINAL) {
          if (err) {
            err = errors.wrapLcbErr(err);

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
          err = errors.wrapLcbErr(err);

          emitter.emit('error', err);
          return;
        }

        emitter.emit('row', {
          doc: JSON.parse(data),
          key: JSON.parse(key),
          id: String(id)
        });
      });

    return emitter;
  }
}

module.exports = ViewExecutor;
