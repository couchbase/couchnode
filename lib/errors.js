'use strict';

var binding = require('./binding');

var CONST = binding.Constants;

/**
 * Enumeration of all error codes.  See libcouchbase documentation
 * for more details on what these errors represent.
 *
 * @global
 * @readonly
 * @enum {number}
 */
module.exports = {
  /** Operation was successful **/
  success: CONST.SUCCESS,

  /** Authentication should continue. **/
  authContinue: CONST.AUTH_CONTINUE,

  /** Error authenticating. **/
  authError: CONST.AUTH_ERROR,

  /** The passed incr/decr delta was invalid. **/
  deltaBadVal: CONST.DELTA_BADVAL,

  /** Object is too large to be stored on the cluster. **/
  objectTooBig: CONST.E2BIG,

  /** Server is too busy to handle your request right now. **/
  serverBusy: CONST.EBUSY,

  /** Internal libcouchbase error. **/
  cLibInternal: CONST.EINTERNAL,

  /** An invalid arguement was passed. **/
  cLibInvalidArgument: CONST.EINVAL,

  /** The server is out of memory. **/
  cLibOutOfMemory: CONST.ENOMEM,

  /** An invalid range was specified. **/
  invalidRange: CONST.ERANGE,

  /** An unknown error occured within libcouchbase. **/
  cLibGenericError: CONST.ERROR,

  /** A temporary error occured. Try again. **/
  temporaryError: CONST.ETMPFAIL,

  /** The key already exists on the server. **/
  keyAlreadyExists: CONST.KEY_EEXISTS,

  /** The key does not exist on the server. **/
  keyNotFound: CONST.KEY_ENOENT,

  /** Failed to open library. **/
  failedToOpenLibrary: CONST.DLOPEN_FAILED,

  /** Failed to find expected symbol in library. **/
  failedToFindSymbol: CONST.DLSYM_FAILED,

  /** A network error occured. **/
  networkError: CONST.NETWORK_ERROR,

  /** Operations were performed on the incorrect server. **/
  wrongServer: CONST.NOT_MY_VBUCKET,

  /** Operations were performed on the incorrect server. **/
  notMyVBucket: CONST.NOT_MY_VBUCKET,

  /** The document was not stored. */
  notStored: CONST.NOT_STORED,

  /** An unsupported operation was sent to the server. **/
  notSupported: CONST.NOT_SUPPORTED,

  /** An unknown command was sent to the server. **/
  unknownCommand: CONST.UNKNOWN_COMMAND,

  /** An unknown host was specified. **/
  unknownHost: CONST.UNKNOWN_HOST,

  /** A protocol error occured. **/
  protocolError: CONST.PROTOCOL_ERROR,

  /** The operation timed out. **/
  timedOut: CONST.ETIMEDOUT,

  /** Error connecting to the server. **/
  connectError: CONST.CONNECT_ERROR,

  /** The bucket you request was not found. **/
  bucketNotFound: CONST.BUCKET_ENOENT,

  /** libcouchbase is out of memory. **/
  clientOutOfMemory: CONST.CLIENT_ENOMEM,

  /** A temporary error occured in libcouchbase. Try again. **/
  clientTemporaryError: CONST.CLIENT_ETMPFAIL,

  /** A bad handle was passed. */
  badHandle: CONST.EBADHANDLE,

  /** A server bug caused the operation to fail. **/
  serverBug: CONST.SERVER_BUG,

  /** The host format specified is invalid. **/
  invalidHostFormat: CONST.INVALID_HOST_FORMAT,

  /** Not enough nodes to meet the operations durability requirements. **/
  notEnoughNodes: CONST.DURABILITY_ETOOMANY,

  /** Duplicate items. **/
  duplicateItems: CONST.DUPLICATE_COMMANDS,

  /** Key mapping failed and could not match a server. **/
  noMatchingServerForKey: CONST.NO_MATCHING_SERVER,

  /** A bad environment variable was specified. **/
  badEnvironmentVariable: CONST.BAD_ENVIRONMENT,

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
