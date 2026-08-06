import {
  CouchbaseExceptionEx as CouchbaseExceptionExPb,
  CouchbaseExceptionType as CouchbaseExceptionTypePb,
  Exception as ExceptionPb,
  ExceptionOther as ExceptionOtherPb,
} from "../proto/shared.exceptions_pb";

export class NotImplementedError extends Error {
  constructor(msg: string) {
    super(msg);
    Object.setPrototypeOf(this, NotImplementedError.prototype);
  }
  errorMsg() {
    return this.message + " is not implemented";
  }
}

export class SdkError {
  static toExceptionPb(err: any, outputError = false): ExceptionPb {
    if (outputError) {
      console.info("Converting SDK Exceptionto to ExceptionPb: ", err);
    }
    const serialized = JSON.stringify(err);
    const exception = new ExceptionPb();
    const exceptionType = SdkError.toExceptionTypePb(err.name);
    if (exceptionType) {
      const exceptionCb = new CouchbaseExceptionExPb();
      exceptionCb.setName(err.name);
      exceptionCb.setType(exceptionType);
      exceptionCb.setSerialized(serialized);
      exception.setCouchbase(exceptionCb);
      return exception;
    }
    const otherException = new ExceptionOtherPb();
    otherException.setName(err.name);
    otherException.setSerialized(serialized);
    exception.setOther(otherException);
    return exception;
  }

  static toExceptionTypePb(
    errName: string,
  ): CouchbaseExceptionTypePb | undefined {
    switch (errName) {
      case "CouchbaseError":
        return CouchbaseExceptionTypePb.SDK_COUCHBASE_EXCEPTION;
      case "TimeoutError":
        return CouchbaseExceptionTypePb.SDK_TIMEOUT_EXCEPTION;
      case "RequestCanceledError":
        return CouchbaseExceptionTypePb.SDK_REQUEST_CANCELLED_EXCEPTION;
      case "InvalidArgumentError":
        return CouchbaseExceptionTypePb.SDK_INVALID_ARGUMENT_EXCEPTION;
      case "ServiceNotAvailableError":
        return CouchbaseExceptionTypePb.SDK_SERVICE_NOT_AVAILABLE_EXCEPTION;
      case "InternalServerFailureError":
        return CouchbaseExceptionTypePb.SDK_INTERNAL_SERVER_FAILURE_EXCEPTION;
      case "AuthenticationFailureError":
        return CouchbaseExceptionTypePb.SDK_AUTHENTICATION_FAILURE_EXCEPTION;
      case "TemporaryFailureError":
        return CouchbaseExceptionTypePb.SDK_TEMPORARY_FAILURE_EXCEPTION;
      case "ParsingFailureError":
        return CouchbaseExceptionTypePb.SDK_PARSING_FAILURE_EXCEPTION;
      case "CasMismatchError":
        return CouchbaseExceptionTypePb.SDK_CAS_MISMATCH_EXCEPTION;
      case "BucketNotFoundError":
        return CouchbaseExceptionTypePb.SDK_BUCKET_NOT_FOUND_EXCEPTION;
      case "CollectionNotFoundError":
        return CouchbaseExceptionTypePb.SDK_COLLECTION_NOT_FOUND_EXCEPTION;
      case "UnsupportedOperationError":
        return CouchbaseExceptionTypePb.SDK_UNSUPPORTED_OPERATION_EXCEPTION;
      case "AmbiguousTimeoutError":
        return CouchbaseExceptionTypePb.SDK_AMBIGUOUS_TIMEOUT_EXCEPTION;
      case "UnambiguousTimeoutError":
        return CouchbaseExceptionTypePb.SDK_UNAMBIGUOUS_TIMEOUT_EXCEPTION;
      case "FeatureNotAvailableError":
        return CouchbaseExceptionTypePb.SDK_FEATURE_NOT_AVAILABLE_EXCEPTION;
      case "ScopeNotFoundError":
        return CouchbaseExceptionTypePb.SDK_SCOPE_NOT_FOUND_EXCEPTION;
      case "IndexNotFoundError":
        return CouchbaseExceptionTypePb.SDK_INDEX_NOT_FOUND_EXCEPTION;
      case "IndexExistsError":
        return CouchbaseExceptionTypePb.SDK_INDEX_EXISTS_EXCEPTION;
      case "EncodingFailureError":
        return CouchbaseExceptionTypePb.SDK_ENCODING_FAILURE_EXCEPTION;
      case "DecodingFailureError":
        return CouchbaseExceptionTypePb.SDK_DECODING_FAILURE_EXCEPTION;
      case "RateLimitedError":
        return CouchbaseExceptionTypePb.SDK_RATE_LIMITED_EXCEPTION;
      case "QuotaLimitedError":
        return CouchbaseExceptionTypePb.SDK_QUOTA_LIMITED_EXCEPTION;
      case "DocumentNotFoundError":
        return CouchbaseExceptionTypePb.SDK_DOCUMENT_NOT_FOUND_EXCEPTION;
      case "DocumentUnretrievableError":
        return CouchbaseExceptionTypePb.SDK_DOCUMENT_UNRETRIEVABLE_EXCEPTION;
      case "DocumentLockedError":
        return CouchbaseExceptionTypePb.SDK_DOCUMENT_LOCKED_EXCEPTION;
      case "DocumentNotLockedError":
        return CouchbaseExceptionTypePb.SDK_DOCUMENT_NOT_LOCKED_EXCEPTION;
      case "ValueTooLargeError":
        return CouchbaseExceptionTypePb.SDK_VALUE_TOO_LARGE_EXCEPTION;
      case "DocumentExistsError":
        return CouchbaseExceptionTypePb.SDK_DOCUMENT_EXISTS_EXCEPTION;
      case "DurabilityLevelNotAvailableError":
        return CouchbaseExceptionTypePb.SDK_DURABILITY_LEVEL_NOT_AVAILABLE_EXCEPTION;
      case "DurabilityImpossibleError":
        return CouchbaseExceptionTypePb.SDK_DURABILITY_IMPOSSIBLE_EXCEPTION;
      case "DurabilityAmbiguousError":
        return CouchbaseExceptionTypePb.SDK_DURABILITY_AMBIGUOUS_EXCEPTION;
      case "DurableWriteInProgressError":
        return CouchbaseExceptionTypePb.SDK_DURABLE_WRITE_IN_PROGRESS_EXCEPTION;
      case "DurableWriteReCommitInProgressError":
        return CouchbaseExceptionTypePb.SDK_DURABLE_WRITE_RECOMMIT_IN_PROGRESS_EXCEPTION;
      case "PathNotFoundError":
        return CouchbaseExceptionTypePb.SDK_PATH_NOT_FOUND_EXCEPTION;
      case "PathMismatchError":
        return CouchbaseExceptionTypePb.SDK_PATH_MISMATCH_EXCEPTION;
      case "PathInvalidError":
        return CouchbaseExceptionTypePb.SDK_PATH_INVALID_EXCEPTION;
      case "PathTooBigError":
        return CouchbaseExceptionTypePb.SDK_PATH_TOO_BIG_EXCEPTION;
      case "PathTooDeepError":
        return CouchbaseExceptionTypePb.SDK_PATH_TOO_DEEP_EXCEPTION;
      case "ValueTooDeepError":
        return CouchbaseExceptionTypePb.SDK_VALUE_TOO_DEEP_EXCEPTION;
      case "ValueInvalidError":
        return CouchbaseExceptionTypePb.SDK_VALUE_INVALID_EXCEPTION;
      case "DocumentNotJsonError":
        return CouchbaseExceptionTypePb.SDK_DOCUMENT_NOT_JSON_EXCEPTION;
      case "NumberTooBigError":
        return CouchbaseExceptionTypePb.SDK_NUMBER_TOO_BIG_EXCEPTION;
      case "DeltaInvalidError":
        return CouchbaseExceptionTypePb.SDK_DELTA_INVALID_EXCEPTION;
      case "PathExistsError":
        return CouchbaseExceptionTypePb.SDK_PATH_EXISTS_EXCEPTION;
      //These are converted to generic CB Errors in the Node SDK:
      // case XattrUnknownMacroError
      // case XattrInvalidKeyComboError
      // case XattrUnknownVirtualAttributeError
      // case XattrCannotModifyVirtualAttributeError
      // case XattrNoAccessError
      case "PlanningFailureError":
        return CouchbaseExceptionTypePb.SDK_PLANNING_FAILURE_EXCEPTION;
      case "IndexFailureError":
        return CouchbaseExceptionTypePb.SDK_INDEX_FAILURE_EXCEPTION;
      case "PreparedStatementFailureError":
        return CouchbaseExceptionTypePb.SDK_PREPARED_STATEMENT_FAILURE_EXCEPTION;
      case "DmlFailureError":
        return CouchbaseExceptionTypePb.SDK_DML_FAILURE_EXCEPTION;
      case "CompilationFailureError":
        return CouchbaseExceptionTypePb.SDK_COMPILATION_FAILURE_EXCEPTION;
      case "JobQueueFullError":
        return CouchbaseExceptionTypePb.SDK_JOB_QUEUE_FULL_EXCEPTION;
      case "DatasetNotFoundError":
        return CouchbaseExceptionTypePb.SDK_DATASET_NOT_FOUND_EXCEPTION;
      case "DataverseNotFoundError":
        return CouchbaseExceptionTypePb.SDK_DATAVERSE_NOT_FOUND_EXCEPTION;
      case "DatasetExistsError":
        return CouchbaseExceptionTypePb.SDK_DATASET_EXISTS_EXCEPTION;
      case "DataverseExistsError":
        return CouchbaseExceptionTypePb.SDK_DATAVERSE_EXISTS_EXCEPTION;
      case "LinkNotFoundError":
        return CouchbaseExceptionTypePb.SDK_LINK_NOT_FOUND_EXCEPTION;
      case "ViewNotFoundError":
        return CouchbaseExceptionTypePb.SDK_VIEW_NOT_FOUND_EXCEPTION;
      case "DesignDocumentNotFoundError":
        return CouchbaseExceptionTypePb.SDK_DESIGN_DOCUMENT_NOT_FOUND_EXCEPTION;
      case "CollectionExistsError":
        return CouchbaseExceptionTypePb.SDK_COLLECTION_EXISTS_EXCEPTION;
      case "ScopeExistsError":
        return CouchbaseExceptionTypePb.SDK_SCOPE_EXISTS_EXCEPTION;
      case "UserNotFoundError":
        return CouchbaseExceptionTypePb.SDK_USER_NOT_FOUND_EXCEPTION;
      case "GroupNotFoundError":
        return CouchbaseExceptionTypePb.SDK_GROUP_NOT_FOUND_EXCEPTION;
      case "BucketExistsError":
        return CouchbaseExceptionTypePb.SDK_BUCKET_EXISTS_EXCEPTION;
      case "UserExistsError":
        return CouchbaseExceptionTypePb.SDK_USER_EXISTS_EXCEPTION;
      case "BucketNotFlushableError":
        return CouchbaseExceptionTypePb.SDK_BUCKET_NOT_FLUSHABLE_EXCEPTION;
      default:
        return undefined;
    }
  }
}
