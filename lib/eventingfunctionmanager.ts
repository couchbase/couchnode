import { Cluster } from './cluster'
import { QueryScanConsistency } from './querytypes'
import { NodeCallback, PromiseHelper } from './utilities'
import {
  errorFromCpp,
  eventingBucketBindingAccessFromCpp,
  eventingBucketBindingAccessToCpp,
  eventingFunctionDcpBoundaryToCpp,
  eventingFunctionDeploymentStatusFromCpp,
  eventingFunctionDeploymentStatusToCpp,
  eventingFunctionLanguageCompatibilityToCpp,
  eventingFunctionLogLevelFromCpp,
  eventingFunctionLogLevelToCpp,
  eventingFunctionProcessingStatusFromCpp,
  eventingFunctionProcessingStatusToCpp,
  queryScanConsistencyToCpp,
  queryScanConsistencyFromCpp,
  eventingFunctionLanguageCompatibilityFromCpp,
  eventingFunctionDcpBoundaryFromCpp,
  eventingFunctionStatusFromCpp,
} from './bindingutilities'
import {
  CppManagementEventingFunction,
  CppManagementEventingFunctionBucketBinding,
  CppManagementEventingFunctionConstantBinding,
  CppManagementEventingFunctionSettings,
  CppManagementEventingFunctionUrlBinding,
  CppManagementEventingStatus,
  CppManagementEventingFunctionState,
  CppManagementEventingFunctionUrlAuthBasic,
  CppManagementEventingFunctionUrlAuthDigest,
  CppManagementEventingFunctionUrlAuthBearer,
} from './binding'
import * as errs from './errors'

/**
 * Represents the various dcp boundary options for eventing functions.
 *
 * @category Management
 */
export enum EventingFunctionDcpBoundary {
  /**
   * Indicates all documents should be processed by the function.
   */
  Everything = 'everything',

  /**
   * Indicates that only documents modified after a function is created
   * should be processed by the function.
   */
  FromNow = 'from_now',
}

/**
 * Represents the various possible deployment statuses for an eventing function.
 *
 * @category Management
 */
export enum EventingFunctionDeploymentStatus {
  /**
   * Indicates that the function is deployed.
   */
  Deployed = 'deployed',

  /**
   * Indicates that the function has not yet been deployed.
   */
  Undeployed = 'undeployed',
}

/**
 * Represents the various possible processing statuses for an eventing function.
 *
 * @category Management
 */
export enum EventingFunctionProcessingStatus {
  /**
   * Indicates that the eventing function is currently running.
   */
  Running = 'running',

  /**
   * Indicates that the eventing function is currently paused.
   */
  Paused = 'paused',
}

/**
 * Represents the authentication method to use for a URL binding.
 *
 * @category Management
 */
export enum EventingFunctionStatus {
  /**
   * Indicates that the eventing function is undeployed.
   */
  Undeployed = 'undeployed',

  /**
   * Indicates that the eventing function is deploying.
   */
  Deploying = 'deploying',

  /**
   * Indicates that the eventing function is deployed.
   */
  Deployed = 'deployed',

  /**
   * Indicates that the eventing function is undeploying.
   */
  Undeploying = 'undeploying',

  /**
   * Indicates that the eventing function is paused.
   */
  Paused = 'paused',

  /**
   * Indicates that the eventing function is pausing.
   */
  Pausing = 'pausing',
}

/**
 * Represents the language compatibility levels of an eventing function.
 *
 * @category Management
 */
export enum EventingFunctionLanguageCompatibility {
  /**
   * Indicates that the function should run with compatibility with
   * Couchbase Server 6.0.0.
   */
  Version_6_0_0 = '6.0.0',

  /**
   * Indicates that the function should run with compatibility with
   * Couchbase Server 6.5.0.
   */
  Version_6_5_0 = '6.5.0',

  /**
   * Indicates that the function should run with compatibility with
   * Couchbase Server 6.6.2.
   */
  Version_6_6_2 = '6.6.2',

  /**
   * Indicates that the function should run with compatibility with
   * Couchbase Server 7.2.0.
   */
  Version_7_2_0 = '7.2.0',
}

/**
 * Represents the various log levels for an eventing function.
 *
 * @category Management
 */
export enum EventingFunctionLogLevel {
  /**
   * Indicates to use INFO level logging.
   */
  Info = 'INFO',

  /**
   * Indicates to use ERROR level logging.
   */
  Error = 'ERROR',

  /**
   * Indicates to use WARNING level logging.
   */
  Warning = 'WARNING',

  /**
   * Indicates to use DEBUG level logging.
   */
  Debug = 'DEBUG',

  /**
   * Indicates to use TRACE level logging.
   */
  Trace = 'TRACE',
}

/**
 * Represents the various bucket access levels for an eventing function.
 *
 * @category Management
 */
export enum EventingFunctionBucketAccess {
  /**
   * Indicates that the function can only read the associated bucket.
   */
  ReadOnly = 'r',

  /**
   * Indicates that the function can both read and write the associated bucket.
   */
  ReadWrite = 'rw',
}

/**
 * Represents the authentication method to use for a URL binding.
 *
 * @category Management
 */
export enum EventingFunctionUrlAuthMethod {
  /**
   * Indicates that no authentication should be used.
   */
  None = 'no-auth',

  /**
   * Indicates that Basic should be used.
   */
  Basic = 'basic',

  /**
   * Indicates that Digest should be used.
   */
  Digest = 'digest',

  /**
   * Indicates that Bearer should be used.
   */
  Bearer = 'bearer',
}

/**
 * Specifies the bucket/scope/collection used by an eventing function.
 *
 * @category Management
 */
export class EventingFunctionKeyspace {
  constructor(v: EventingFunctionKeyspace) {
    this.bucket = v.bucket
    this.scope = v.scope
    this.collection = v.collection
  }

  /**
   * The bucket to use.
   */
  bucket: string

  /**
   * The scope to use.
   */
  scope?: string

  /**
   * The collection to use.
   */
  collection?: string
}

/**
 * Specifies a bucket binding for an eventing function.
 *
 * @category Management
 */
export class EventingFunctionBucketBinding {
  constructor(v: EventingFunctionBucketBinding) {
    this.alias = v.alias
    this.name = v.name
    this.access = v.access
  }

  /**
   * The alias to use for referring to this binding.
   */
  alias: string

  /**
   * The keyspace that this binding refers to.
   */
  name: EventingFunctionKeyspace

  /**
   * The level of access configured for this binding.
   */
  access: EventingFunctionBucketAccess

  /**
   * @internal
   */
  static _fromCppData(
    data: CppManagementEventingFunctionBucketBinding
  ): EventingFunctionBucketBinding {
    return new EventingFunctionBucketBinding({
      alias: data.alias,
      name: new EventingFunctionKeyspace({
        bucket: data.name.bucket,
        scope: data.name.scope,
        collection: data.name.collection,
      }),
      access: eventingBucketBindingAccessFromCpp(data.access),
    })
  }

  /**
   * @internal
   */
  static _toCppData(
    data: EventingFunctionBucketBinding
  ): CppManagementEventingFunctionBucketBinding {
    return {
      alias: data.alias,
      name: {
        bucket: data.name.bucket,
        scope: data.name.scope,
        collection: data.name.collection,
      },
      access: eventingBucketBindingAccessToCpp(data.access),
    }
  }
}

/**
 * Specifies a type of url authentication to use.
 *
 * @category Management
 */
export interface EventingFunctionUrlAuth {
  /**
   * The method of authentication to use.
   */
  method: EventingFunctionUrlAuthMethod
}

/**
 * Specifies that Basic authentication should be used for the URL.
 *
 * @category Management
 */
export class EventingFunctionUrlAuthBasic implements EventingFunctionUrlAuth {
  /**
   * Sets the auth method to Basic.
   */
  method = EventingFunctionUrlAuthMethod.Basic

  constructor(v: Omit<EventingFunctionUrlAuthBasic, 'method'>) {
    this.username = v.username
    this.password = v.password
  }

  /**
   * Specifies the username to use for authentication.
   */
  username: string

  /**
   * Specifies the password to use for authentication.
   */
  password: string
}

/**
 * Specifies that Digest authentication should be used for the URL.
 *
 * @category Management
 */
export class EventingFunctionUrlAuthDigest implements EventingFunctionUrlAuth {
  /**
   * Sets the auth method to Digest.
   */
  method = EventingFunctionUrlAuthMethod.Digest

  constructor(v: Omit<EventingFunctionUrlAuthDigest, 'method'>) {
    this.username = v.username
    this.password = v.password
  }

  /**
   * Specifies the username to use for authentication.
   */
  username: string

  /**
   * Specifies the password to use for authentication.
   */
  password: string
}

/**
 * Specifies that Bearer authentication should be used for the URL.
 *
 * @category Management
 */
export class EventingFunctionUrlAuthBearer implements EventingFunctionUrlAuth {
  /**
   * Sets the auth method to Bearer.
   */
  method = EventingFunctionUrlAuthMethod.Bearer

  constructor(v: Omit<EventingFunctionUrlAuthBearer, 'method'>) {
    this.key = v.key
  }

  /**
   * Specifies the bearer token to use.
   */
  key: string
}

/**
 * Specifies a url binding for an eventing function.
 *
 * @category Management
 */
export class EventingFunctionUrlBinding {
  constructor(v: EventingFunctionUrlBinding) {
    this.hostname = v.hostname
    this.alias = v.alias
    this.auth = v.auth
    this.allowCookies = v.allowCookies
    this.validateSslCertificate = v.validateSslCertificate
  }

  /**
   * The alias to use for referring to this binding.
   */
  alias: string

  /**
   * The hostname this url binding should refer to.
   */
  hostname: string

  /**
   * The authentication that should be used.
   */
  auth?: EventingFunctionUrlAuth

  /**
   * Whether or not cookies should be allowed.
   */
  allowCookies: boolean

  /**
   * Whether the SSL certificate should be validated.
   */
  validateSslCertificate: boolean

  /**
   * @internal
   */
  static _fromCppData(
    data: CppManagementEventingFunctionUrlBinding
  ): EventingFunctionUrlBinding {
    let authObj

    if (data.auth_name === 'function_url_no_auth') {
      authObj = undefined
    } else if (data.auth_name === 'function_url_auth_basic') {
      authObj = new EventingFunctionUrlAuthBasic({
        username: (data.auth_value as CppManagementEventingFunctionUrlAuthBasic)
          .username,
        password: (data.auth_value as CppManagementEventingFunctionUrlAuthBasic)
          .password,
      })
    } else if (data.auth_name === 'function_url_auth_digest') {
      authObj = new EventingFunctionUrlAuthDigest({
        username: (
          data.auth_value as CppManagementEventingFunctionUrlAuthDigest
        ).username,
        password: (
          data.auth_value as CppManagementEventingFunctionUrlAuthDigest
        ).password,
      })
    } else if (data.auth_name === 'function_url_auth_bearer') {
      authObj = new EventingFunctionUrlAuthBearer({
        key: (data.auth_value as CppManagementEventingFunctionUrlAuthBearer)
          .key,
      })
    } else {
      throw new errs.InvalidArgumentError(
        new Error('Unrecognized EventingFunctionUrlBinding: ' + data.auth_name)
      )
    }

    return {
      hostname: data.hostname,
      alias: data.alias,
      allowCookies: data.allow_cookies,
      validateSslCertificate: data.validate_ssl_certificate,
      auth: authObj,
    }
  }

  /**
   * @internal
   */
  static _toCppData(
    data: EventingFunctionUrlBinding
  ): CppManagementEventingFunctionUrlBinding {
    let authObj
    let auth_name

    if (!data.auth || data.auth.method === EventingFunctionUrlAuthMethod.None) {
      authObj = {}
      auth_name = 'function_url_no_auth'
    } else if (data.auth.method === EventingFunctionUrlAuthMethod.Basic) {
      authObj = {
        username: (data.auth as EventingFunctionUrlAuthBasic).username,
        password: (data.auth as EventingFunctionUrlAuthBasic).password,
      } as CppManagementEventingFunctionUrlAuthBasic
      auth_name = 'function_url_auth_basic'
    } else if (data.auth.method === EventingFunctionUrlAuthMethod.Digest) {
      authObj = {
        username: (data.auth as EventingFunctionUrlAuthDigest).username,
        password: (data.auth as EventingFunctionUrlAuthDigest).password,
      } as CppManagementEventingFunctionUrlAuthDigest
      auth_name = 'function_url_auth_digest'
    } else if (data.auth.method === EventingFunctionUrlAuthMethod.Bearer) {
      authObj = {
        key: (data.auth as EventingFunctionUrlAuthBearer).key,
      } as CppManagementEventingFunctionUrlAuthBearer
      auth_name = 'function_url_auth_bearer'
    } else {
      throw new errs.InvalidArgumentError(
        new Error('Unrecognized EventingFunctionUrlBinding')
      )
    }

    return {
      alias: data.alias,
      hostname: data.hostname,
      allow_cookies: data.allowCookies,
      validate_ssl_certificate: data.validateSslCertificate,
      auth_name: auth_name,
      auth_value: authObj,
    }
  }
}

/**
 * Specifies a constant binding for an eventing function.
 *
 * @category Management
 */
export class EventingFunctionConstantBinding {
  constructor(v: EventingFunctionConstantBinding) {
    this.alias = v.alias
    this.literal = v.literal
  }

  /**
   * The alias to use for referring to this binding.
   */
  alias: string

  /**
   * The literal value for this binding.
   */
  literal: string

  /**
   * @internal
   */
  static _fromCppData(
    data: CppManagementEventingFunctionConstantBinding
  ): EventingFunctionConstantBinding {
    return new EventingFunctionConstantBinding({
      alias: data.alias,
      literal: data.literal,
    })
  }

  /**
   * @internal
   */
  static _toCppData(
    data: EventingFunctionConstantBinding
  ): CppManagementEventingFunctionConstantBinding {
    return {
      alias: data.alias,
      literal: data.literal,
    }
  }
}

/**
 * Specifies a number of options which can be used when updating or creating
 * a eventing function.
 *
 * @category Management
 */
export class EventingFunctionSettings {
  constructor(v: EventingFunctionSettings) {
    this.cppWorkerThreadCount = v.cppWorkerThreadCount
    this.dcpStreamBoundary = v.dcpStreamBoundary
    this.description = v.description
    this.deploymentStatus = v.deploymentStatus
    this.processingStatus = v.processingStatus
    this.languageCompatibility = v.languageCompatibility
    this.logLevel = v.logLevel
    this.executionTimeout = v.executionTimeout
    this.lcbInstCapacity = v.lcbInstCapacity
    this.lcbRetryCount = v.lcbRetryCount
    this.lcbTimeout = v.lcbTimeout
    this.queryConsistency = v.queryConsistency
    this.numTimerPartitions = v.numTimerPartitions
    this.sockBatchSize = v.sockBatchSize
    this.tickDuration = v.tickDuration
    this.timerContextSize = v.timerContextSize
    this.userPrefix = v.userPrefix
    this.bucketCacheSize = v.bucketCacheSize
    this.bucketCacheAge = v.bucketCacheAge
    this.curlMaxAllowedRespSize = v.curlMaxAllowedRespSize
    this.queryPrepareAll = v.queryPrepareAll
    this.workerCount = v.workerCount
    this.handlerHeaders = v.handlerHeaders
    this.handlerFooters = v.handlerFooters
    this.enableAppLogRotation = v.enableAppLogRotation
    this.appLogDir = v.appLogDir
    this.appLogMaxSize = v.appLogMaxSize
    this.appLogMaxFiles = v.appLogMaxFiles
    this.checkpointInterval = v.checkpointInterval
  }

  /**
   * The number of worker threads to use for the function.
   */
  cppWorkerThreadCount?: number

  /**
   * The DCP stream boundary to use.
   */
  dcpStreamBoundary?: EventingFunctionDcpBoundary

  /**
   * A description of this eventing function.
   */
  description?: string

  /**
   * The current deployment status of the function.
   */
  deploymentStatus?: EventingFunctionDeploymentStatus

  /**
   * The current processing status of the function.
   */
  processingStatus?: EventingFunctionProcessingStatus

  /**
   * The active compatibility mode for the function.
   */
  languageCompatibility?: EventingFunctionLanguageCompatibility

  /**
   * The level of logging that should be captured for the function.
   */
  logLevel?: EventingFunctionLogLevel

  /**
   * The maximum period of time the function can execute on a document
   * before timing out.
   */
  executionTimeout?: number

  /**
   * The maximum number of internal clients that the function should
   * maintain for KV operations.
   */
  lcbInstCapacity?: number

  /**
   * The maximum number of times to retry a KV operation before failing
   * the function.
   */
  lcbRetryCount?: number

  /**
   * The maximum period of time a KV operation within the function can
   * operate before timing out.
   */
  lcbTimeout?: number

  /**
   * The level of consistency to use when performing queries in the function.
   */
  queryConsistency?: QueryScanConsistency

  /**
   * The number of partitions that should be used for timer tracking.
   */
  numTimerPartitions?: number

  /**
   * The batch size for messages from producer to consumer.
   */
  sockBatchSize?: number

  /**
   * The duration to log stats from this handler, in milliseconds.
   */
  tickDuration?: number

  /**
   * The size limit of timer context object.
   */
  timerContextSize?: number

  /**
   * The key prefix for all data stored in metadata by this handler.
   */
  userPrefix?: string

  /**
   * The maximum size in bytes the bucket cache can grow to.
   */
  bucketCacheSize?: number

  /**
   * The time in milliseconds after which a cached bucket object is considered stale.
   */
  bucketCacheAge?: number

  /**
   * The maximum allowable curl call response in 'MegaBytes'. Setting the value to 0
   * lifts the upper limit off. This parameters affects v8 engine stability since it
   * defines the maximum amount of heap space acquired by a curl call.
   */
  curlMaxAllowedRespSize?: number

  /**
   * Whether to automatically prepare all query statements in the handler.
   */
  queryPrepareAll?: boolean

  /**
   * The number of worker processes handler utilizes on each eventing node.
   */
  workerCount?: number

  /**
   * The code to automatically prepend to top of handler code.
   */
  handlerHeaders?: string[]

  /**
   * The code to automatically append to bottom of handler code.
   */
  handlerFooters?: string[]

  /**
   * Whether to enable rotating this handlers log() message files.
   */
  enableAppLogRotation?: boolean

  /**
   * The directory to write content of log() message files.
   */
  appLogDir?: string

  /**
   * The size in bytes of the log file when the file should be rotated.
   */
  appLogMaxSize?: number

  /**
   * The number of log() message files to retain when rotating.
   */
  appLogMaxFiles?: number

  /**
   * The number of seconds before writing a progress checkpoint.
   */
  checkpointInterval?: number

  /**
   * @internal
   */
  static _fromCppData(
    data: CppManagementEventingFunctionSettings
  ): EventingFunctionSettings {
    return new EventingFunctionSettings({
      cppWorkerThreadCount: data.cpp_worker_count,
      dcpStreamBoundary: eventingFunctionDcpBoundaryFromCpp(
        data.dcp_stream_boundary
      ),
      description: data.description,
      deploymentStatus: eventingFunctionDeploymentStatusFromCpp(
        data.deployment_status
      ),
      processingStatus: eventingFunctionProcessingStatusFromCpp(
        data.processing_status
      ),
      logLevel: eventingFunctionLogLevelFromCpp(data.log_level),
      languageCompatibility: eventingFunctionLanguageCompatibilityFromCpp(
        data.language_compatibility
      ),
      executionTimeout: data.execution_timeout,
      lcbInstCapacity: data.lcb_inst_capacity,
      lcbRetryCount: data.lcb_retry_count,
      lcbTimeout: data.lcb_timeout,
      queryConsistency: queryScanConsistencyFromCpp(data.query_consistency),
      numTimerPartitions: data.num_timer_partitions,
      sockBatchSize: data.sock_batch_size,
      tickDuration: data.tick_duration,
      timerContextSize: data.timer_context_size,
      userPrefix: data.user_prefix,
      bucketCacheSize: data.bucket_cache_size,
      bucketCacheAge: data.bucket_cache_age,
      curlMaxAllowedRespSize: data.curl_max_allowed_resp_size,
      queryPrepareAll: data.query_prepare_all,
      workerCount: data.worker_count,
      handlerHeaders: data.handler_headers,
      handlerFooters: data.handler_footers,
      enableAppLogRotation: data.enable_app_log_rotation,
      appLogDir: data.app_log_dir,
      appLogMaxSize: data.app_log_max_size,
      appLogMaxFiles: data.app_log_max_files,
      checkpointInterval: data.checkpoint_interval,
    })
  }

  /**
   * @internal
   */
  static _toCppData(
    data: EventingFunctionSettings
  ): CppManagementEventingFunctionSettings {
    if (!data) {
      return {
        handler_headers: [],
        handler_footers: [],
      }
    }

    return {
      cpp_worker_count: data.cppWorkerThreadCount,
      dcp_stream_boundary: eventingFunctionDcpBoundaryToCpp(
        data.dcpStreamBoundary
      ),
      description: data.description,
      deployment_status: eventingFunctionDeploymentStatusToCpp(
        data.deploymentStatus
      ),
      processing_status: eventingFunctionProcessingStatusToCpp(
        data.processingStatus
      ),
      log_level: eventingFunctionLogLevelToCpp(data.logLevel),
      language_compatibility: eventingFunctionLanguageCompatibilityToCpp(
        data.languageCompatibility
      ),
      execution_timeout: data.executionTimeout,
      lcb_inst_capacity: data.lcbInstCapacity,
      lcb_retry_count: data.lcbRetryCount,
      lcb_timeout: data.lcbTimeout,
      query_consistency: queryScanConsistencyToCpp(data.queryConsistency),
      num_timer_partitions: data.numTimerPartitions,
      sock_batch_size: data.sockBatchSize,
      tick_duration: data.tickDuration,
      timer_context_size: data.timerContextSize,
      user_prefix: data.userPrefix,
      bucket_cache_size: data.bucketCacheSize,
      bucket_cache_age: data.bucketCacheAge,
      curl_max_allowed_resp_size: data.curlMaxAllowedRespSize,
      query_prepare_all: data.queryPrepareAll,
      worker_count: data.workerCount,
      handler_headers: data.handlerHeaders ?? [],
      handler_footers: data.handlerFooters ?? [],
      enable_app_log_rotation: data.enableAppLogRotation,
      app_log_dir: data.appLogDir,
      app_log_max_size: data.appLogMaxSize,
      app_log_max_files: data.appLogMaxFiles,
      checkpoint_interval: data.checkpointInterval,
    }
  }
}

/**
 * Describes an eventing function.
 *
 * @category Management
 */
export class EventingFunction {
  constructor(v: EventingFunction) {
    this.name = v.name
    this.code = v.code
    this.version = v.version
    this.enforceSchema = v.enforceSchema
    this.handlerUuid = v.handlerUuid
    this.functionInstanceId = v.functionInstanceId

    this.metadataKeyspace = v.metadataKeyspace
    this.sourceKeyspace = v.sourceKeyspace

    this.bucketBindings = v.bucketBindings
    this.urlBindings = v.urlBindings
    this.constantBindings = v.constantBindings

    this.settings = v.settings
  }

  /**
   * The name of the eventing function.
   */
  name: string

  /**
   * The code for this eventing function.
   */
  code: string

  /**
   * The authoring version of this eventing function.
   */
  version?: string

  /**
   * Whether to enable stricter validation of settings and configuration.
   */
  enforceSchema?: boolean

  /**
   * The unique ID for this eventing function.
   */
  handlerUuid?: number

  /**
   * The unique id for the deployment of the handler.
   */
  functionInstanceId?: string

  /**
   * The keyspace to store the functions metadata.
   */
  metadataKeyspace: EventingFunctionKeyspace

  /**
   * The keyspace that the function should operate on.
   */
  sourceKeyspace: EventingFunctionKeyspace

  /**
   * The buckets to bind to the function.
   */
  bucketBindings: EventingFunctionBucketBinding[]

  /**
   * The URLs to bind to the function.
   */
  urlBindings: EventingFunctionUrlBinding[]

  /**
   * The constants to bind to the function.
   */
  constantBindings: EventingFunctionConstantBinding[]

  /**
   * The settings for this function.
   */
  settings: EventingFunctionSettings

  /**
   * @internal
   */
  static _fromCppData(data: CppManagementEventingFunction): EventingFunction {
    return new EventingFunction({
      name: data.name,
      code: data.code,
      metadataKeyspace: new EventingFunctionKeyspace({
        bucket: data.metadata_keyspace.bucket,
        scope: data.metadata_keyspace.scope,
        collection: data.metadata_keyspace.collection,
      }),
      sourceKeyspace: new EventingFunctionKeyspace({
        bucket: data.source_keyspace.bucket,
        scope: data.source_keyspace.scope,
        collection: data.source_keyspace.collection,
      }),
      version: data.version,
      enforceSchema: data.enforce_schema,
      handlerUuid: data.handler_uuid,
      functionInstanceId: data.function_instance_id,
      bucketBindings: data.bucket_bindings.map(
        (bindingData: CppManagementEventingFunctionBucketBinding) =>
          EventingFunctionBucketBinding._fromCppData(bindingData)
      ),
      urlBindings: data.url_bindings.map(
        (bindingData: CppManagementEventingFunctionUrlBinding) =>
          EventingFunctionUrlBinding._fromCppData(bindingData)
      ),
      constantBindings: data.constant_bindings.map(
        (bindingData: CppManagementEventingFunctionConstantBinding) =>
          EventingFunctionConstantBinding._fromCppData(bindingData)
      ),
      settings: EventingFunctionSettings._fromCppData(data.settings),
    })
  }

  /**
   * @internal
   */
  static _toCppData(data: EventingFunction): CppManagementEventingFunction {
    return {
      name: data.name,
      code: data.code,
      metadata_keyspace: {
        bucket: data.metadataKeyspace.bucket,
        scope: data.metadataKeyspace.scope,
        collection: data.metadataKeyspace.collection,
      },
      source_keyspace: {
        bucket: data.sourceKeyspace.bucket,
        scope: data.sourceKeyspace.scope,
        collection: data.sourceKeyspace.collection,
      },
      version: data.version,
      enforce_schema: data.enforceSchema,
      handler_uuid: data.handlerUuid,
      function_instance_id: data.functionInstanceId,
      bucket_bindings: data.bucketBindings.map((binding) =>
        EventingFunctionBucketBinding._toCppData(binding)
      ),
      url_bindings: data.urlBindings.map((binding) =>
        EventingFunctionUrlBinding._toCppData(binding)
      ),
      constant_bindings: data.constantBindings.map((binding) =>
        EventingFunctionConstantBinding._toCppData(binding)
      ),
      settings: EventingFunctionSettings._toCppData(data.settings),
    }
  }
}

/**
 * Describes the current state of an eventing function.
 *
 * @category Management
 */
export class EventingFunctionState {
  constructor(v: EventingFunctionState) {
    this.name = v.name
    this.status = v.status
    this.numBootstrappingNodes = v.numBootstrappingNodes
    this.numDeployedNodes = v.numDeployedNodes
    this.deploymentStatus = v.deploymentStatus
    this.processingStatus = v.processingStatus
  }

  /**
   * The name of the eventing function.
   */
  name: string

  /**
   * The current overall state of this eventing function.
   */
  status: EventingFunctionStatus

  /**
   * The number of nodes where this eventing function is bootstrapping.
   */
  numBootstrappingNodes: number

  /**
   * The number of nodes where this eventing function is deployed.
   */
  numDeployedNodes: number

  /**
   * The current deployment status of this eventing function.
   */
  deploymentStatus: EventingFunctionDeploymentStatus

  /**
   * The current processing status of this eventing function.
   */
  processingStatus: EventingFunctionProcessingStatus

  /**
   * @internal
   */
  static _fromCppData(
    data: CppManagementEventingFunctionState
  ): EventingFunctionState {
    return new EventingFunctionState({
      name: data.name,
      status: eventingFunctionStatusFromCpp(data.status),
      numBootstrappingNodes: data.num_bootstrapping_nodes,
      numDeployedNodes: data.num_deployed_nodes,
      // deploymentStatus & processingStatus are required in the EventingFunctionState, and always set in the c++ interface, so asserting the type here.
      deploymentStatus: eventingFunctionDeploymentStatusFromCpp(
        data.deployment_status
      ) as EventingFunctionDeploymentStatus,
      processingStatus: eventingFunctionProcessingStatusFromCpp(
        data.processing_status
      ) as EventingFunctionProcessingStatus,
    })
  }
}

/**
 * Describes the current state of all eventing function.
 *
 * @category Management
 */
export class EventingState {
  constructor(v: EventingState) {
    this.numEventingNodes = v.numEventingNodes
    this.functions = v.functions
  }

  /**
   * The number of eventing nodes that are currently active.
   */
  numEventingNodes: number

  /**
   * The states of all registered eventing functions.
   */
  functions: EventingFunctionState[]

  /**
   * @internal
   */
  static _fromCppData(data: CppManagementEventingStatus): EventingState {
    return new EventingState({
      numEventingNodes: data.num_eventing_nodes,
      functions: data.functions.map(
        (functionData: CppManagementEventingFunctionState) =>
          EventingFunctionState._fromCppData(functionData)
      ),
    })
  }
}

/**
 * @category Management
 */
export interface UpsertFunctionOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DropFunctionOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface GetAllFunctionsOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface GetFunctionOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface DeployFunctionOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface UndeployFunctionOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface PauseFunctionOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface ResumeFunctionOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * @category Management
 */
export interface FunctionsStatusOptions {
  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number
}

/**
 * EventingFunctionManager provides an interface for managing the
 * eventing functions on the cluster.
 * Uncommitted: This API is subject to change in the future.
 *
 * @category Management
 */
export class EventingFunctionManager {
  private _cluster: Cluster

  /**
   * @internal
   */
  constructor(cluster: Cluster) {
    this._cluster = cluster
  }

  /**
   * Creates or updates an eventing function.
   *
   * @param functionDefinition The description of the eventing function to upsert.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async upsertFunction(
    functionDefinition: EventingFunction,
    options?: UpsertFunctionOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementEventingUpsertFunction(
        {
          function: EventingFunction._toCppData(functionDefinition),
          timeout: timeout,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Deletes an eventing function.
   *
   * @param name The name of the eventing function to delete.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async dropFunction(
    name: string,
    options?: DropFunctionOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementEventingDropFunction(
        {
          name: name,
          timeout: timeout,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Fetches all eventing functions.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getAllFunctions(
    options?: GetAllFunctionsOptions,
    callback?: NodeCallback<EventingFunction[]>
  ): Promise<EventingFunction[]> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementEventingGetAllFunctions(
        {
          timeout: timeout,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          const functions = resp.functions.map(
            (functionData: CppManagementEventingFunction) =>
              EventingFunction._fromCppData(functionData)
          )
          wrapCallback(null, functions)
        }
      )
    }, callback)
  }

  /**
   * Fetches a specific eventing function.
   *
   * @param name The name of the eventing function to fetch.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async getFunction(
    name: string,
    options?: GetFunctionOptions,
    callback?: NodeCallback<EventingFunction>
  ): Promise<EventingFunction> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementEventingGetFunction(
        {
          name: name,
          timeout: timeout,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          const eventingFunction = EventingFunction._fromCppData(resp.function)
          wrapCallback(null, eventingFunction)
        }
      )
    }, callback)
  }

  /**
   * Deploys an eventing function.
   *
   * @param name The name of the eventing function to deploy.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async deployFunction(
    name: string,
    options?: DeployFunctionOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementEventingDeployFunction(
        {
          name: name,
          timeout: timeout,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Undeploys an eventing function.
   *
   * @param name The name of the eventing function to undeploy.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async undeployFunction(
    name: string,
    options?: DeployFunctionOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementEventingUndeployFunction(
        {
          name: name,
          timeout: timeout,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Pauses an eventing function.
   *
   * @param name The name of the eventing function to pause.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async pauseFunction(
    name: string,
    options?: PauseFunctionOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementEventingPauseFunction(
        {
          name: name,
          timeout: timeout,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Resumes an eventing function.
   *
   * @param name The name of the eventing function to resume.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async resumeFunction(
    name: string,
    options?: ResumeFunctionOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    if (options instanceof Function) {
      callback = arguments[1]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementEventingResumeFunction(
        {
          name: name,
          timeout: timeout,
        },
        (cppErr) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          wrapCallback(err)
        }
      )
    }, callback)
  }

  /**
   * Fetches the status of all eventing functions.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   */
  async functionsStatus(
    options?: FunctionsStatusOptions,
    callback?: NodeCallback<EventingState>
  ): Promise<EventingState> {
    if (options instanceof Function) {
      callback = arguments[0]
      options = undefined
    }
    if (!options) {
      options = {}
    }

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrap((wrapCallback) => {
      this._cluster.conn.managementEventingGetStatus(
        {
          timeout: timeout,
        },
        (cppErr, resp) => {
          const err = errorFromCpp(cppErr)
          if (err) {
            return wrapCallback(err, null)
          }
          const state = EventingState._fromCppData(resp.status)
          wrapCallback(null, state)
        }
      )
    }, callback)
  }
}
