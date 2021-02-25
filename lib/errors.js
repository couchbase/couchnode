'use strict';

const binding = require('./binding');

function _makeHttpError(httpRes) {
  var err = new Error('http error');
  err.statusCode = httpRes.statusCode;
  err.response = httpRes.body.toString();
  return err;
}
exports.makeHttpError = _makeHttpError;

/**
 * @category Errors
 */
class CouchbaseError extends Error {
  constructor(errtext, baseerr, context, ...args) {
    super(errtext, ...args);
    this.cause = baseerr;
    this.context = context;
    Error.captureStackTrace(this, CouchbaseError);
  }
}
exports.CouchbaseError = CouchbaseError;

/**
 * @category Errors
 */
class TimeoutError extends CouchbaseError {
  constructor(...args) {
    super('timeout', ...args);
    Error.captureStackTrace(this, TimeoutError);
  }
}
exports.TimeoutError = TimeoutError;

/**
 * @category Errors
 */
class RequestCanceledError extends CouchbaseError {
  constructor(...args) {
    super('request canceled', ...args);
    Error.captureStackTrace(this, RequestCanceledError);
  }
}
exports.RequestCanceledError = RequestCanceledError;

/**
 * @category Errors
 */
class InvalidArgumentError extends CouchbaseError {
  constructor(...args) {
    super('invalid argument', ...args);
    Error.captureStackTrace(this, InvalidArgumentError);
  }
}
exports.InvalidArgumentError = InvalidArgumentError;

/**
 * @category Errors
 */
class ServiceNotAvailableError extends CouchbaseError {
  constructor(...args) {
    super('service not available', ...args);
    Error.captureStackTrace(this, ServiceNotAvailableError);
  }
}
exports.ServiceNotAvailableError = ServiceNotAvailableError;

/**
 * @category Errors
 */
class InternalServerFailureError extends CouchbaseError {
  constructor(...args) {
    super('internal server failure', ...args);
    Error.captureStackTrace(this, InternalServerFailureError);
  }
}
exports.InternalServerFailureError = InternalServerFailureError;

/**
 * @category Errors
 */
class AuthenticationFailureError extends CouchbaseError {
  constructor(...args) {
    super('authentication failure', ...args);
    Error.captureStackTrace(this, AuthenticationFailureError);
  }
}
exports.AuthenticationFailureError = AuthenticationFailureError;

/**
 * @category Errors
 */
class TemporaryFailureError extends CouchbaseError {
  constructor(...args) {
    super('temporary failure', ...args);
    Error.captureStackTrace(this, TemporaryFailureError);
  }
}
exports.TemporaryFailureError = TemporaryFailureError;

/**
 * @category Errors
 */
class ParsingFailureError extends CouchbaseError {
  constructor(...args) {
    super('parsing failure', ...args);
    Error.captureStackTrace(this, ParsingFailureError);
  }
}
exports.ParsingFailureError = ParsingFailureError;

/**
 * @category Errors
 */
class CasMismatchError extends CouchbaseError {
  constructor(...args) {
    super('cas mismatch', ...args);
    Error.captureStackTrace(this, CasMismatchError);
  }
}
exports.CasMismatchError = CasMismatchError;

/**
 * @category Errors
 */
class BucketNotFoundError extends CouchbaseError {
  constructor(...args) {
    super('bucket not found', ...args);
    Error.captureStackTrace(this, BucketNotFoundError);
  }
}
exports.BucketNotFoundError = BucketNotFoundError;

/**
 * @category Errors
 */
class CollectionNotFoundError extends CouchbaseError {
  constructor(...args) {
    super('collection not found', ...args);
    Error.captureStackTrace(this, CollectionNotFoundError);
  }
}
exports.CollectionNotFoundError = CollectionNotFoundError;

/**
 * @category Errors
 */
class EncodingFailureError extends CouchbaseError {
  constructor(...args) {
    super('encoding failure', ...args);
    Error.captureStackTrace(this, EncodingFailureError);
  }
}
exports.EncodingFailureError = EncodingFailureError;

/**
 * @category Errors
 */
class DecodingFailureError extends CouchbaseError {
  constructor(...args) {
    super('decoding failure', ...args);
    Error.captureStackTrace(this, DecodingFailureError);
  }
}
exports.DecodingFailureError = DecodingFailureError;

/**
 * @category Errors
 */
class UnsupportedOperationError extends CouchbaseError {
  constructor(...args) {
    super('unsupported operation', ...args);
    Error.captureStackTrace(this, UnsupportedOperationError);
  }
}
exports.UnsupportedOperationError = UnsupportedOperationError;

/**
 * @category Errors
 */
class AmbiguousTimeoutError extends TimeoutError {
  constructor(...args) {
    super(...args);
    Error.captureStackTrace(this, AmbiguousTimeoutError);
  }
}
exports.AmbiguousTimeoutError = AmbiguousTimeoutError;

/**
 * @category Errors
 */
class UnambiguousTimeoutError extends TimeoutError {
  constructor(...args) {
    super(...args);
    Error.captureStackTrace(this, UnambiguousTimeoutError);
  }
}
exports.UnambiguousTimeoutError = UnambiguousTimeoutError;

/**
 * @category Errors
 */
class FeatureNotAvailableError extends CouchbaseError {
  constructor(...args) {
    super('feature not available', ...args);
    Error.captureStackTrace(this, FeatureNotAvailableError);
  }
}
exports.FeatureNotAvailableError = FeatureNotAvailableError;

/**
 * @category Errors
 */
class ScopeNotFoundError extends CouchbaseError {
  constructor(baseerr) {
    super('scope not found', baseerr);
    Error.captureStackTrace(this, ScopeNotFoundError);
  }
}
exports.ScopeNotFoundError = ScopeNotFoundError;

/**
 * @category Errors
 */
class IndexNotFoundError extends CouchbaseError {
  constructor(...args) {
    super('index not found', ...args);
    Error.captureStackTrace(this, IndexNotFoundError);
  }
}
exports.IndexNotFoundError = IndexNotFoundError;

/**
 * @category Errors
 */
class IndexExistsError extends CouchbaseError {
  constructor(...args) {
    super('index exists', ...args);
    Error.captureStackTrace(this, IndexExistsError);
  }
}
exports.IndexExistsError = IndexExistsError;

/**
 * @category Errors
 */
class DocumentNotFoundError extends CouchbaseError {
  constructor(...args) {
    super('document not found', ...args);
    Error.captureStackTrace(this, DocumentNotFoundError);
  }
}
exports.DocumentNotFoundError = DocumentNotFoundError;

/**
 * @category Errors
 */
class DocumentUnretrievableError extends CouchbaseError {
  constructor(...args) {
    super('document unretrievable', ...args);
    Error.captureStackTrace(this, DocumentUnretrievableError);
  }
}
exports.DocumentUnretrievableError = DocumentUnretrievableError;

/**
 * @category Errors
 */
class DocumentLockedError extends CouchbaseError {
  constructor(...args) {
    super('document locked', ...args);
    Error.captureStackTrace(this, DocumentLockedError);
  }
}
exports.DocumentLockedError = DocumentLockedError;

/**
 * @category Errors
 */
class ValueTooLargeError extends CouchbaseError {
  constructor(...args) {
    super('value too large', ...args);
    Error.captureStackTrace(this, ValueTooLargeError);
  }
}
exports.ValueTooLargeError = ValueTooLargeError;

/**
 * @category Errors
 */
class DocumentExistsError extends CouchbaseError {
  constructor(...args) {
    super('document exists', ...args);
    Error.captureStackTrace(this, DocumentExistsError);
  }
}
exports.DocumentExistsError = DocumentExistsError;

/**
 * @category Errors
 */
class ValueNotJsonError extends CouchbaseError {
  constructor(...args) {
    super('value not json', ...args);
    Error.captureStackTrace(this, ValueNotJsonError);
  }
}
exports.ValueNotJsonError = ValueNotJsonError;

/**
 * @category Errors
 */
class DurabilityLevelNotAvailableError extends CouchbaseError {
  constructor(...args) {
    super('durability level not available', ...args);
    Error.captureStackTrace(this, DurabilityLevelNotAvailableError);
  }
}
exports.DurabilityLevelNotAvailableError = DurabilityLevelNotAvailableError;

/**
 * @category Errors
 */
class DurabilityImpossibleError extends CouchbaseError {
  constructor(...args) {
    super('durability impossible', ...args);
    Error.captureStackTrace(this, DurabilityImpossibleError);
  }
}
exports.DurabilityImpossibleError = DurabilityImpossibleError;

/**
 * @category Errors
 */
class DurabilityAmbiguousError extends CouchbaseError {
  constructor(...args) {
    super('durability ambiguous', ...args);
    Error.captureStackTrace(this, DurabilityAmbiguousError);
  }
}
exports.DurabilityAmbiguousError = DurabilityAmbiguousError;

/**
 * @category Errors
 */
class DurableWriteInProgressError extends CouchbaseError {
  constructor(...args) {
    super('durable write in progress', ...args);
    Error.captureStackTrace(this, DurableWriteInProgressError);
  }
}
exports.DurableWriteInProgressError = DurableWriteInProgressError;

/**
 * @category Errors
 */
class DurableWriteReCommitInProgressError extends CouchbaseError {
  constructor(...args) {
    super('durable write recommit in progress', ...args);
    Error.captureStackTrace(this, DurableWriteReCommitInProgressError);
  }
}
exports.DurableWriteReCommitInProgressError = DurableWriteReCommitInProgressError;

/**
 * @category Errors
 */
class MutationLostError extends CouchbaseError {
  constructor(...args) {
    super('mutation lost', ...args);
    Error.captureStackTrace(this, MutationLostError);
  }
}
exports.MutationLostError = MutationLostError;

/**
 * @category Errors
 */
class PathNotFoundError extends CouchbaseError {
  constructor(...args) {
    super('path not found', ...args);
    Error.captureStackTrace(this, PathNotFoundError);
  }
}
exports.PathNotFoundError = PathNotFoundError;

/**
 * @category Errors
 */
class PathMismatchError extends CouchbaseError {
  constructor(...args) {
    super('path mismatch', ...args);
    Error.captureStackTrace(this, PathMismatchError);
  }
}
exports.PathMismatchError = PathMismatchError;

/**
 * @category Errors
 */
class PathInvalidError extends CouchbaseError {
  constructor(...args) {
    super('path invalid', ...args);
    Error.captureStackTrace(this, PathInvalidError);
  }
}
exports.PathInvalidError = PathInvalidError;

/**
 * @category Errors
 */
class PathTooBigError extends CouchbaseError {
  constructor(...args) {
    super('path too big', ...args);
    Error.captureStackTrace(this, PathTooBigError);
  }
}
exports.PathTooBigError = PathTooBigError;

/**
 * @category Errors
 */
class PathTooDeepError extends CouchbaseError {
  constructor(...args) {
    super('path too deep', ...args);
    Error.captureStackTrace(this, PathTooDeepError);
  }
}
exports.PathTooDeepError = PathTooDeepError;

/**
 * @category Errors
 */
class ValueTooDeepError extends CouchbaseError {
  constructor(...args) {
    super('value too deep', ...args);
    Error.captureStackTrace(this, ValueTooDeepError);
  }
}
exports.ValueTooDeepError = ValueTooDeepError;

/**
 * @category Errors
 */
class ValueInvalidError extends CouchbaseError {
  constructor(...args) {
    super('value invalid', ...args);
    Error.captureStackTrace(this, ValueInvalidError);
  }
}
exports.ValueInvalidError = ValueInvalidError;

/**
 * @category Errors
 */
class DocumentNotJsonError extends CouchbaseError {
  constructor(...args) {
    super('document not json', ...args);
    Error.captureStackTrace(this, DocumentNotJsonError);
  }
}
exports.DocumentNotJsonError = DocumentNotJsonError;

/**
 * @category Errors
 */
class NumberTooBigError extends CouchbaseError {
  constructor(...args) {
    super('number too big', ...args);
    Error.captureStackTrace(this, NumberTooBigError);
  }
}
exports.NumberTooBigError = NumberTooBigError;

/**
 * @category Errors
 */
class DeltaInvalidError extends CouchbaseError {
  constructor(...args) {
    super('delta invalid', ...args);
    Error.captureStackTrace(this, DeltaInvalidError);
  }
}
exports.DeltaInvalidError = DeltaInvalidError;

/**
 * @category Errors
 */
class PathExistsError extends CouchbaseError {
  constructor(...args) {
    super('path exists', ...args);
    Error.captureStackTrace(this, PathExistsError);
  }
}
exports.PathExistsError = PathExistsError;

/**
 * @category Errors
 */
class PlanningFailureError extends CouchbaseError {
  constructor(...args) {
    super('planning failure', ...args);
    Error.captureStackTrace(this, PlanningFailureError);
  }
}
exports.PlanningFailureError = PlanningFailureError;

/**
 * @category Errors
 */
class IndexFailureError extends CouchbaseError {
  constructor(...args) {
    super('index failure', ...args);
    Error.captureStackTrace(this, IndexFailureError);
  }
}
exports.IndexFailureError = IndexFailureError;

/**
 * @category Errors
 */
class PreparedStatementFailureError extends CouchbaseError {
  constructor(...args) {
    super('prepared statement failure', ...args);
    Error.captureStackTrace(this, PreparedStatementFailureError);
  }
}
exports.PreparedStatementFailureError = PreparedStatementFailureError;

/**
 * @category Errors
 */
class CompilationFailureError extends CouchbaseError {
  constructor(...args) {
    super('compilation failure', ...args);
    Error.captureStackTrace(this, CompilationFailureError);
  }
}
exports.CompilationFailureError = CompilationFailureError;

/**
 * @category Errors
 */
class JobQueueFullError extends CouchbaseError {
  constructor(...args) {
    super('job queue full', ...args);
    Error.captureStackTrace(this, JobQueueFullError);
  }
}
exports.JobQueueFullError = JobQueueFullError;

/**
 * @category Errors
 */
class DatasetNotFoundError extends CouchbaseError {
  constructor(...args) {
    super('dataset not found', ...args);
    Error.captureStackTrace(this, DatasetNotFoundError);
  }
}
exports.DatasetNotFoundError = DatasetNotFoundError;

/**
 * @category Errors
 */
class DataverseNotFoundError extends CouchbaseError {
  constructor(...args) {
    super('dataverse not found', ...args);
    Error.captureStackTrace(this, DataverseNotFoundError);
  }
}
exports.DataverseNotFoundError = DataverseNotFoundError;

/**
 * @category Errors
 */
class DatasetExistsError extends CouchbaseError {
  constructor(...args) {
    super('dataset exists', ...args);
    Error.captureStackTrace(this, DatasetExistsError);
  }
}
exports.DatasetExistsError = DatasetExistsError;

/**
 * @category Errors
 */
class DataverseExistsError extends CouchbaseError {
  constructor(...args) {
    super('dataverse exists', ...args);
    Error.captureStackTrace(this, DataverseExistsError);
  }
}
exports.DataverseExistsError = DataverseExistsError;

/**
 * @category Errors
 */
class LinkNotFoundError extends CouchbaseError {
  constructor(...args) {
    super('link not found', ...args);
    Error.captureStackTrace(this, LinkNotFoundError);
  }
}
exports.LinkNotFoundError = LinkNotFoundError;

/**
 * @category Errors
 */
class ViewNotFoundError extends CouchbaseError {
  constructor(...args) {
    super('view not found', ...args);
    Error.captureStackTrace(this, ViewNotFoundError);
  }
}
exports.ViewNotFoundError = ViewNotFoundError;

/**
 * @category Errors
 */
class DesignDocumentNotFoundError extends CouchbaseError {
  constructor(...args) {
    super('design document not found', ...args);
    Error.captureStackTrace(this, DesignDocumentNotFoundError);
  }
}
exports.DesignDocumentNotFoundError = DesignDocumentNotFoundError;

/**
 * @category Errors
 */
class CollectionExistsError extends CouchbaseError {
  constructor(...args) {
    super('collection exists', ...args);
    Error.captureStackTrace(this, CollectionExistsError);
  }
}
exports.CollectionExistsError = CollectionExistsError;

/**
 * @category Errors
 */
class ScopeExistsError extends CouchbaseError {
  constructor(...args) {
    super('scope exists', ...args);
    Error.captureStackTrace(this, ScopeExistsError);
  }
}
exports.ScopeExistsError = ScopeExistsError;

/**
 * @category Errors
 */
class UserNotFoundError extends CouchbaseError {
  constructor(...args) {
    super('user not found', ...args);
    Error.captureStackTrace(this, UserNotFoundError);
  }
}
exports.UserNotFoundError = UserNotFoundError;

/**
 * @category Errors
 */
class GroupNotFoundError extends CouchbaseError {
  constructor(...args) {
    super('group not found', ...args);
    Error.captureStackTrace(this, GroupNotFoundError);
  }
}
exports.GroupNotFoundError = GroupNotFoundError;

/**
 * @category Errors
 */
class BucketExistsError extends CouchbaseError {
  constructor(...args) {
    super('bucket exists', ...args);
    Error.captureStackTrace(this, BucketExistsError);
  }
}
exports.BucketExistsError = BucketExistsError;

/**
 * @category Errors
 */
class UserExistsError extends CouchbaseError {
  constructor(...args) {
    super('user exists', ...args);
    Error.captureStackTrace(this, UserExistsError);
  }
}
exports.UserExistsError = UserExistsError;

/**
 * @category Errors
 */
class BucketNotFlushableError extends CouchbaseError {
  constructor(...args) {
    super('bucket not flushable', ...args);
    Error.captureStackTrace(this, BucketNotFlushableError);
  }
}
exports.BucketNotFlushableError = BucketNotFlushableError;

/**
 * @uncommitted
 * @category Errors
 */
class ErrorContext {}

/**
 * @uncommitted
 * @category Errors
 */
class KeyValueErrorContext extends ErrorContext {
  constructor() {
    super();

    this.status_code = 0;
    this.opaque = 0;
    this.cas = 0;
    this.key = '';
    this.bucket = '';
    this.collection = '';
    this.scope = '';
    this.context = '';
    this.ref = '';
  }
}
exports.KeyValueErrorContext = KeyValueErrorContext;

/**
 * @uncommitted
 * @category Errors
 */
class ViewErrorContext extends ErrorContext {
  constructor() {
    super();

    this.first_error_code = 0;
    this.first_error_message = '';
    this.design_document = '';
    this.view = '';
    this.parameters = null;
    this.http_response_code = 0;
    this.http_response_body = '';
  }
}
exports.ViewErrorContext = ViewErrorContext;

/**
 * @uncommitted
 * @category Errors
 */
class QueryErrorContext extends ErrorContext {
  constructor() {
    super();

    this.first_error_code = 0;
    this.first_error_message = '';
    this.statement = '';
    this.client_context_id = '';
    this.parameters = null;
    this.http_response_code = 0;
    this.http_response_body = '';
  }
}
exports.QueryErrorContext = QueryErrorContext;

/**
 * @uncommitted
 * @category Errors
 */
class SearchErrorContext extends ErrorContext {
  constructor() {
    super();

    this.error_message = '';
    this.index_name = '';
    this.query = null;
    this.parameters = null;
    this.http_response_code = 0;
    this.http_response_body = '';
  }
}
exports.SearchErrorContext = SearchErrorContext;

/**
 * @uncommitted
 * @category Errors
 */
class AnalyticsErrorContext extends ErrorContext {
  constructor() {
    super();

    this.first_error_code = 0;
    this.first_error_message = '';
    this.statement = '';
    this.client_context_id = '';
    this.http_response_code = 0;
    this.http_response_body = '';
  }
}
exports.AnalyticsErrorContext = AnalyticsErrorContext;

function _getWrappedErr(err, context) {
  switch (err.code) {
    case binding.LCB_SUCCESS:
      return null;

    /* Shared Error Definitions */
    case binding.LCB_ERR_TIMEOUT:
      return new TimeoutError(err, context);
    case binding.LCB_ERR_REQUEST_CANCELED:
      return new RequestCanceledError(err, context);
    case binding.LCB_ERR_INVALID_ARGUMENT:
      return new InvalidArgumentError(err, context);
    case binding.LCB_ERR_SERVICE_NOT_AVAILABLE:
      return new ServiceNotAvailableError(err, context);
    case binding.LCB_ERR_INTERNAL_SERVER_FAILURE:
      return new InternalServerFailureError(err, context);
    case binding.LCB_ERR_AUTHENTICATION_FAILURE:
      return new AuthenticationFailureError(err, context);
    case binding.LCB_ERR_TEMPORARY_FAILURE:
      return new TemporaryFailureError(err, context);
    case binding.LCB_ERR_PARSING_FAILURE:
      return new ParsingFailureError(err, context);
    case binding.LCB_ERR_CAS_MISMATCH:
      return new CasMismatchError(err, context);
    case binding.LCB_ERR_BUCKET_NOT_FOUND:
      return new BucketNotFoundError(err, context);
    case binding.LCB_ERR_COLLECTION_NOT_FOUND:
      return new CollectionNotFoundError(err, context);
    case binding.LCB_ERR_ENCODING_FAILURE:
      return new EncodingFailureError(err, context);
    case binding.LCB_ERR_DECODING_FAILURE:
      return new DecodingFailureError(err, context);
    case binding.LCB_ERR_UNSUPPORTED_OPERATION:
      return new UnsupportedOperationError(err, context);
    case binding.LCB_ERR_AMBIGUOUS_TIMEOUT:
      return new AmbiguousTimeoutError(err, context);
    case binding.LCB_ERR_UNAMBIGUOUS_TIMEOUT:
      return new UnambiguousTimeoutError(err, context);
    case binding.LCB_ERR_SCOPE_NOT_FOUND:
      return new ScopeNotFoundError(err, context);
    case binding.LCB_ERR_INDEX_NOT_FOUND:
      return new IndexNotFoundError(err, context);
    case binding.LCB_ERR_INDEX_EXISTS:
      return new IndexExistsError(err, context);

    /* KeyValue Error Definitions */
    case binding.LCB_ERR_DOCUMENT_NOT_FOUND:
      return new DocumentNotFoundError(err, context);
    case binding.LCB_ERR_DOCUMENT_UNRETRIEVABLE:
      return new DocumentUnretrievableError(err, context);
    case binding.LCB_ERR_DOCUMENT_LOCKED:
      return new DocumentLockedError(err, context);
    case binding.LCB_ERR_VALUE_TOO_LARGE:
      return new ValueTooLargeError(err, context);
    case binding.LCB_ERR_DOCUMENT_EXISTS:
      return new DocumentExistsError(err, context);
    case binding.LCB_ERR_VALUE_NOT_JSON:
      return new ValueNotJsonError(err, context);
    case binding.LCB_ERR_DURABILITY_LEVEL_NOT_AVAILABLE:
      return new DurabilityLevelNotAvailableError(err, context);
    case binding.LCB_ERR_DURABILITY_IMPOSSIBLE:
      return new DurabilityImpossibleError(err, context);
    case binding.LCB_ERR_DURABILITY_AMBIGUOUS:
      return new DurabilityAmbiguousError(err, context);
    case binding.LCB_ERR_DURABLE_WRITE_IN_PROGRESS:
      return new DurableWriteInProgressError(err, context);
    case binding.LCB_ERR_DURABLE_WRITE_RE_COMMIT_IN_PROGRESS:
      return new DurableWriteReCommitInProgressError(err, context);
    case binding.LCB_ERR_MUTATION_LOST:
      return new MutationLostError(err, context);
    case binding.LCB_ERR_SUBDOC_PATH_NOT_FOUND:
      return new PathNotFoundError(err, context);
    case binding.LCB_ERR_SUBDOC_PATH_MISMATCH:
      return new PathMismatchError(err, context);
    case binding.LCB_ERR_SUBDOC_PATH_INVALID:
      return new PathInvalidError(err, context);
    case binding.LCB_ERR_SUBDOC_PATH_TOO_BIG:
      return new PathTooBigError(err, context);
    case binding.LCB_ERR_SUBDOC_PATH_TOO_DEEP:
      return new PathTooDeepError(err, context);
    case binding.LCB_ERR_SUBDOC_VALUE_TOO_DEEP:
      return new ValueTooDeepError(err, context);
    case binding.LCB_ERR_SUBDOC_VALUE_INVALID:
      return new ValueInvalidError(err, context);
    case binding.LCB_ERR_SUBDOC_DOCUMENT_NOT_JSON:
      return new DocumentNotJsonError(err, context);
    case binding.LCB_ERR_SUBDOC_NUMBER_TOO_BIG:
      return new NumberTooBigError(err, context);
    case binding.LCB_ERR_SUBDOC_DELTA_INVALID:
      return new DeltaInvalidError(err, context);
    case binding.LCB_ERR_SUBDOC_PATH_EXISTS:
      return new PathExistsError(err, context);

    /* Query Error Definitions */
    case binding.LCB_ERR_PLANNING_FAILURE:
      return new PlanningFailureError(err, context);
    case binding.LCB_ERR_INDEX_FAILURE:
      return new IndexFailureError(err, context);
    case binding.LCB_ERR_PREPARED_STATEMENT_FAILURE:
      return new PreparedStatementFailureError(err, context);

    /* Analytics Error Definitions */
    case binding.LCB_ERR_COMPILATION_FAILED:
      return new CompilationFailureError(err, context);
    case binding.LCB_ERR_JOB_QUEUE_FULL:
      return new JobQueueFullError(err, context);
    case binding.LCB_ERR_DATASET_NOT_FOUND:
      return new DatasetNotFoundError(err, context);
    case binding.LCB_ERR_DATAVERSE_NOT_FOUND:
      return new DataverseNotFoundError(err, context);
    case binding.LCB_ERR_DATASET_EXISTS:
      return new DatasetExistsError(err, context);
    case binding.LCB_ERR_DATAVERSE_EXISTS:
      return new DataverseExistsError(err, context);
    case binding.LCB_ERR_ANALYTICS_LINK_NOT_FOUND:
      return new LinkNotFoundError(err, context);

    /* Search Error Definitions */
    // There are none

    /* View Error Definitions */
    case binding.LCB_ERR_VIEW_NOT_FOUND:
      return new ViewNotFoundError(err, context);
    case binding.LCB_ERR_DESIGN_DOCUMENT_NOT_FOUND:
      return new DesignDocumentNotFoundError(err, context);

    /* Management API Error Definitions */
    case binding.LCB_ERR_COLLECTION_ALREADY_EXISTS:
      return new CollectionExistsError(err, context);
    case binding.LCB_ERR_SCOPE_EXISTS:
      return new ScopeExistsError(err, context);
    case binding.LCB_ERR_USER_NOT_FOUND:
      return new UserNotFoundError(err, context);
    case binding.LCB_ERR_GROUP_NOT_FOUND:
      return new GroupNotFoundError(err, context);
    case binding.LCB_ERR_BUCKET_ALREADY_EXISTS:
      return new BucketExistsError(err, context);
  }
}

class LibcouchbaseError {
  constructor(code) {
    this.code = code;
  }
}

function wrapLcbErr(err) {
  if (!err) {
    return null;
  }

  var context = null;
  if (err.ctxtype === 'kv') {
    context = new KeyValueErrorContext();
    context.status_code = err.status_code;
    context.opaque = err.opaque;
    context.cas = err.cas;
    context.key = err.key;
    context.bucket = err.bucket;
    context.collection = err.collection;
    context.scope = err.scope;
    context.context = err.context;
    context.ref = err.ref;
  } else if (err.ctxtype === 'views') {
    context = new ViewErrorContext();
    context.first_error_code = err.first_error_code;
    context.first_error_message = err.first_error_message;
    context.design_document = err.design_document;
    context.view = err.view;
    context.parameters = err.parameters;
    context.http_response_code = err.http_response_code;
    context.http_response_body = err.http_response_body;
  } else if (err.ctxtype === 'query') {
    context = new QueryErrorContext();
    context.first_error_code = err.first_error_code;
    context.first_error_message = err.first_error_message;
    context.statement = err.statement;
    context.client_context_id = err.client_context_id;
    context.parameters = err.parameters;
    context.http_response_code = err.http_response_code;
    context.http_response_body = err.http_response_body;
  } else if (err.ctxtype === 'search') {
    context = new SearchErrorContext();
    context.error_message = err.error_message;
    context.index_name = err.index_name;
    context.query = err.query;
    context.parameters = err.parameters;
    context.http_response_code = err.http_response_code;
    context.http_response_body = err.http_response_body;
  } else if (err.ctxtype === 'analytics') {
    context = new AnalyticsErrorContext();
    context.first_error_code = err.first_error_code;
    context.first_error_message = err.first_error_message;
    context.statement = err.statement;
    context.client_context_id = err.client_context_id;
    context.parameters = err.parameters;
    context.http_response_code = err.http_response_code;
    context.http_response_body = err.http_response_body;
  }

  var wrappedErr = _getWrappedErr(err, context);
  if (wrappedErr) {
    // In order to avoid duplicating the information between our wrapped
    // error and the original libcouchbase base error, we also wrap the
    // base error with more information
    wrappedErr.cause = new LibcouchbaseError(err.code);

    return wrappedErr;
  }

  return err;
}
exports.wrapLcbErr = wrapLcbErr;
