/* eslint jsdoc/require-jsdoc: off */
import binding, {
  CppConnection,
  CppLogFunc,
  CppError,
  CppTracer,
  CppMeter,
} from './binding'
import { translateCppError } from './bindingutilities'
import { ConnSpec } from './connspec'
import { ConnectionClosedError } from './errors'
import { LogFunc } from './logging'
import { NoopMeter, LoggingMeter, Meter } from './metrics'
import { NoopTracer, ThresholdLoggingTracer, RequestTracer } from './tracing'

function getClientString() {
  // Grab the various versions.  Note that we need to trim them
  // off as some Node.js versions insert strange characters into
  // the version identifiers (mainly newlines and such).
  /* eslint-disable-next-line @typescript-eslint/no-var-requires */
  const couchnodeVer = require('../package.json').version.trim()
  const nodeVer = process.versions.node.trim()
  const v8Ver = process.versions.v8.trim()
  const sslVer = process.versions.openssl.trim()

  return `couchnode/${couchnodeVer} (node/${nodeVer}; v8/${v8Ver}; ssl/${sslVer})`
}

export interface ConnectionOptions {
  connStr: string
  username?: string
  password?: string
  trustStorePath?: string
  certificatePath?: string
  keyPath?: string
  bucketName?: string
  kvConnectTimeout?: number
  kvTimeout?: number
  kvDurableTimeout?: number
  viewTimeout?: number
  queryTimeout?: number
  analyticsTimeout?: number
  searchTimeout?: number
  managementTimeout?: number
  tracer?: RequestTracer
  meter?: Meter
  logFunc?: LogFunc
}

type ErrCallback = (err: Error | null) => void

// We need this small type-utility to ensure that the labels on the parameter
// tuple actually get transferred during the merge (typescript bug).
type MergeArgs<A, B> = A extends [...infer Params]
  ? [...Params, ...(B extends [...infer Params2] ? Params2 : [])]
  : never

// This type takes a function as input from the CppConnection and then adjusts
// the callback to be of type (Error | null) as opposed to (CppError | null).
// It is used to adjust the return types of Connection to reflect that the error
// has already been translated from a CppError to CouchbaseError.
type CppCbToNew<T extends (...fargs: any[]) => void> = T extends (
  ...fargs: [
    ...infer FArgs,
    (err: CppError | null, ...cbArgs: infer CbArgs) => void
  ]
) => void
  ? [
      ...fargs: MergeArgs<
        FArgs,
        [callback: (err: Error | null, ...cbArgs: CbArgs) => void]
      >
    ]
  : never

export class Connection {
  private _inst: CppConnection
  private _connected: boolean
  private _opened: boolean
  private _closed: boolean

  constructor(options: ConnectionOptions) {
    this._closed = false
    this._connected = false
    this._opened = false

    const lcbDsnObj = ConnSpec.parse(options.connStr)

    // This function converts a timeout value expressed in milliseconds into
    // a string for the connection string, represented in seconds.
    const fmtTmt = (value: number) => {
      return (value / 1000).toString()
    }

    if (options.trustStorePath) {
      lcbDsnObj.options.truststorepath = options.trustStorePath
    }
    if (options.certificatePath) {
      lcbDsnObj.options.certpath = options.certificatePath
    }
    if (options.keyPath) {
      lcbDsnObj.options.keypath = options.keyPath
    }
    if (options.bucketName) {
      lcbDsnObj.bucket = options.bucketName
    }
    if (options.kvConnectTimeout) {
      lcbDsnObj.options.config_total_timeout = fmtTmt(options.kvConnectTimeout)
    }
    if (options.kvTimeout) {
      lcbDsnObj.options.timeout = fmtTmt(options.kvTimeout)
    }
    if (options.kvDurableTimeout) {
      lcbDsnObj.options.durability_timeout = fmtTmt(options.kvDurableTimeout)
    }
    if (options.viewTimeout) {
      lcbDsnObj.options.views_timeout = fmtTmt(options.viewTimeout)
    }
    if (options.queryTimeout) {
      lcbDsnObj.options.query_timeout = fmtTmt(options.queryTimeout)
    }
    if (options.analyticsTimeout) {
      lcbDsnObj.options.analytics_timeout = fmtTmt(options.analyticsTimeout)
    }
    if (options.searchTimeout) {
      lcbDsnObj.options.search_timeout = fmtTmt(options.searchTimeout)
    }
    if (options.managementTimeout) {
      lcbDsnObj.options.http_timeout = fmtTmt(options.managementTimeout)
    }

    let lcbTracer: CppTracer | undefined = undefined
    if (options.tracer) {
      if (options.tracer instanceof NoopTracer) {
        lcbDsnObj.options.enable_tracing = 'off'
      } else if (options.tracer instanceof ThresholdLoggingTracer) {
        const tracerOpts = options.tracer._options
        lcbDsnObj.options.enable_tracing = 'on'
        if (tracerOpts.emitInterval) {
          lcbDsnObj.options.tracing_threshold_queue_flush_interval = fmtTmt(
            tracerOpts.emitInterval
          )
        }
        if (tracerOpts.sampleSize) {
          lcbDsnObj.options.tracing_threshold_queue_size = tracerOpts.sampleSize.toString()
        }
        if (tracerOpts.kvThreshold) {
          lcbDsnObj.options.tracing_threshold_kv = fmtTmt(
            tracerOpts.kvThreshold
          )
        }
        if (tracerOpts.queryThreshold) {
          lcbDsnObj.options.tracing_threshold_query = fmtTmt(
            tracerOpts.queryThreshold
          )
        }
        if (tracerOpts.viewsThreshold) {
          lcbDsnObj.options.tracing_threshold_view = fmtTmt(
            tracerOpts.viewsThreshold
          )
        }
        if (tracerOpts.searchThreshold) {
          lcbDsnObj.options.tracing_threshold_search = fmtTmt(
            tracerOpts.searchThreshold
          )
        }
        if (tracerOpts.analyticsThreshold) {
          lcbDsnObj.options.tracing_threshold_analytics = fmtTmt(
            tracerOpts.analyticsThreshold
          )
        }
      } else {
        lcbDsnObj.options.enable_tracing = 'on'
        lcbTracer = options.tracer
      }
    }

    let lcbMeter: CppMeter | undefined = undefined
    if (options.meter) {
      if (options.meter instanceof NoopMeter) {
        lcbDsnObj.options.enable_operation_metrics = 'off'
      } else if (options.meter instanceof LoggingMeter) {
        const meterOpts = options.meter._options
        lcbDsnObj.options.enable_operation_metrics = 'on'
        if (meterOpts.emitInterval) {
          lcbDsnObj.options.operation_metrics_flush_interval = fmtTmt(
            meterOpts.emitInterval
          )
        }
      } else {
        lcbDsnObj.options.enable_operation_metrics = 'on'
        lcbMeter = options.meter
      }
    }

    lcbDsnObj.options.client_string = getClientString()

    const lcbConnStr = lcbDsnObj.toString()

    let lcbConnType = binding.LCB_TYPE_CLUSTER
    if (lcbDsnObj.bucket) {
      lcbConnType = binding.LCB_TYPE_BUCKET
    }

    // This conversion relies on the LogSeverity and CppLogSeverity enumerations
    // always being in sync.  There is a test that ensures this.
    const lcbLogFunc = (options.logFunc as any) as CppLogFunc

    this._inst = new binding.Connection(
      lcbConnType,
      lcbConnStr,
      options.username,
      options.password,
      lcbLogFunc,
      lcbTracer,
      lcbMeter
    )

    // If a bucket name is specified, this connection is immediately marked as
    // opened, with the assumption that the binding is doing this implicitly.
    if (lcbDsnObj.bucket) {
      this._opened = true
    }
  }

  connect(callback: (err: Error | null) => void): void {
    this._inst.connect((err) => {
      if (err) {
        this._closed = true
        callback(translateCppError(err))
        return
      }

      this._connected = true
      callback(null)
    })
  }

  selectBucket(
    bucketName: string,
    callback: (err: Error | null) => void
  ): void {
    this._inst.selectBucket(bucketName, (err) => {
      if (err) {
        return callback(translateCppError(err))
      }

      this._opened = true
      callback(null)
    })
  }

  close(callback: (err: Error | null) => void): void {
    if (this._closed) {
      return
    }

    this._closed = true
    this._inst.shutdown()

    callback(null)
  }

  get(
    ...args: CppCbToNew<CppConnection['get']>
  ): ReturnType<CppConnection['get']> {
    return this._proxyToConn(this._inst, this._inst.get, ...args)
  }

  exists(
    ...args: CppCbToNew<CppConnection['exists']>
  ): ReturnType<CppConnection['exists']> {
    return this._proxyToConn(this._inst, this._inst.exists, ...args)
  }

  getReplica(
    ...args: CppCbToNew<CppConnection['getReplica']>
  ): ReturnType<CppConnection['getReplica']> {
    return this._proxyToConn(this._inst, this._inst.getReplica, ...args)
  }

  store(
    ...args: CppCbToNew<CppConnection['store']>
  ): ReturnType<CppConnection['store']> {
    return this._proxyToConn(this._inst, this._inst.store, ...args)
  }

  remove(
    ...args: CppCbToNew<CppConnection['remove']>
  ): ReturnType<CppConnection['remove']> {
    return this._proxyToConn(this._inst, this._inst.remove, ...args)
  }

  touch(
    ...args: CppCbToNew<CppConnection['touch']>
  ): ReturnType<CppConnection['touch']> {
    return this._proxyToConn(this._inst, this._inst.touch, ...args)
  }

  unlock(
    ...args: CppCbToNew<CppConnection['unlock']>
  ): ReturnType<CppConnection['unlock']> {
    return this._proxyToConn(this._inst, this._inst.unlock, ...args)
  }

  counter(
    ...args: CppCbToNew<CppConnection['counter']>
  ): ReturnType<CppConnection['counter']> {
    return this._proxyToConn(this._inst, this._inst.counter, ...args)
  }

  lookupIn(
    ...args: CppCbToNew<CppConnection['lookupIn']>
  ): ReturnType<CppConnection['lookupIn']> {
    return this._proxyToConn(this._inst, this._inst.lookupIn, ...args)
  }

  mutateIn(
    ...args: CppCbToNew<CppConnection['mutateIn']>
  ): ReturnType<CppConnection['mutateIn']> {
    return this._proxyToConn(this._inst, this._inst.mutateIn, ...args)
  }

  viewQuery(
    ...args: CppCbToNew<CppConnection['viewQuery']>
  ): ReturnType<CppConnection['viewQuery']> {
    return this._proxyToConn(this._inst, this._inst.viewQuery, ...args)
  }

  query(
    ...args: CppCbToNew<CppConnection['query']>
  ): ReturnType<CppConnection['query']> {
    return this._proxyToConn(this._inst, this._inst.query, ...args)
  }

  analyticsQuery(
    ...args: CppCbToNew<CppConnection['analyticsQuery']>
  ): ReturnType<CppConnection['analyticsQuery']> {
    return this._proxyToConn(this._inst, this._inst.analyticsQuery, ...args)
  }

  searchQuery(
    ...args: CppCbToNew<CppConnection['searchQuery']>
  ): ReturnType<CppConnection['searchQuery']> {
    return this._proxyToConn(this._inst, this._inst.searchQuery, ...args)
  }

  httpRequest(
    ...args: CppCbToNew<CppConnection['httpRequest']>
  ): ReturnType<CppConnection['httpRequest']> {
    return this._proxyToConn(this._inst, this._inst.httpRequest, ...args)
  }

  ping(
    ...args: CppCbToNew<CppConnection['ping']>
  ): ReturnType<CppConnection['ping']> {
    return this._proxyToConn(this._inst, this._inst.ping, ...args)
  }

  diag(
    ...args: CppCbToNew<CppConnection['diag']>
  ): ReturnType<CppConnection['diag']> {
    return this._proxyToConn(this._inst, this._inst.diag, ...args)
  }

  private _proxyToConn<FArgs extends any[], CbArgs extends any[]>(
    thisArg: CppConnection,
    fn: (
      ...cppArgs: [
        ...FArgs,
        (...cppCbArgs: [CppError | null, ...CbArgs]) => void
      ]
    ) => void,
    ...newArgs: [...FArgs, (...newCbArgs: [Error | null, ...CbArgs]) => void]
  ) {
    const wrappedArgs = newArgs
    const callback = wrappedArgs.pop() as (
      ...cbArgs: [Error | null, ...CbArgs]
    ) => void

    if (this._closed) {
      const closeErr = new ConnectionClosedError()
      return ((callback as any) as ErrCallback)(closeErr)
    }

    wrappedArgs.push((err: CppError | null, ...cbArgs: CbArgs) => {
      const translatedErr = translateCppError(err)
      callback.apply(undefined, [translatedErr, ...cbArgs])
    })
    fn.apply(thisArg, wrappedArgs)
  }
}
