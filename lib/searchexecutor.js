'use strict';

const events = require('events');
const binding = require('./binding');
const errors = require('./errors');

/**
 * @private
 */
class SearchExecutor {
  constructor(conn) {
    this._conn = conn;
  }

  /**
   *
   * @param {string} indexName
   * @param {string} query
   * @param {Object|Array} params
   * @param {Object} [options]
   * @param {number} [options.skip]
   * @param {number} [options.limit]
   * @param {boolean} [options.explain]
   * @param {Object} [options.highlight]
   * @param {HighlightStyle} [options.highlight.style]
   * @param {string[]} [options.highlight.fields]
   * @param {string[]} [options.fields]
   * @param {SearchFacet[]} [options.facets]
   * @param {string|SearchSort} [options.sort]
   * @param {SearchScanConsistency} [options.consistency]
   * @param {MutationState} [options.consistentWith]
   * @param {number} [options.timeout]
   * @param {SearchQueryCallback} [callback]
   *
   * @private
   */
  query(indexName, query, options) {
    var queryObj = {};
    var queryObjCtl = {};
    var queryFlags = 0;

    queryObj.indexName = indexName;
    queryObj.query = query;

    if (options.skip !== undefined) {
      queryObj.from = options.skip;
    }
    if (options.limit !== undefined) {
      queryObj.size = options.limit;
    }
    if (options.explain) {
      queryObj.explain = !!options.explain;
    }
    if (options.highlight) {
      queryObj.highlight = options.highlight;
    }
    if (options.fields) {
      queryObj.fields = options.fields;
    }
    if (options.sort) {
      queryObj.sort = options.sort;
    }
    if (options.facets) {
      queryObj.facets = options.facets;
    }
    if (options.consistency) {
      queryObjCtl.consistency = {
        level: options.consistency,
      };
    }
    if (options.consistentWith) {
      if (queryObjCtl.consistency) {
        throw new Error(
          'cannot specify consistency and consistentWith together'
        );
      }

      queryObjCtl.consistency = {
        level: 'at_plus',
        vectors: options.consistentWith.toObject(),
      };
    }
    if (options.timeout) {
      queryObjCtl.timeout = options.timeout;
    }

    // Only inject the `ctl` component if there are ctl's.
    if (Object.keys(queryObjCtl).length > 0) {
      queryObj.ctl = queryObjCtl;
    }

    var queryData = JSON.stringify(queryObj);

    var emitter = new events.EventEmitter();

    this._conn.searchQuery(
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

        var row = JSON.parse(data);
        emitter.emit('row', row);
      }
    );

    return emitter;
  }
}

module.exports = SearchExecutor;
