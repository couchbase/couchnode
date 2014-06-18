'use strict';

var qs = require('querystring');

function CbDsn() {
}

CbDsn.prototype._normalize = function(dsn) {
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

CbDsn.prototype._parse = function(dsn) {
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
    out.options = {};
    var kvMatcher = /([^=]*)=([^&?]*)[&?]?/g;
    while (true) {
      var kvMatch = kvMatcher.exec(parts[7]);
      if (!kvMatch) {
        break;
      }
      out.options[qs.unescape(kvMatch[1])] =
        qs.unescape(kvMatch[2]);
    }
  }

  return out;
};

CbDsn.prototype._stringify = function(options) {
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
  if (options.bucket) {
    dsn += '/' + options.bucket;
  }
  if (options.options) {
    var isFirstOption = true;
    for (var j in options.options) {
      if (options.options.hasOwnProperty(j)) {
        if (isFirstOption) {
          dsn += '?';
          isFirstOption = false;
        } else {
          dsn += '&';
        }
        dsn += qs.escape(j) + '=' + qs.escape(options.options[j]);
      }
    }
  }
  return dsn;
};

CbDsn.prototype.normalize = function(dsn) {
  if (typeof dsn === 'string') {
    return this._stringify(
      this._normalize(
        this._parse(dsn)));
  }
  return this._normalize(dsn);
};

CbDsn.prototype.parse = function(dsn) {
  return this._normalize(this._parse(dsn));
};

CbDsn.prototype.stringify = function(options) {
  return this._stringify(this._normalize(options));
};

module.exports = new CbDsn();


