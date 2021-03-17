import debug from 'debug'

/**
 * Represents the various levels of severity that a log message
 * might be.
 *
 * @category Logging
 */
export enum LogSeverity {
  /**
   * Trace level logging, extremely detailed.
   */
  Trace,

  /**
   * Debug level logging, helpful to debug some forms of issues.
   */
  Debug,

  /**
   * Info level logging, this is the default log level and includes
   * general information about what is happening.
   */
  Info,

  /**
   * Warn level logging, these represents issues that should be addressed,
   * but which do not prevent the full functioning of the SDK.
   */
  Warn,

  /**
   * Error level logging, these represent issues that must be addressed,
   * but which do not cause the entire SDK to need to shut down.
   */
  Error,

  /**
   * Fatal level logging, these represent fatal issues that require the
   * SDK to completely stop.
   */
  Fatal,
}

/**
 * Represents various pieces of information associated with a log message.
 *
 * @category Logging
 */
export interface LogData {
  /**
   * Indicates the severity level for this log message.
   */
  severity: LogSeverity

  /**
   * The source file where the log message was generated, if available.
   */
  srcFile: string

  /**
   * The source line where the log message was generated, if available.
   */
  srcLine: number

  /**
   * The sub-system which generated the log message.
   */
  subsys: string

  /**
   * The log message itself.
   */
  message: string
}

/**
 * The log function interface used for handling log messages being generated
 * by the library.
 *
 * @category Logging
 */
export interface LogFunc {
  (data: LogData): void
}

/**
 * @internal
 */
const libLogger = debug('couchnode')
export { libLogger }

const lcbLogger = libLogger.extend('lcb')

const severityLoggers = {
  [LogSeverity.Trace]: lcbLogger.extend('trace'),
  [LogSeverity.Debug]: lcbLogger.extend('debug'),
  [LogSeverity.Info]: lcbLogger.extend('info'),
  [LogSeverity.Warn]: lcbLogger.extend('warn'),
  [LogSeverity.Error]: lcbLogger.extend('error'),
  [LogSeverity.Fatal]: lcbLogger.extend('fatal'),
}

/**
 * @internal
 */
function _logSevToLogger(severity: LogSeverity) {
  // We cache our loggers above since some versions of the debug library
  // incur an disproportional cost (or leak memory) for calling extend.
  const logger = severityLoggers[severity]
  if (logger) {
    return logger
  }

  // We still call extend if there is an unexpected severity, this shouldn't
  // really happen though...
  return lcbLogger.extend('sev' + severity)
}

/**
 * @internal
 */
function logToDebug(data: LogData): void {
  const logger = _logSevToLogger(data.severity)
  const location = data.srcFile + ':' + data.srcLine
  logger('(' + data.subsys + ' @ ' + location + ') ' + data.message)
}

/**
 * The default logger which is used by the SDK.  This logger uses the `debug`
 * library to write its log messages in a way that is easily accessible.
 *
 * @category Logging
 */
export const defaultLogger: LogFunc = logToDebug
