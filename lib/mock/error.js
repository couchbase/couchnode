'use strict';

function CbError(message, code) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
  this.code = code;
}
CbError.prototype.__proto__ = Error.prototype;

module.exports = CbError;
