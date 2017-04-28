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

  /** The client is too busy to process further requests. */
  clientBusy: CONST.BUSY,

  /** An invalid username was passed. */
  invalidUsername: CONST.INVALID_USERNAME,

  /** The configuration cache is invalid. */
  configCacheInvalid: CONST.CONFIG_CACHE_INVALID,

  /** The requested SASL mechanism was unavailable. */
  saslmechUnavailable: CONST.SASLMECH_UNAVAILABLE,

  /** Too many HTTP redirects were encountered. */
  tooManyRedirects: CONST.TOO_MANY_REDIRECTS,

  /** The configuration map has changed. */
  mapChanged: CONST.MAP_CHANGED,

  /** An incomplete packet was received. */
  incompletePacket: CONST.INCOMPLETE_PACKET,

  /** Connection was refused. */
  connectionRefused: CONST.ECONNREFUSED,

  /** The socket was shut down. */
  socketShutdown: CONST.ESOCKSHUTDOWN,

  /** The connection was reset. */
  connectionReset: CONST.ECONNRESET,

  /** Failed to get the port. */
  cannotGetPort: CONST.ECANTGETPORT,

  /** The systems FD limit was received. */
  fdLimitReached: CONST.EFDLIMITREACHED,

  /** The network was unreachable. */
  netUnreachable: CONST.ENETUNREACH,

  /** An unknown cntl value was specified. */
  ctlUnknown: CONST.ECTL_UNKNOWN,

  /** An unsupported cntl mode was specified. */
  ctlUnsupportedMode: CONST.ECTL_UNSUPPMODE,

  /** An invalid cntl argument  */
  ctlBadArguments: CONST.ECTL_BADARG,

  /** An empty key was specified. */
  emptyKey: CONST.EMPTY_KEY,

  /** An SSL error occurred. */
  sslError: CONST.SSL_ERROR,

  /** Verification of the SSL host failed */
  sslCantVerify: CONST.SSL_CANTVERIFY,

  /** An internal scheduling error occurred. */
  internalSchedulingFailure: CONST.SCHEDFAIL_INTERNAL,

  /** A requested client feature is unavailable. */
  clientFeatureUnavailable: CONST.CLIENT_FEATURE_UNAVAILABLE,

  /** Conflicting options were specified. */
  optionsConflict: CONST.OPTIONS_CONFLICT,

  /** A generic HTTP error has occurred. */
  httpError: CONST.HTTP_ERROR,

  /** Durability checks failed due to missing mutation tokens. */
  durabilityNoMutationTokens: CONST.DURABILITY_NO_MUTATION_TOKENS,

  /** An unknown memcached error has occurred. */
  unknownMemcachedError: CONST.UNKNOWN_MEMCACHED_ERROR,

  /** A mutation was lost. */
  mutationLost: CONST.MUTATION_LOST,

  /** Sub-document path was not found. */
  subdocPathNotFound: CONST.SUBDOC_PATH_ENOENT,

  /** Sub-document path mismatch. */
  subdocPathMismatch: CONST.SUBDOC_PATH_MISMATCH,

  /** Sub-document path was invalid. */
  subdocPathInvalid: CONST.SUBDOC_PATH_EINVAL,

  /** Sub-document path was too big. */
  subdocPathTooBig: CONST.SUBDOC_PATH_E2BIG,

  /** Sub-document document is too deep. */
  subdocDocTooDeep: CONST.SUBDOC_DOC_E2DEEP,

  /** Sub-document value insertion failed */
  subdocCannotInsertValue: CONST.SUBDOC_VALUE_CANTINSERT,

  /** Sub-document document is not JSON. */
  subdocDocumentNotJson: CONST.SUBDOC_DOC_NOTJSON,

  /** Sub-document value was out of range. */
  subdocInvalidRange: CONST.SUBDOC_NUM_ERANGE,

  /** Invalid delta passed to sub-document operation. */
  subdocBadDelta: CONST.SUBDOC_BAD_DELTA,

  /** Sub-document path already exists. */
  subdocPathExists: CONST.SUBDOC_PATH_EEXISTS,

  /** Sub-document multi-operation failed. */
  subdocMultiFailure: CONST.SUBDOC_MULTI_FAILURE,

  /** Sub-document value was too deep */
  subdocValueTooDeep: CONST.SUBDOC_VALUE_E2DEEP,

  /** An invalid argument was passed to the Server. */
  invalidArgument: CONST.EINVAL_MCD,

  /** Sub-document path was empty. */
  emptyPath: CONST.EMPTY_PATH,

  /** Unknown sub-document command encountered. */
  unknownSubdocCommand: CONST.UNKNOWN_SDCMD,

  /** Sub-document operations list was empty. */
  noCommands: CONST.ENO_COMMANDS,

  /** A query error occurred. */
  queryError: CONST.QUERY_ERROR,

  /** A generic temporary error occurred. */
  genericTmpError: CONST.GENERIC_TMPERR,

  /** A generic sub-document error occured. */
  genericSubdocError: CONST.GENERIC_SUBDOCERR,

  /** A generic constraint error occured. */
  genericConstraintError: CONST.GENERIC_CONSTRAINT_ERR,

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
