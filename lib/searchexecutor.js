const events = require('events');
const binding = require('./binding');

class SearchExecutor {
  constructor(conn) {
    this._conn = conn;
  }

  /**
   * 
   * @param {string} query 
   * @param {Object|Array} params 
   * @param {*} [options]
   * @param {number} [options.skip]
   * @param {number} [options.limit]
   * @param {boolean} [options.explain]
   * @param {string[]} [options.highlight]
   * @param {string[]} [options.fields]
   * @param {SearchFacet[]} [options.facets]
   * @param {string|SearchSort} [options.sort]
   * @param {SearchConsistency} [options.consistency]
   * @param {MutationState} [options.consistentWith]
   * @param {number} [options.timeout]
   * @param {SearchQueryResult} callback 
   */
  query(query, options) {
    var queryObj = {};
    var queryObjCtl = {};
    var queryFlags = 0;

    queryObj.indexName = 'test';
    queryObj.query = query;

    if (options.skip !== undefined) {
      queryObj.from = options.skip;
    }
    if (options.limit !== undefined) {
      queryObj.size = options.limit;
    }
    if (options.explain) {
      // TODO: Maybe verify the type here?
      queryObj.explain = !!options.explain;
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
        levle: options.consistency,
      };
    }
    if (options.consistentWith) {
      if (queryObjCtl.consistency) {
        throw new Error(
          'cannot specify consistency and consistentWith together');
      }

      queryObjCtl.consistency = {
        level: 'at_plus',
        vectors: options.consistentWith.toObject(),
      }
    }
    if (options.timeout) {
      queryObj.ctl.timeout = options.timeout;
    }

    // Only inject the `ctl` component if there are ctl's.
    if (Object.keys(queryObjCtl).length > 0) {
      queryObj.ctl = queryObjCtl;
    }

    var queryData = JSON.stringify(queryObj);

    var emitter = new events.EventEmitter();

    this._conn.ftsQuery(
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

module.exports = SearchExecutor;
