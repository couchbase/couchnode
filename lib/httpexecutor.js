'use strict';

const errors = require('./errors');
const events = require('events');
const binding = require('./binding');

/**
 * @private
 */
class HttpExecutor {
  constructor(conn) {
    this._conn = conn;
  }

  streamRequest(options) {
    var emitter = new events.EventEmitter();

    var httpType;
    if (options.type === 'MGMT') {
      httpType = binding.LCB_HTTP_TYPE_MANAGEMENT;
    } else if (options.type === 'VIEW') {
      httpType = binding.LCB_HTTP_TYPE_VIEW;
    } else if (options.type === 'QUERY') {
      httpType = binding.LCB_HTTP_TYPE_QUERY;
    } else if (options.type === 'SEARCH') {
      httpType = binding.LCB_HTTP_TYPE_SEARCH;
    } else if (options.type === 'ANALYTICS') {
      httpType = binding.LCB_HTTP_TYPE_ANALYTICS;
    } else {
      throw new Error('unexpected http request type');
    }

    var httpMethod;
    if (!options.method) {
      httpMethod = binding.LCB_HTTP_METHOD_GET;
    } else if (options.method === 'GET') {
      httpMethod = binding.LCB_HTTP_METHOD_GET;
    } else if (options.method === 'POST') {
      httpMethod = binding.LCB_HTTP_METHOD_POST;
    } else if (options.method === 'PUT') {
      httpMethod = binding.LCB_HTTP_METHOD_PUT;
    } else if (options.method === 'DELETE') {
      httpMethod = binding.LCB_HTTP_METHOD_DELETE;
    } else {
      throw new Error('unexpected http request method');
    }

    this._conn.httpRequest(
      httpType,
      httpMethod,
      options.path,
      options.contentType,
      options.body,
      options.timeout * 1000,
      (err, flags, data) => {
        if (flags & binding.LCB_RESP_F_FINAL) {
          if (err) {
            err = errors.wrapLcbErr(err);

            emitter.emit('error', err);
            return;
          }

          // data will be an object
          emitter.emit('end', data);
          return;
        }

        if (err) {
          throw new Error('unexpected error on non-final callback');
        }

        // data will be a buffer
        emitter.emit('data', data);
      }
    );

    return emitter;
  }

  async request(options, callback) {
    return new Promise((resolve, reject) => {
      var emitter = this.streamRequest(options);

      emitter.on('error', (err) => {
        if (callback) {
          callback(err);
        }

        reject(err);
      });

      var dataCache = Buffer.allocUnsafe(0);
      emitter.on('data', (data) => {
        dataCache = Buffer.concat([dataCache, data]);
      });

      emitter.on('end', (meta) => {
        var headers = {};
        for (var i = 0; i < meta.headers.length; i += 2) {
          var headerName = meta.headers[i + 0];
          var headerValue = meta.headers[i + 1];

          if (headers[headerName]) {
            headers[headerName] += ',' + headerValue;
          } else {
            headers[headerName] = headerValue;
          }
        }

        resolve({
          statusCode: meta.statusCode,
          headers: headers,
          body: dataCache,
        });
      });
    });
  }
}

module.exports = HttpExecutor;
