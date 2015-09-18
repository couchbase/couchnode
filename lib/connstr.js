'use strict';

var qs = require('querystring');

/**
 * @class ConnStr.Spec
 * A container to hold information decoded from a couchbase connection
 * string.  It contains the scheme, hosts, bucket name and various KV
 * options that were attached to the string.
 *
 * @property {string} scheme
 * @property {Array.<Array.<string,number>>} hosts
 * @property {string} bucket
 * @property {Object} options
 *
 * @private
 * @ignore
 */

/**
 * Static Constructor for Singleton object.  Not invokable.
 *
 * @constructor
 *
 * @private
 * @ignore
 */
function ConnStr() {
}

/**
 * @param {ConnStrSpec} dsn
 * @returns {ConnStr.Spec}
 *
 * @private
 */
ConnStr.prototype._normalize = function(dsn) {
  var dsnObj = {};

  if (dsn.scheme) {
    dsnObj.scheme = dsn.scheme;
  } else {
    dsnObj.scheme = 'http';
  }

  dsnObj.hosts = [];
  if (dsn.hosts) {
    if (typeof dsn.hosts === 'string') {
      dsn.hosts = [dsn.hosts];
    }

    for (var i = 0; i < dsn.hosts.length; ++i) {
      if (typeof dsn.hosts[i] === 'string') {
        var portPos = dsn.hosts[i].indexOf(':');
        if (portPos >= 0) {
          var hostName = dsn.hosts[i].substr(0, portPos);
          var portNum = parseInt(dsn.hosts[i].substr(portPos + 1), 10);
          dsnObj.hosts.push([hostName, portNum]);
        } else {
          dsnObj.hosts.push([dsn.hosts[i], 0]);
        }
      } else {
        dsnObj.hosts.push(dsn.hosts[i]);
      }
    }
  }

  if (dsn.bucket) {
    dsnObj.bucket = dsn.bucket;
  } else {
    dsnObj.bucket = 'default';
  }

  if (dsn.options) {
    dsnObj.options = dsn.options;
  } else {
    dsnObj.options = {};
  }

  return dsnObj;
};

/**
 * @param dsn
 * @returns {ConnStr.Spec}
 *
 * @private
 */
ConnStr.prototype._parse = function(dsn) {
  var out = {};

  if (!dsn) {
    return out;
  }

  var parts = /((.*):\/\/)?([^\/?]*)(\/([^\?]*))?(\?(.*))?/.exec(dsn);
  if (parts[2]) {
    out.scheme = parts[2];
  }
  if (parts[3]) {
    out.hosts = [];
    var hostMatcher = /([^;\,\:]+)(:([0-9]*))?(;\,)?/g;
    while (true) {
      var hostMatch = hostMatcher.exec(parts[3]);
      if (!hostMatch) {
        break;
      }
      out.hosts.push([
        hostMatch[1],
        hostMatch[3] ? parseInt(hostMatch[3], 10) : 0
      ]);
    }
  }
  if (parts[5]) {
    out.bucket = parts[5];
  }
  if (parts[7]) {
    out.options = qs.parse(parts[7]);
  }

  return out;
};

/**
 * @param options
 * @returns {string}
 *
 * @private
 */
ConnStr.prototype._stringify = function(options) {
  var dsn = '';
  if (options.scheme) {
    dsn += options.scheme + '://';
  }
  for (var i = 0; i < options.hosts.length; ++i) {
    var host = options.hosts[i];
    if (i !== 0) {
      dsn += ',';
    }
    dsn += host[0];
    if (host[1]) {
      dsn += ':' + host[1];
    }
  }
  dsn += '/';
  if (options.bucket) {
    dsn += options.bucket;
  }
  if (options.options) {
    dsn += '?' + qs.stringify(options.options);
  }
  return dsn;
};

/**
 * @param {ConnStr.Spec|string} dsn
 * @returns {ConnStr.Spec|string}
 *
 * @private
 */
ConnStr.prototype.normalize = function(dsn) {
  if (typeof dsn === 'string') {
    return this._stringify(
      this._normalize(
        this._parse(dsn)));
  }
  return this._normalize(dsn);
};

/**
 * @param {string} dsn
 * @returns {ConnStr.Spec}
 *
 * @private
 */
ConnStr.prototype.parse = function(dsn) {
  return this._normalize(this._parse(dsn));
};

/**
 * @param {ConnStr.Spec} options
 * @returns {string}
 *
 * @private
 */
ConnStr.prototype.stringify = function(options) {
  return this._stringify(this._normalize(options));
};

var connStr = new ConnStr();
module.exports = connStr;


