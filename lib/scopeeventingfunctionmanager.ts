import { Cluster } from './cluster'
import { NodeCallback, PromiseHelper, callbackOf, optionsOf } from './utilities'
import { CppManagementEventingFunction } from './binding'
import {
  DeployFunctionOptions,
  DropFunctionOptions,
  EventingFunction,
  EventingState,
  FunctionsStatusOptions,
  GetAllFunctionsOptions,
  GetFunctionOptions,
  IEventingFunction,
  PauseFunctionOptions,
  ResumeFunctionOptions,
  UpsertFunctionOptions,
} from './eventingfunctionmanager'
import { wrapObservableBindingCall } from './observability'
import { ObservableRequestHandler } from './observabilityhandler'
import {
  EventingFunctionMgmtOp,
  ObservabilityInstruments,
} from './observabilitytypes'

/**
 * ScopeEventingFunctionManager provides an interface for managing the
 * eventing functions on the scope.
 * Uncommitted: This API is subject to change in the future.
 *
 * @category Management
 */
export class ScopeEventingFunctionManager {
  private _cluster: Cluster
  private _bucketName: string
  private _scopeName: string

  /**
   * @internal
   */
  constructor(cluster: Cluster, bucketName: string, scopeName: string) {
    this._cluster = cluster
    this._bucketName = bucketName
    this._scopeName = scopeName
  }

  /**
   * @internal
   */
  get observabilityInstruments(): ObservabilityInstruments {
    return this._cluster.observabilityInstruments
  }

  /**
   * Creates or updates an eventing function.
   *
   * @param functionDefinition The description of the eventing function to upsert.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   *   Deprecated: await the returned promise instead.
   */
  upsertFunction(
    functionDefinition: IEventingFunction,
    options?: UpsertFunctionOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    callback = callbackOf(options, callback)
    options = optionsOf(options)

    const obsReqHandler = new ObservableRequestHandler(
      EventingFunctionMgmtOp.EventingUpsertFunction,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrapAsync(async () => {
      const [err, _] = await wrapObservableBindingCall(
        this._cluster.conn.managementEventingUpsertFunction.bind(
          this._cluster.conn
        ),
        {
          function: EventingFunction._toCppData(functionDefinition),
          bucket_name: this._bucketName,
          scope_name: this._scopeName,
          timeout: timeout,
        },
        obsReqHandler
      )
      if (err) {
        obsReqHandler.endWithError(err)
        throw err
      }
      obsReqHandler.end()
    }, callback)
  }

  /**
   * Deletes an eventing function.
   *
   * @param name The name of the eventing function to delete.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   *   Deprecated: await the returned promise instead.
   */
  dropFunction(
    name: string,
    options?: DropFunctionOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    callback = callbackOf(options, callback)
    options = optionsOf(options)

    const obsReqHandler = new ObservableRequestHandler(
      EventingFunctionMgmtOp.EventingDropFunction,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrapAsync(async () => {
      const [err, _] = await wrapObservableBindingCall(
        this._cluster.conn.managementEventingDropFunction.bind(
          this._cluster.conn
        ),
        {
          name: name,
          bucket_name: this._bucketName,
          scope_name: this._scopeName,
          timeout: timeout,
        },
        obsReqHandler
      )
      if (err) {
        obsReqHandler.endWithError(err)
        throw err
      }
      obsReqHandler.end()
    }, callback)
  }

  /**
   * Fetches all eventing functions.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   *   Deprecated: await the returned promise instead.
   */
  getAllFunctions(
    options?: GetAllFunctionsOptions,
    callback?: NodeCallback<EventingFunction[]>
  ): Promise<EventingFunction[]> {
    callback = callbackOf(options, callback)
    options = optionsOf(options)

    const obsReqHandler = new ObservableRequestHandler(
      EventingFunctionMgmtOp.EventingGetAllFunctions,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrapAsync(async () => {
      const [err, resp] = await wrapObservableBindingCall(
        this._cluster.conn.managementEventingGetAllFunctions.bind(
          this._cluster.conn
        ),
        {
          bucket_name: this._bucketName,
          scope_name: this._scopeName,
          timeout: timeout,
        },
        obsReqHandler
      )
      if (err) {
        obsReqHandler.endWithError(err)
        throw err
      }
      return obsReqHandler.endAfter(() =>
        resp.functions.map((functionData: CppManagementEventingFunction) =>
          EventingFunction._fromCppData(functionData)
        )
      )
    }, callback)
  }

  /**
   * Fetches a specific eventing function.
   *
   * @param name The name of the eventing function to fetch.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   *   Deprecated: await the returned promise instead.
   */
  getFunction(
    name: string,
    options?: GetFunctionOptions,
    callback?: NodeCallback<EventingFunction>
  ): Promise<EventingFunction> {
    callback = callbackOf(options, callback)
    options = optionsOf(options)

    const obsReqHandler = new ObservableRequestHandler(
      EventingFunctionMgmtOp.EventingGetFunction,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrapAsync(async () => {
      const [err, resp] = await wrapObservableBindingCall(
        this._cluster.conn.managementEventingGetFunction.bind(
          this._cluster.conn
        ),
        {
          name: name,
          bucket_name: this._bucketName,
          scope_name: this._scopeName,
          timeout: timeout,
        },
        obsReqHandler
      )
      if (err) {
        obsReqHandler.endWithError(err)
        throw err
      }
      return obsReqHandler.endAfter(() =>
        EventingFunction._fromCppData(resp.function)
      )
    }, callback)
  }

  /**
   * Deploys an eventing function.
   *
   * @param name The name of the eventing function to deploy.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   *   Deprecated: await the returned promise instead.
   */
  deployFunction(
    name: string,
    options?: DeployFunctionOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    callback = callbackOf(options, callback)
    options = optionsOf(options)

    const obsReqHandler = new ObservableRequestHandler(
      EventingFunctionMgmtOp.EventingDeployFunction,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrapAsync(async () => {
      const [err, _] = await wrapObservableBindingCall(
        this._cluster.conn.managementEventingDeployFunction.bind(
          this._cluster.conn
        ),
        {
          name: name,
          bucket_name: this._bucketName,
          scope_name: this._scopeName,
          timeout: timeout,
        },
        obsReqHandler
      )
      if (err) {
        obsReqHandler.endWithError(err)
        throw err
      }
      obsReqHandler.end()
    }, callback)
  }

  /**
   * Undeploys an eventing function.
   *
   * @param name The name of the eventing function to undeploy.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   *   Deprecated: await the returned promise instead.
   */
  undeployFunction(
    name: string,
    options?: DeployFunctionOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    callback = callbackOf(options, callback)
    options = optionsOf(options)

    const obsReqHandler = new ObservableRequestHandler(
      EventingFunctionMgmtOp.EventingUndeployFunction,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrapAsync(async () => {
      const [err, _] = await wrapObservableBindingCall(
        this._cluster.conn.managementEventingUndeployFunction.bind(
          this._cluster.conn
        ),
        {
          name: name,
          bucket_name: this._bucketName,
          scope_name: this._scopeName,
          timeout: timeout,
        },
        obsReqHandler
      )
      if (err) {
        obsReqHandler.endWithError(err)
        throw err
      }
      obsReqHandler.end()
    }, callback)
  }

  /**
   * Pauses an eventing function.
   *
   * @param name The name of the eventing function to pause.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   *   Deprecated: await the returned promise instead.
   */
  pauseFunction(
    name: string,
    options?: PauseFunctionOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    callback = callbackOf(options, callback)
    options = optionsOf(options)

    const obsReqHandler = new ObservableRequestHandler(
      EventingFunctionMgmtOp.EventingPauseFunction,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrapAsync(async () => {
      const [err, _] = await wrapObservableBindingCall(
        this._cluster.conn.managementEventingPauseFunction.bind(
          this._cluster.conn
        ),
        {
          name: name,
          bucket_name: this._bucketName,
          scope_name: this._scopeName,
          timeout: timeout,
        },
        obsReqHandler
      )
      if (err) {
        obsReqHandler.endWithError(err)
        throw err
      }
      obsReqHandler.end()
    }, callback)
  }

  /**
   * Resumes an eventing function.
   *
   * @param name The name of the eventing function to resume.
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   *   Deprecated: await the returned promise instead.
   */
  resumeFunction(
    name: string,
    options?: ResumeFunctionOptions,
    callback?: NodeCallback<void>
  ): Promise<void> {
    callback = callbackOf(options, callback)
    options = optionsOf(options)

    const obsReqHandler = new ObservableRequestHandler(
      EventingFunctionMgmtOp.EventingResumeFunction,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrapAsync(async () => {
      const [err, _] = await wrapObservableBindingCall(
        this._cluster.conn.managementEventingResumeFunction.bind(
          this._cluster.conn
        ),
        {
          name: name,
          bucket_name: this._bucketName,
          scope_name: this._scopeName,
          timeout: timeout,
        },
        obsReqHandler
      )
      if (err) {
        obsReqHandler.endWithError(err)
        throw err
      }
      obsReqHandler.end()
    }, callback)
  }

  /**
   * Fetches the status of all eventing functions.
   *
   * @param options Optional parameters for this operation.
   * @param callback A node-style callback to be invoked after execution.
   *   Deprecated: await the returned promise instead.
   */
  functionsStatus(
    options?: FunctionsStatusOptions,
    callback?: NodeCallback<EventingState>
  ): Promise<EventingState> {
    callback = callbackOf(options, callback)
    options = optionsOf(options)

    const obsReqHandler = new ObservableRequestHandler(
      EventingFunctionMgmtOp.EventingGetStatus,
      this.observabilityInstruments,
      options?.parentSpan
    )
    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

    const timeout = options.timeout || this._cluster.managementTimeout

    return PromiseHelper.wrapAsync(async () => {
      const [err, resp] = await wrapObservableBindingCall(
        this._cluster.conn.managementEventingGetStatus.bind(this._cluster.conn),
        {
          bucket_name: this._bucketName,
          scope_name: this._scopeName,
          timeout: timeout,
        },
        obsReqHandler
      )
      if (err) {
        obsReqHandler.endWithError(err)
        throw err
      }
      return obsReqHandler.endAfter(() =>
        EventingState._fromCppData(resp.status)
      )
    }, callback)
  }
}
