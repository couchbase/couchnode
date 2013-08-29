'use strict';
var qs = require('querystring');
var viewQuery = require('./viewQuery');

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

module.exports.view = function(cb, ddoc, name, query) {
  var query = query == undefined ? {} : query;
  return new viewQuery.ViewQuery(cb, ddoc, name, query, makeRestHandler);
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

module.exports.removeDesignDoc = function(cb, name, callback) {
  cb.httpRequest(null, {
    path: "_design/" + name,
    method: CONST.LCB_HTTP_METHOD_DELETE,
    lcb_http_type: CONST.LCB_HTTP_TYPE_VIEW
  }, makeRestHandler(callback));
}
