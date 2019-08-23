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
  constructor(errtext, baseerr, ...args) {
    super(errtext, ...args)
    this.base = baseerr;
    Error.captureStackTrace(this, CouchbaseError)
  }
}
exports.CouchbaseError = CouchbaseError;

/**
 * @category Errors
 */
class DurabilityError extends CouchbaseError {
  constructor(...args) {
    super(...args)
    Error.captureStackTrace(this, DurabilityError)
  }
}
exports.DurabilityError = DurabilityError;

/**
 * @category Errors
 */
class KeyValueError extends CouchbaseError {
  constructor(...args) {
    super(...args)
    Error.captureStackTrace(this, KeyValueError)
  }
}
exports.KeyValueError = KeyValueError;

/**
 * @category Errors
 */
class QueryError extends CouchbaseError {
  constructor(...args) {
    super(...args)
    Error.captureStackTrace(this, QueryError)
  }
}
exports.QueryError = QueryError;

/**
 * @category Errors
 */
class SearchError extends CouchbaseError {
  constructor(...args) {
    super(...args)
    Error.captureStackTrace(this, SearchError)
  }
}
exports.SearchError = SearchError;

/**
 * @category Errors
 */
class AnalyticsError extends CouchbaseError {
  constructor(...args) {
    super(...args)
    Error.captureStackTrace(this, AnalyticsError)
  }
}
exports.AnalyticsError = AnalyticsError;

/**
 * @category Errors
 */
class ViewError extends CouchbaseError {
  constructor(...args) {
    super(...args)
    Error.captureStackTrace(this, ViewError)
  }
}
exports.ViewError = ViewError;

/**
 * @category Errors
 */
class InvalidConfigurationError extends CouchbaseError {
  constructor(...args) {
    super(...args)
    Error.captureStackTrace(this, InvalidConfigurationError)
  }
}
exports.InvalidConfigurationError = InvalidConfigurationError;

/**
 * @category Errors
 */
class ServiceMissingError extends CouchbaseError {
  constructor(...args) {
    super(...args)
    Error.captureStackTrace(this, ServiceMissingError)
  }
}
exports.ServiceMissingError = ServiceMissingError;

/**
 * @category Errors
 */
class TimeoutError extends CouchbaseError {
  constructor(...args) {
    super(...args)
    Error.captureStackTrace(this, TimeoutError)
  }
}
exports.TimeoutError = TimeoutError;

/**
 * @category Errors
 */
class NetworkError extends CouchbaseError {
  constructor(...args) {
    super(...args)
    Error.captureStackTrace(this, NetworkError)
  }
}
exports.NetworkError = NetworkError;

/**
 * @category Errors
 */
class AuthenticationError extends CouchbaseError {
  constructor(...args) {
    super(...args)
    Error.captureStackTrace(this, AuthenticationError)
  }
}
exports.AuthenticationError = AuthenticationError;

/**
 * @category Errors
 */
class DiagnosticsError extends CouchbaseError {
  constructor(...args) {
    super(...args)
    Error.captureStackTrace(this, DiagnosticsError)
  }
}
exports.DiagnosticsError = DiagnosticsError;

/**
 * @category Errors
 */
class BucketAlreadyExistsError extends CouchbaseError {
  constructor(...args) {
    super('bucket already exists', ...args)
    Error.captureStackTrace(this, BucketAlreadyExistsError)
  }
}
exports.BucketAlreadyExistsError = BucketAlreadyExistsError;

/**
 * @category Errors
 */
class BucketNotFoundError extends CouchbaseError {
  constructor(...args) {
    super('bucket not found', ...args)
    Error.captureStackTrace(this, BucketNotFoundError)
  }
}
exports.BucketNotFoundError = BucketNotFoundError;

/**
 * @category Errors
 */
class ScopeAlreadyExistsError extends CouchbaseError {
  constructor(baseerr) {
    super('scope already exists', baseerr)
    Error.captureStackTrace(this, ScopeAlreadyExistsError)
  }
}
exports.ScopeAlreadyExistsError = ScopeAlreadyExistsError;

/**
 * @category Errors
 */
class ScopeNotFoundError extends CouchbaseError {
  constructor(baseerr) {
    super('scope not found', baseerr)
    Error.captureStackTrace(this, ScopeNotFoundError)
  }
}
exports.ScopeNotFoundError = ScopeNotFoundError;

/**
 * @category Errors
 */
class CollectionAlreadyExistsError extends CouchbaseError {
  constructor(...args) {
    super('collection already exists', ...args)
    Error.captureStackTrace(this, CollectionAlreadyExistsError)
  }
}
exports.CollectionAlreadyExistsError = CollectionAlreadyExistsError;

/**
 * @category Errors
 */
class CollectionNotFoundError extends CouchbaseError {
  constructor(...args) {
    super('collection not found', ...args)
    Error.captureStackTrace(this, CollectionNotFoundError)
  }
}
exports.CollectionNotFoundError = CollectionNotFoundError;

/**
 * @category Errors
 */
class SearchIndexAlreadyExistsError extends CouchbaseError {
  constructor(...args) {
    super('search index already exists', ...args)
    Error.captureStackTrace(this, SearchIndexAlreadyExistsError)
  }
}
exports.SearchIndexAlreadyExistsError = SearchIndexAlreadyExistsError;

/**
 * @category Errors
 */
class SearchIndexNotFoundError extends CouchbaseError {
  constructor(...args) {
    super('search index not found', ...args)
    Error.captureStackTrace(this, SearchIndexNotFoundError)
  }
}
exports.SearchIndexNotFoundError = SearchIndexNotFoundError;

/**
 * @category Errors
 */
class DataverseAlreadyExistsError extends CouchbaseError {
  constructor(...args) {
    super('dataverse already exists', ...args)
    Error.captureStackTrace(this, DataverseAlreadyExistsError)
  }
}
exports.DataverseAlreadyExistsError = DataverseAlreadyExistsError;

/**
 * @category Errors
 */
class DataverseNotFoundError extends CouchbaseError {
  constructor(...args) {
    super('dataverse not found', ...args)
    Error.captureStackTrace(this, DataverseNotFoundError)
  }
}
exports.DataverseNotFoundError = DataverseNotFoundError;

/**
 * @category Errors
 */
class DatasetAlreadyExistsError extends CouchbaseError {
  constructor(...args) {
    super('dataset already exists', ...args)
    Error.captureStackTrace(this, DatasetAlreadyExistsError)
  }
}
exports.DatasetAlreadyExistsError = DatasetAlreadyExistsError;

/**
 * @category Errors
 */
class DatasetNotFoundError extends CouchbaseError {
  constructor(...args) {
    super('dataset not found', ...args)
    Error.captureStackTrace(this, DatasetNotFoundError)
  }
}
exports.DatasetNotFoundError = DatasetNotFoundError;

/**
 * @category Errors
 */
class DesignDocumentNotFoundError extends CouchbaseError {
  constructor(...args) {
    super('design document not found', ...args)
    Error.captureStackTrace(this, DesignDocumentNotFoundError)
  }
}
exports.DesignDocumentNotFoundError = DesignDocumentNotFoundError;
