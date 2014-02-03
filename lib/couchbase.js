'use strict';

var qstring = require('./qstring');

module.exports.Connection = require('./connection');
module.exports.Mock = require('./mock');

module.exports.formatQuery =
  module.exports.Mock.formatQuery =
    function(query, values) {
  return qstring.format(query, values);
};


var CONST = require('./binding').Constants;

/**
 * Enumeration of all error codes.  See libcouchbase documentation
 * for more details on what these errors represent.
 *
 * @global
 * @readonly
 * @enum {number}
 */
module.exports.errors = {
  /** Operation was successful **/
  success: CONST.LCB_SUCCESS,

  /** Authentication should continue. **/
  authContinue: CONST.LCB_AUTH_CONTINUE,

  /** Error authenticating. **/
  authError: CONST.LCB_AUTH_ERROR,

  /** The passed incr/decr delta was invalid. **/
  deltaBadVal: CONST.LCB_DELTA_BADVAL,

  /** Object is too large to be stored on the cluster. **/
  objectTooBig: CONST.LCB_E2BIG,

  /** Server is too busy to handle your request right now. **/
  serverBusy: CONST.LCB_EBUSY,

  /** Internal libcouchbase error. **/
  cLibInternal: CONST.LCB_EINTERNAL,

  /** An invalid arguement was passed. **/
  cLibInvalidArgument: CONST.LCB_EINVAL,

  /** The server is out of memory. **/
  cLibOutOfMemory: CONST.LCB_ENOMEM,

  /** An invalid range was specified. **/
  invalidRange: CONST.LCB_ERANGE,

  /** An unknown error occured within libcouchbase. **/
  cLibGenericError: CONST.LCB_ERROR,

  /** A temporary error occured. Try again. **/
  temporaryError: CONST.LCB_ETMPFAIL,

  /** The key already exists on the server. **/
  keyAlreadyExists: CONST.LCB_KEY_EEXISTS,

  /** The key does not exist on the server. **/
  keyNotFound: CONST.LCB_KEY_ENOENT,

  /** Failed to open library. **/
  failedToOpenLibrary: CONST.LCB_DLOPEN_FAILED,

  /** Failed to find expected symbol in library. **/
  failedToFindSymbol: CONST.LCB_DLSYM_FAILED,

  /** A network error occured. **/
  networkError: CONST.LCB_NETWORK_ERROR,

  /** Operations were performed on the incorrect server. **/
  wrongServer: CONST.LCB_NOT_MY_VBUCKET,

  /** Operations were performed on the incorrect server. **/
  notMyVBucket: CONST.LCB_NOT_MY_VBUCKET,

  /** The document was not stored. */
  notStored: CONST.LCB_NOT_STORED,

  /** An unsupported operation was sent to the server. **/
  notSupported: CONST.LCB_NOT_SUPPORTED,

  /** An unknown command was sent to the server. **/
  unknownCommand: CONST.LCB_UNKNOWN_COMMAND,

  /** An unknown host was specified. **/
  unknownHost: CONST.LCB_UNKNOWN_HOST,

  /** A protocol error occured. **/
  protocolError: CONST.LCB_PROTOCOL_ERROR,

  /** The operation timed out. **/
  timedOut: CONST.LCB_ETIMEDOUT,

  /** Error connecting to the server. **/
  connectError: CONST.LCB_CONNECT_ERROR,

  /** The bucket you request was not found. **/
  bucketNotFound: CONST.LCB_BUCKET_ENOENT,

  /** libcouchbase is out of memory. **/
  clientOutOfMemory: CONST.LCB_CLIENT_ENOMEM,

  /** A temporary error occured in libcouchbase. Try again. **/
  clientTemporaryError: CONST.LCB_CLIENT_ETMPFAIL,

  /** A bad handle was passed. */
  badHandle: CONST.LCB_EBADHANDLE,

  /** A server bug caused the operation to fail. **/
  serverBug: CONST.LCB_SERVER_BUG,

  /** The host format specified is invalid. **/
  invalidHostFormat: CONST.LCB_INVALID_HOST_FORMAT,

  /** Not enough nodes to meet the operations durability requirements. **/
  notEnoughNodes: CONST.LCB_DURABILITY_ETOOMANY,

  /** Duplicate items. **/
  duplicateItems: CONST.LCB_DUPLICATE_COMMANDS,

  /** Key mapping failed and could not match a server. **/
  noMatchingServerForKey: CONST.LCB_NO_MATCHING_SERVER,

  /** A bad environment variable was specified. **/
  badEnvironmentVariable: CONST.LCB_BAD_ENVIRONMENT,

  /** Couchnode is out of memory. **/
  outOfMemory: CONST['ErrorCode::MEMORY'],

  /** Invalid arguements were passed. **/
  invalidArguments: CONST['ErrorCode::ARGUMENTS'],

  /** An error occured while trying to schedule the operation. **/
  schedulingError: CONST['ErrorCode::SCHEDULING'],

  /** Not all operations completed successfully. **/
  checkResults: CONST['ErrorCode::CHECK_RESULTS'],

  /** A generic error occured in Couchnode. **/
  genericError: CONST['ErrorCode::GENERIC'],

  /** The specified durability requirements could not be satisfied. **/
  durabilityFailed: CONST['ErrorCode::DURABILITY_FAILED'],

  /** An error occured during a RESTful operation. **/
  restError: CONST['ErrorCode::REST']
};

/**
 * Enumeration of all value encoding formats.
 *
 * @global
 * @readonly
 * @enum {number}
 */
module.exports.format = {
  /** Store as raw bytes. **/
  raw: CONST['ValueFormat::RAW'],

  /** Store as JSON encoded string. **/
  json: CONST['ValueFormat::JSON'],

  /** Store as UTF-8 encoded string. **/
  utf8: CONST['ValueFormat::UTF8'],

  /** Automatically determine best storage format. **/
  auto: CONST['ValueFormat::AUTO']
};
