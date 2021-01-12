'use strict';

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

  _fixOptions(options) {
    // JSCBC-727: Due to an oversight, the 3.0.0 release of the SDK incorrectly
    // specified various options using underscores rather than camelCase as the
    // rest of our API does.  The following performs a conversion between the two.
    if (options.group_level) {
      options = {
        groupLevel: options.group_level,
        ...options,
      };
    }
    if (options.range && options.range.inclusive_end) {
      options.range = {
        inclusiveEnd: options.range.inclusive_end,
        ...options.range,
      };
    }
    if (options.id_range) {
      options = {
        idRange: options.id_range,
        ...options,
      };
    }
    if (options.full_set) {
      options = {
        fullSet: options.full_set,
        ...options,
      };
    }
    if (options.on_error) {
      options = {
        onError: options.on_error,
        ...options,
      };
    }

    return options;
  }

  /**
   *
   * @param {string} designDoc
   * @param {string} viewName
   * @param {Object} [options]
   * @param {ViewScanConsistency} [options.scanConsistency]
   * @param {number} [options.skip]
   * @param {number} [options.limit]
   * @param {ViewOrdering} [options.order]
   * @param {string} [options.reduce]
   * @param {boolean} [options.group]
   * @param {number} [options.groupLevel]
   * @param {string} [options.key]
   * @param {string[]} [options.keys]
   * @param {Object} [options.range]
   * @param {string|string[]} [options.range.start]
   * @param {string|string[]} [options.range.end]
   * @param {boolean} [options.range.inclusiveEnd]
   * @param {Object} [options.idRange]
   * @param {string} [options.idRange.start]
   * @param {string} [options.idRange.end]
   * @param {boolean} [options.fullSet]
   * @param {ViewErrorMode} [options.onError]
   * @param {number} [options.timeout]
   *
   * @private
   */
  query(designDoc, viewName, options) {
    options = this._fixOptions(options);

    // Deprecated usage conversion for the old 'stale' option.
    if (options.stale) {
      options = { ...options };
      options.scanConsistency = options.stale;
      delete options.stale;
    }

    var queryOpts = {};
    var queryFlags = 0;

    if (options.scanConsistency) {
      queryOpts.stale = options.scanConsistency;
    }
    if (options.skip) {
      queryOpts.skip = options.skip;
    }
    if (options.limit !== undefined) {
      queryOpts.limit = options.limit;
    }
    if (typeof options.order === 'string') {
      queryOpts.descending = options.order;
    } else {
      // BUG(JSCBC-822): We inadvertently created the enumeration incorrectly
      // when it was introduced, this allows backwards compatibility.
      if (options.order > 0) {
        queryOpts.descending = false;
      } else if (options.order < 0) {
        queryOpts.descending = true;
      }
    }
    if (options.reduce) {
      queryOpts.reduce = options.reduce;
    }
    if (options.group) {
      queryOpts.group = options.group;
    }
    if (options.groupLevel) {
      queryOpts.group_level = options.groupLevel;
    }
    if (options.key) {
      queryOpts.key = JSON.stringify(options.key);
    }
    if (options.keys) {
      queryOpts.keys = JSON.stringify(options.keys);
    }
    if (options.fullSet) {
      queryOpts.full_set = options.fullSet;
    }
    if (options.onError) {
      queryOpts.on_error = options.onError;
    }
    if (options.range) {
      queryOpts.startkey = JSON.stringify(options.range.start);
      queryOpts.endkey = JSON.stringify(options.range.end);
      queryOpts.inclusive_end = JSON.stringify(options.range.inclusiveEnd);
    }
    if (options.idRange) {
      queryOpts.startkey_docid = options.idRange.start;
      queryOpts.endkey_docid = options.idRange.end;
    }

    var queryData = qs.stringify(queryOpts);

    var emitter = new events.EventEmitter();

    this._conn.viewQuery(
      designDoc,
      viewName,
      queryData,
      null,
      queryFlags,
      options.timeout * 1000,
      (err, flags, data, docId, key) => {
        if (!(flags & binding.LCBX_RESP_F_NONFINAL)) {
          if (err) {
            err = errors.wrapLcbErr(err);

            emitter.emit('error', err);
            emitter.emit('end');
            return;
          }

          var metaInfo = JSON.parse(data);

          var meta = {
            totalRows: metaInfo.total_rows,
          };
          if (metaInfo.debug) {
            meta.debug = metaInfo.debug;
          }

          // JSCBC-727: Provide a deprecation accessor for total_rows
          Object.defineProperty(meta, 'total_rows', {
            enumerable: false,
            value: metaInfo.total_rows,
          });

          emitter.emit('meta', meta);
          emitter.emit('end');

          return;
        }

        if (err) {
          err = errors.wrapLcbErr(err);

          emitter.emit('error', err);
          return;
        }

        var row = {};
        row.value = JSON.parse(data);
        if (docId) {
          row.id = docId.toString();
        }
        if (key) {
          row.key = JSON.parse(key);
        }

        emitter.emit('row', row);
      }
    );

    return emitter;
  }
}

module.exports = ViewExecutor;
