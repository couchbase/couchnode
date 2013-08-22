'use strict';
var qs = require('querystring');

var CONST;

module.exports._init = function(c) {
  CONST = c;
}

function makeRestHandler(innerCallback) {

  var ret = function(error, response) {
    var body;
    if (error && response.status < 200 || response.status > 299) {
      error = new Error("HTTP error " + response.status);
    }

    try {
      body = JSON.parse(response.data)
    } catch (parseError) {
      // Error talking to server, pass the error on for now
      innerCallback(parseError, null);
    }

    // This should probably be updated to act differently
    if (body && body.error) {
      var errObj = new Error("REST error " + body.error);
      errObj.code = 9999;
      if (body.reason) {
        errObj.reason = body.reason;
      }
      innerCallback(errObj, null);
    } else {
      if (body.rows) {
        innerCallback(null, body.rows);
      } else if (body.results) {
        innerCallback(null, body.results);
      } else {
        innerCallback(null, body);
      }
    }
  };
  return ret;
}

var ViewFields = ["descending", "endkey", "endkey_docid",
                  "full_set", "group", "group_level", "inclusive_end",
                  "key", "keys", "limit", "on_error", "reduce", "skip",
                  "stale", "startkey", "startkey_docid"];

var JsonFields = ["endkey", "key", "keys", "startkey"];


module.exports.view = function(cb, ddoc, name, query, callback) {
  for (var q in query) {
    if (ViewFields.indexOf(q) == -1) {
      delete query[q];
    } else if (JsonFields.indexOf(q) != -1) {
      query[q] = JSON.stringify(query[q]);
    }
  }

  cb.httpRequest(null, {
    path: "_design/" + ddoc + "/_view/" + name + "?" + qs.stringify(query),
    lcb_http_type: CONST.LCB_HTTP_TYPE_VIEW,
    method: CONST.LCB_HTTP_METHOD_GET
  }, makeRestHandler(callback));
}


function makeDoc(doc) {
    if (typeof doc == "string") {
        return doc;
    } else {
        return JSON.stringify(doc);
    }
}

module.exports.setDesignDoc = function(cb, name, data, callback) {
  cb.httpRequest(null, {
    path: "_design/" + name,
    data: makeDoc(data),
    method: CONST.LCB_HTTP_METHOD_PUT,
    content_type: "application/json",
    lcb_http_type: CONST.LCB_HTTP_TYPE_VIEW
  }, makeRestHandler(callback));
}

module.exports.getDesignDoc = function(cb, name, callback) {
  cb.httpRequest(null, {
    path: "_design/" + name,
    method: CONST.LCB_HTTP_METHOD_GET,
    lcb_http_type: CONST.LCB_HTTP_TYPE_VIEW
  }, makeRestHandler(callback));
}

module.exports.deleteDesignDoc = function(cb, name, callback) {
  cb.httpRequest(null, {
    path: "_design/" + name,
    method: CONST.LCB_HTTP_METHOD_DELETE,
    lcb_http_type: CONST.LCB_HTTP_TYPE_VIEW
  }, makeRestHandler(callback));
}
