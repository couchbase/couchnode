import { Cluster } from './cluster'
import {
  CouchbaseError,
  CollectionNotFoundError,
  EventingFunctionCompilationFailureError,
  EventingFunctionDeployedError,
  EventingFunctionIdenticalKeyspaceError,
  EventingFunctionNotBootstrappedError,
  EventingFunctionNotDeployedError,
  EventingFunctionNotFoundError,
} from './errors'
import { HttpExecutor, HttpMethod, HttpServiceType } from './httpexecutor'
import { QueryScanConsistency } from './querytypes'
import { NodeCallback, PromiseHelper } from './utilities'

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
  static _fromEvtData(data: any): EventingFunctionBucketBinding {
    return new EventingFunctionBucketBinding({
      name: new EventingFunctionKeyspace({
        bucket: data.bucket_name,
        scope: data.scope_name,
        collection: data.collection_name,
      }),
      alias: data.alias,
      access: data.access,
    })
  }

  /**
   * @internal
   */
  static _toEvtData(data: EventingFunctionBucketBinding): any {
    return {
      bucket_name: data.name.bucket,
      scope_name: data.name.scope,
      collection_name: data.name.collection,
      alias: data.alias,
      access: data.access,
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
  static _fromEvtData(data: any): EventingFunctionUrlBinding {
    let authObj
    if (data.auth_type === EventingFunctionUrlAuthMethod.None) {
      authObj = undefined
    } else if (data.auth_type === EventingFunctionUrlAuthMethod.Basic) {
      authObj = new EventingFunctionUrlAuthBasic({
        username: data.username,
        password: data.password,
      })
    } else if (data.auth_type === EventingFunctionUrlAuthMethod.Digest) {
      authObj = new EventingFunctionUrlAuthDigest({
        username: data.username,
        password: data.password,
      })
    } else if (data.auth_type === EventingFunctionUrlAuthMethod.Bearer) {
      authObj = new EventingFunctionUrlAuthBearer({
        key: data.bearer_key,
      })
    } else {
      throw new Error('invalid auth type specified')
    }

    return {
      hostname: data.hostname,
      alias: data.value,
      allowCookies: data.allow_cookies,
      validateSslCertificate: data.validate_ssl_certificate,
      auth: authObj,
    }
  }

  /**
   * @internal
   */
  static _toEvtData(data: EventingFunctionUrlBinding): any {
    return {
      hostname: data.hostname,
      value: data.alias,
      allow_cookies: data.allowCookies,
      validate_ssl_certificate: data.validateSslCertificate,
      auth_type: data.auth
        ? data.auth.method
        : EventingFunctionUrlAuthMethod.None,
      username: (data as any).username,
      password: (data as any).password,
      bearer_key: (data as any).key,
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
  static _fromEvtData(data: any): EventingFunctionConstantBinding {
    return new EventingFunctionConstantBinding({
      alias: data.value,
      literal: data.literal,
    })
  }

  /**
   * @internal
   */
  static _toEvtData(data: EventingFunctionConstantBinding): any {
    return {
      value: data.alias,
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
  cppWorkerThreadCount: number

  /**
   * The DCP stream boundary to use.
   */
  dcpStreamBoundary: EventingFunctionDcpBoundary

  /**
   * A description of this eventing function.
   */
  description: string

  /**
   * The current deployment status of the function.
   */
  deploymentStatus: EventingFunctionDeploymentStatus

  /**
   * The current processing status of the function.
   */
  processingStatus: EventingFunctionProcessingStatus

  /**
   * The active compatibility mode for the function.
   */
  languageCompatibility: EventingFunctionLanguageCompatibility

  /**
   * The level of logging that should be captured for the function.
   */
  logLevel: EventingFunctionLogLevel

  /**
   * The maximum period of time the function can execute on a document
   * before timing out.
   */
  executionTimeout: number

  /**
   * The maximum number of internal clients that the function should
   * maintain for KV operations.
   */
  lcbInstCapacity: number

  /**
   * The maximum number of times to retry a KV operation before failing
   * the function.
   */
  lcbRetryCount: number

  /**
   * The maximum period of time a KV operation within the function can
   * operate before timing out.
   */
  lcbTimeout: number

  /**
   * The level of consistency to use when performing queries in the function.
   */
  queryConsistency: QueryScanConsistency

  /**
   * The number of partitions that should be used for timer tracking.
   */
  numTimerPartitions: number

  /**
   * The batch size for messages from producer to consumer.
   */
  sockBatchSize: number

  /**
   * The duration to log stats from this handler, in milliseconds.
   */
  tickDuration: number

  /**
   * The size limit of timer context object.
   */
  timerContextSize: number

  /**
   * The key prefix for all data stored in metadata by this handler.
   */
  userPrefix: string

  /**
   * The maximum size in bytes the bucket cache can grow to.
   */
  bucketCacheSize: number

  /**
   * The time in milliseconds after which a cached bucket object is considered stale.
   */
  bucketCacheAge: number

  /**
   * The maximum allowable curl call response in 'MegaBytes'. Setting the value to 0
   * lifts the upper limit off. This parameters affects v8 engine stability since it
   * defines the maximum amount of heap space acquired by a curl call.
   */
  curlMaxAllowedRespSize: number

  /**
   * Whether to automatically prepare all query statements in the handler.
   */
  queryPrepareAll: boolean

  /**
   * The number of worker processes handler utilizes on each eventing node.
   */
  workerCount: number

  /**
   * The code to automatically prepend to top of handler code.
   */
  handlerHeaders: string[]

  /**
   * The code to automatically append to bottom of handler code.
   */
  handlerFooters: string[]

  /**
   * Whether to enable rotating this handlers log() message files.
   */
  enableAppLogRotation: boolean

  /**
   * The directory to write content of log() message files.
   */
  appLogDir: string

  /**
   * The size in bytes of the log file when the file should be rotated.
   */
  appLogMaxSize: number

  /**
   * The number of log() message files to retain when rotating.
   */
  appLogMaxFiles: number

  /**
   * The number of seconds before writing a progress checkpoint.
   */
  checkpointInterval: number

  /**
   * @internal
   */
  static _fromEvtData(data: any): EventingFunctionSettings {
    return new EventingFunctionSettings({
      cppWorkerThreadCount: data.cpp_worker_thread_count,
      dcpStreamBoundary: data.dcp_stream_boundary,
      description: data.description,
      logLevel: data.log_level,
      languageCompatibility: data.language_compatibility,
      executionTimeout: data.execution_timeout,
      lcbInstCapacity: data.lcb_inst_capacity,
      lcbRetryCount: data.lcb_retry_count,
      lcbTimeout: data.lcb_timeout,
      queryConsistency: data.n1ql_consistency,
      numTimerPartitions: data.num_timer_partitions,
      sockBatchSize: data.sock_batch_size,
      tickDuration: data.tick_duration,
      timerContextSize: data.timer_context_size,
      userPrefix: data.user_prefix,
      bucketCacheSize: data.bucket_cache_size,
      bucketCacheAge: data.bucket_cache_age,
      curlMaxAllowedRespSize: data.curl_max_allowed_resp_size,
      workerCount: data.worker_count,
      queryPrepareAll: data.n1ql_prepare_all,
      handlerHeaders: data.handler_headers,
      handlerFooters: data.handler_footers,
      enableAppLogRotation: data.enable_applog_rotation,
      appLogDir: data.app_log_dir,
      appLogMaxSize: data.app_log_max_size,
      appLogMaxFiles: data.app_log_max_files,
      checkpointInterval: data.checkpoint_interval,
      deploymentStatus: data.deployment_status
        ? EventingFunctionDeploymentStatus.Deployed
        : EventingFunctionDeploymentStatus.Undeployed,
      processingStatus: data.processing_status
        ? EventingFunctionProcessingStatus.Running
        : EventingFunctionProcessingStatus.Paused,
    })
  }

  /**
   * @internal
   */
  static _toEvtData(data: EventingFunctionSettings): any {
    if (!data) {
      return {
        deployment_status: false,
      }
    }

    return {
      cpp_worker_thread_count: data.cppWorkerThreadCount,
      dcp_stream_boundary: data.dcpStreamBoundary,
      description: data.description,
      log_level: data.logLevel,
      language_compatibility: data.languageCompatibility,
      execution_timeout: data.executionTimeout,
      lcb_inst_capacity: data.lcbInstCapacity,
      lcb_retry_count: data.lcbRetryCount,
      lcb_timeout: data.lcbTimeout,
      n1ql_consistency: data.queryConsistency,
      num_timer_partitions: data.numTimerPartitions,
      sock_batch_size: data.sockBatchSize,
      tick_duration: data.tickDuration,
      timer_context_size: data.timerContextSize,
      user_prefix: data.userPrefix,
      bucket_cache_size: data.bucketCacheSize,
      bucket_cache_age: data.bucketCacheAge,
      curl_max_allowed_resp_size: data.curlMaxAllowedRespSize,
      worker_count: data.workerCount,
      n1ql_prepare_all: data.queryPrepareAll,
      handler_headers: data.handlerHeaders,
      handler_footers: data.handlerFooters,
      enable_applog_rotation: data.enableAppLogRotation,
      app_log_dir: data.appLogDir,
      app_log_max_size: data.appLogMaxSize,
      app_log_max_files: data.appLogMaxFiles,
      checkpoint_interval: data.checkpointInterval,
      deployment_status:
        data.deploymentStatus === EventingFunctionDeploymentStatus.Deployed
          ? true
          : false,
      processing_status:
        data.processingStatus === EventingFunctionProcessingStatus.Running
          ? true
          : false,
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
  version: string

  /**
   * Whether to enable stricter validation of settings and configuration.
   */
  enforceSchema: boolean

  /**
   * The unique ID for this eventing function.
   */
  handlerUuid: number

  /**
   * The unique id for the deployment of the handler.
   */
  functionInstanceId: string

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
  static _fromEvtData(data: any): EventingFunction {
    return new EventingFunction({
      name: data.appname,
      code: data.appcode,
      settings: EventingFunctionSettings._fromEvtData(data.settings),
      version: data.version,
      enforceSchema: data.enforce_schema,
      handlerUuid: data.handleruuid,
      functionInstanceId: data.function_instance_id,
      metadataKeyspace: new EventingFunctionKeyspace({
        bucket: data.depcfg.metadata_bucket,
        scope: data.depcfg.metadata_scope,
        collection: data.depcfg.metadata_collection,
      }),
      sourceKeyspace: new EventingFunctionKeyspace({
        bucket: data.depcfg.source_bucket,
        scope: data.depcfg.source_scope,
        collection: data.depcfg.source_collection,
      }),
      constantBindings: data.depcfg.constants.map((bindingData: any) =>
        EventingFunctionConstantBinding._fromEvtData(bindingData)
      ),
      bucketBindings: data.depcfg.buckets.map((bindingData: any) =>
        EventingFunctionBucketBinding._fromEvtData(bindingData)
      ),
      urlBindings: data.depcfg.curl.map((bindingData: any) =>
        EventingFunctionUrlBinding._fromEvtData(bindingData)
      ),
    })
  }

  /**
   * @internal
   */
  static _toEvtData(data: EventingFunction): any {
    return {
      appname: data.name,
      appcode: data.code,
      settings: EventingFunctionSettings._toEvtData(data.settings),
      version: data.version,
      enforce_schema: data.enforceSchema,
      handleruuid: data.handlerUuid,
      function_instance_id: data.functionInstanceId,
      depcfg: {
        metadata_bucket: data.metadataKeyspace.bucket,
        metadata_scope: data.metadataKeyspace.scope,
        metadata_collection: data.metadataKeyspace.collection,
        source_bucket: data.sourceKeyspace.bucket,
        source_scope: data.sourceKeyspace.scope,
        source_collection: data.sourceKeyspace.collection,
        constants: data.constantBindings.map((binding) =>
          EventingFunctionConstantBinding._toEvtData(binding)
        ),
        buckets: data.bucketBindings.map((binding) =>
          EventingFunctionBucketBinding._toEvtData(binding)
        ),
        curl: data.urlBindings.map((binding) =>
          EventingFunctionUrlBinding._toEvtData(binding)
        ),
      },
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
  static _fromEvtData(data: any): EventingFunctionState {
    return new EventingFunctionState({
      name: data.name,
      status: data.composite_status,
      numBootstrappingNodes: data.num_bootstrapping_nodes,
      numDeployedNodes: data.num_deployed_nodes,
      deploymentStatus: data.deployment_status
        ? EventingFunctionDeploymentStatus.Deployed
        : EventingFunctionDeploymentStatus.Undeployed,
      processingStatus: data.processing_status
        ? EventingFunctionProcessingStatus.Running
        : EventingFunctionProcessingStatus.Paused,
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
  static _fromEvtData(data: any): EventingState {
    return new EventingState({
      numEventingNodes: data.num_eventing_nodes,
      functions: data.apps.map((functionData: any) =>
        EventingFunctionState._fromEvtData(functionData)
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
 * Volatile: This API is subject to change at any time.
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

  private get _http() {
    return new HttpExecutor(this._cluster.conn)
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

    const functionName = functionDefinition.name
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrapAsync(async () => {
      const encodedData = EventingFunction._toEvtData(functionDefinition)

      const res = await this._http.request({
        type: HttpServiceType.Eventing,
        method: HttpMethod.Post,
        path: `/api/v1/functions/${functionName}`,
        contentType: 'application/json',
        body: JSON.stringify(encodedData),
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        const errText = res.body.toString().toLowerCase()
        if (errText.includes('err_collection_missing')) {
          throw new CollectionNotFoundError(undefined, errCtx)
        }
        if (errText.includes('err_src_mb_same')) {
          throw new EventingFunctionIdenticalKeyspaceError(undefined, errCtx)
        }
        if (errText.includes('err_handler_compilation')) {
          throw new EventingFunctionCompilationFailureError(undefined, errCtx)
        }

        throw new CouchbaseError('failed to upsert function', undefined, errCtx)
      }
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

    const functionName = name
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Eventing,
        method: HttpMethod.Delete,
        path: `/api/v1/functions/${functionName}`,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        const errText = res.body.toString().toLowerCase()
        if (errText.includes('err_app_not_found_ts')) {
          throw new EventingFunctionNotFoundError(undefined, errCtx)
        }
        if (errText.includes('err_app_not_deployed')) {
          throw new EventingFunctionNotDeployedError(undefined, errCtx)
        }
        if (errText.includes('err_app_not_undeployed')) {
          throw new EventingFunctionDeployedError(undefined, errCtx)
        }

        throw new CouchbaseError('failed to drop function', undefined, errCtx)
      }
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

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Eventing,
        method: HttpMethod.Get,
        path: `/api/v1/functions`,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        throw new CouchbaseError('failed to get functions', undefined, errCtx)
      }

      const functionsData = JSON.parse(res.body.toString())
      const functions = functionsData.map((functionData: any) =>
        EventingFunction._fromEvtData(functionData)
      )
      return functions
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

    const functionName = name
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Eventing,
        method: HttpMethod.Get,
        path: `/api/v1/functions/${functionName}`,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        const errText = res.body.toString().toLowerCase()
        if (errText.includes('err_app_not_found_ts')) {
          throw new EventingFunctionNotFoundError(undefined, errCtx)
        }

        throw new CouchbaseError('failed to get function', undefined, errCtx)
      }

      const functionData = JSON.parse(res.body.toString())
      return EventingFunction._fromEvtData(functionData)
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

    const functionName = name
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Eventing,
        method: HttpMethod.Post,
        path: `/api/v1/functions/${functionName}/deploy`,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        const errText = res.body.toString().toLowerCase()
        if (errText.includes('err_app_not_found_ts')) {
          throw new EventingFunctionNotFoundError(undefined, errCtx)
        }
        if (errText.includes('err_app_not_bootstrapped')) {
          throw new EventingFunctionNotBootstrappedError(undefined, errCtx)
        }

        throw new CouchbaseError('failed to deploy function', undefined, errCtx)
      }
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

    const functionName = name
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Eventing,
        method: HttpMethod.Post,
        path: `/api/v1/functions/${functionName}/undeploy`,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        const errText = res.body.toString().toLowerCase()
        if (errText.includes('err_app_not_found_ts')) {
          throw new EventingFunctionNotFoundError(undefined, errCtx)
        }
        if (errText.includes('err_app_not_deployed')) {
          throw new EventingFunctionNotDeployedError(undefined, errCtx)
        }

        throw new CouchbaseError(
          'failed to undeploy function',
          undefined,
          errCtx
        )
      }
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

    const functionName = name
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Eventing,
        method: HttpMethod.Post,
        path: `/api/v1/functions/${functionName}/pause`,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        const errText = res.body.toString().toLowerCase()
        if (errText.includes('err_app_not_found_ts')) {
          throw new EventingFunctionNotFoundError(undefined, errCtx)
        }
        if (errText.includes('err_app_not_bootstrapped')) {
          throw new EventingFunctionNotBootstrappedError(undefined, errCtx)
        }

        throw new CouchbaseError('failed to pause function', undefined, errCtx)
      }
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

    const functionName = name
    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Eventing,
        method: HttpMethod.Post,
        path: `/api/v1/functions/${functionName}/resume`,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        const errText = res.body.toString().toLowerCase()
        if (errText.includes('err_app_not_found_ts')) {
          throw new EventingFunctionNotFoundError(undefined, errCtx)
        }
        if (errText.includes('err_app_not_deployed')) {
          throw new EventingFunctionNotDeployedError(undefined, errCtx)
        }

        throw new CouchbaseError('failed to resume function', undefined, errCtx)
      }
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

    return PromiseHelper.wrapAsync(async () => {
      const res = await this._http.request({
        type: HttpServiceType.Eventing,
        method: HttpMethod.Get,
        path: `/api/v1/status`,
        timeout: timeout,
      })

      if (res.statusCode !== 200) {
        const errCtx = HttpExecutor.errorContextFromResponse(res)

        throw new CouchbaseError(
          'failed to fetch functions status',
          undefined,
          errCtx
        )
      }

      const statusData = JSON.parse(res.body.toString())
      return EventingState._fromEvtData(statusData)
    }, callback)
  }
}
