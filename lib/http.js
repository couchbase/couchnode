'use strict';
var qs = require('querystring');
var viewQuery = require('./viewQuery');

var CONST;

module.exports._init = function(c) {
  CONST = c;
};

function makeRestHandler(innerCallback) {

  var ret = function(error, response) {
    var body;
    if (error && response.status < 200 || response.status > 299) {
      error = new Error("HTTP error " + response.status);
    }

    try {
      body = JSON.parse(response.data);
    } catch (parseError) {
      // Error talking to server, pass the error on for now
      innerCallback(parseError, null);
    }

    if (body.debug_info) {
      // if debug information is returned, log it for the user
      console.log('View Debugging Information Returned: ', body.debug_info);
    }

    // This should probably be updated to act differently
    var errObj = null;
    if (body && body.error) {
      errObj = new Error("REST error " + body.error);
      errObj.code = 9999;
      if (body.reason) {
        errObj.reason = body.reason;
      }
    }
    if (body && body.errors) {
      errObj = [];
      for (var i = 0; i < body.errors.length; ++i) {
        var tmpErrObj = new Error("REST error " + body.errors[i]);
        tmpErrObj.code = 9999;
        if (body.errors[i].reason) {
          tmpErrObj.reason = body.errors[i].reason;
        }
        errObj.push(tmpErrObj);
      }
    }

    if (body.rows) {
      innerCallback(errObj, body.rows);
    } else if (body.results) {
      innerCallback(errObj, body.results);
    } else if (body.views) {
      innerCallback(errObj, body);
    } else {
      innerCallback(errObj, null);
    }
  };
  return ret;
}

module.exports.view = function(cb, ddoc, name, query) {
  var query = query == undefined ? {} : query;
  return new viewQuery.ViewQuery(cb, ddoc, name, query, makeRestHandler);
};


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
};

module.exports.getDesignDoc = function(cb, name, callback) {
  cb.httpRequest(null, {
    path: "_design/" + name,
    method: CONST.LCB_HTTP_METHOD_GET,
    lcb_http_type: CONST.LCB_HTTP_TYPE_VIEW
  }, makeRestHandler(callback));
};

module.exports.removeDesignDoc = function(cb, name, callback) {
  cb.httpRequest(null, {
    path: "_design/" + name,
    method: CONST.LCB_HTTP_METHOD_DELETE,
    lcb_http_type: CONST.LCB_HTTP_TYPE_VIEW
  }, makeRestHandler(callback));
};
