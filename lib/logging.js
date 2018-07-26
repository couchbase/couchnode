'use strict';

var winston = require('winston');
var winstonNull = require('winston-null');
var binding = require('./binding');
var CONST = binding.Constants;

var _loggingFunc = null;

/**
 * Enables logging, optionally through a custom logging function.
 *
 * @param {Object|Function} opts An options object or logging function.
 * @param {string} opts.colorize What to colorize in the console output.
 * @param {string} opts.level Minimum level to log.
 * @param {string} opts.filename The file path you wish to log to.
 * @param {boolean} opts.console Whether to log to the console.
 */
function enableLogging(opts) {
  if (!opts) {
    opts = {};
  }

  if (opts instanceof Function) {
    _loggingFunc = opts;
    return;
  }

  if (opts instanceof Object) {
    var level = 'info';
    if (opts.level) {
      level = opts.level;
    }

    var consoleLogOpts = {};
    if (opts.colorize) {
      consoleLogOpts.colorize = opts.colorize;
    }

    var transports = [];

    if (opts.console === undefined || opts.console) {
      transports.push(new(winston.transports.Console)(consoleLogOpts));
    }

    if (opts.filename) {
      transports.push(new(winston.transports.File)({
        filename: opts.filename
      }));
    }

    if (transports.length === 0) {
      // if no transports are defined, create a /dev/null transport
      // to stop winston from complaining about no transports.
      transports.push(new(winstonNull.NullTransport)());
    }

    var logger = winston.createLogger({
      level: level,
      transports: transports
    });
    _loggingFunc = logger.log.bind(logger);
    return;
  }

  _loggingFunc = null;
}
exports.enableLogging = enableLogging;

/**
 * Translates a libcouchbase logging severity into a winston
 * log level string.
 *
 * @param {Number} severity The libcouchbase logging severity.
 */
function lcbSeverityToLevel(severity) {
  switch (severity) {
    case CONST.LOG_TRACE:
      return 'silly';
    case CONST.LOG_DEBUG:
      return 'debug';
    case CONST.LOG_INFO:
      return 'info';
    case CONST.LOG_WARN:
      return 'warn';
    case CONST.LOG_ERROR:
      return 'error';
    case CONST.LOG_FATAL:
      return 'error';
  }
  return 'unknown';
}
exports.lcbSeverityToLevel = lcbSeverityToLevel;

function _currentFunc() {
  return _loggingFunc;
}
exports._currentFunc = _currentFunc;
