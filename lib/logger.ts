/**
 * Represents log levels in ascending order of severity.
 *
 * Log levels follow standard severity conventions.
 *
 * - TRACE: Finest-grained informational events for detailed debugging.
 * - DEBUG: Detailed informational events useful for debugging.
 * - INFO: Informational messages highlighting application progress.
 * - WARN: Potentially harmful situations that warrant attention.
 * - ERROR: Error events that might still allow the application to continue.
 *
 * @category Logging
 */
export enum LogLevel {
  /**
   * Finest-grained informational events, typically used for detailed debugging.
   */
  TRACE = 0,

  /**
   * Detailed informational events useful for debugging an application.
   */
  DEBUG = 1,

  /**
   * Informational messages that highlight the progress of the application.
   */
  INFO = 2,

  /**
   * Potentially harmful situations that warrant attention.
   */
  WARN = 3,

  /**
   * Error events that might still allow the application to continue running.
   */
  ERROR = 4,
}

/**
 * @internal
 */
const LOG_LEVEL_NAMES = ['trace', 'debug', 'info', 'warn', 'error'] as const

/**
 * @internal
 */
type LogLevelName = (typeof LOG_LEVEL_NAMES)[number]

/**
 * Parses a log level from either a string or LogLevel enum value.
 *
 * When a string is provided, the parsing is case-insensitive.
 *
 * @param level - The log level as a string or LogLevel enum value.
 * @returns {LogLevel | undefined} The corresponding LogLevel enum value, or undefined if invalid.
 *
 * @category Logging
 */
export function parseLogLevel(level: LogLevel | string): LogLevel | undefined {
  if (typeof level === 'number') {
    return level >= LogLevel.TRACE && level <= LogLevel.ERROR
      ? level
      : undefined
  }

  const normalized = level.toLowerCase()
  const index = LOG_LEVEL_NAMES.indexOf(normalized as LogLevelName)
  return index >= 0 ? (index as LogLevel) : undefined
}

/**
 * Interface for logging operations within the Couchbase SDK.
 *
 * All logging methods are optional, allowing implementers to choose which
 * log levels to support.
 *
 * @category Logging
 */
export interface Logger {
  /**
   * Logs a message at the TRACE level.
   *
   * @param message - The message to log.
   * @param args - Optional additional arguments for formatting or context.
   */
  trace?(message: string, ...args: any[]): void

  /**
   * Logs a message at the DEBUG level.
   *
   * @param message - The message to log.
   * @param args - Optional additional arguments for formatting or context.
   */
  debug?(message: string, ...args: any[]): void

  /**
   * Logs a message at the INFO level.
   *
   * @param message - The message to log.
   * @param args - Optional additional arguments for formatting or context.
   */
  info?(message: string, ...args: any[]): void

  /**
   * Logs a message at the WARN level.
   *
   * @param message - The message to log.
   * @param args - Optional additional arguments for formatting or context.
   */
  warn?(message: string, ...args: any[]): void

  /**
   * Logs a message at the ERROR level.
   *
   * @param message - The message to log.
   * @param args - Optional additional arguments for formatting or context.
   */
  error?(message: string, ...args: any[]): void
}

/**
 * A no-operation logger implementation that discards all log messages.
 *
 * @category Logging
 */
export class NoOpLogger implements Logger {
  /**
   * No-op implementation of trace logging.
   */
  trace(): void {}

  /**
   * No-op implementation of debug logging.
   */
  debug(): void {}

  /**
   * No-op implementation of info logging.
   */
  info(): void {}

  /**
   * No-op implementation of warn logging.
   */
  warn(): void {}

  /**
   * No-op implementation of error logging.
   */
  error(): void {}
}

/**
 * A safe wrapper around user-provided Logger implementations.
 *
 * This wrapper ensures that calling any logging method is always safe, even if the
 * underlying logger is undefined or the underlying logger only implements a subset
 * of methods.
 *
 * @category Logging
 */
export class CouchbaseLogger implements Logger {
  private readonly _logger?: Logger

  /**
   * Creates a new CouchbaseLogger wrapper.
   *
   * @param logger - Optional user-provided logger implementation.
   *                 Can be undefined or implement only a subset of methods.
   */
  constructor(logger?: Logger) {
    this._logger = logger
  }

  /**
   * Logs a message at the TRACE level if the underlying logger implements it.
   *
   * If the logger is undefined or doesn't implement trace, this is a no-op.
   *
   * @param message - The message to log.
   * @param args - Optional additional arguments for formatting or context.
   */
  trace(message: string, ...args: any[]): void {
    this._logger?.trace?.(message, ...args)
  }

  /**
   * Logs a message at the DEBUG level if the underlying logger implements it.
   *
   * If the logger is undefined or doesn't implement debug, this is a no-op.
   *
   * @param message - The message to log.
   * @param args - Optional additional arguments for formatting or context.
   */
  debug(message: string, ...args: any[]): void {
    this._logger?.debug?.(message, ...args)
  }

  /**
   * Logs a message at the INFO level if the underlying logger implements it.
   *
   * If the logger is undefined or doesn't implement info, this is a no-op.
   *
   * @param message - The message to log.
   * @param args - Optional additional arguments for formatting or context.
   */
  info(message: string, ...args: any[]): void {
    this._logger?.info?.(message, ...args)
  }

  /**
   * Logs a message at the WARN level if the underlying logger implements it.
   *
   * If the logger is undefined or doesn't implement warn, this is a no-op.
   *
   * @param message - The message to log.
   * @param args - Optional additional arguments for formatting or context.
   */
  warn(message: string, ...args: any[]): void {
    this._logger?.warn?.(message, ...args)
  }

  /**
   * Logs a message at the ERROR level if the underlying logger implements it.
   *
   * If the logger is undefined or doesn't implement error, this is a no-op.
   *
   * @param message - The message to log.
   * @param args - Optional additional arguments for formatting or context.
   */
  error(message: string, ...args: any[]): void {
    this._logger?.error?.(message, ...args)
  }
}

/**
 * Creates a CouchbaseLogger that outputs to the console up to the specified log level.
 *
 * @param logLevel - The log level to output to the console.
 * @param prefix - Optional prefix to prepend to all log messages.
 * @returns {CouchbaseLogger} A CouchbaseLogger configured for console output.
 *
 * @category Logging
 */
export function createConsoleLogger(
  logLevel: LogLevel,
  prefix?: string
): CouchbaseLogger {
  const consoleImpl: Logger = {}
  const formatMessage = (msg: string) => (prefix ? `${prefix} ${msg}` : msg)

  if (logLevel <= LogLevel.TRACE) {
    consoleImpl.trace = (message: string, ...args: any[]) => {
      console.trace(formatMessage(message), ...args)
    }
  }

  if (logLevel <= LogLevel.DEBUG) {
    consoleImpl.debug = (message: string, ...args: any[]) => {
      console.debug(formatMessage(message), ...args)
    }
  }

  if (logLevel <= LogLevel.INFO) {
    consoleImpl.info = (message: string, ...args: any[]) => {
      console.info(formatMessage(message), ...args)
    }
  }

  if (logLevel <= LogLevel.WARN) {
    consoleImpl.warn = (message: string, ...args: any[]) => {
      console.warn(formatMessage(message), ...args)
    }
  }

  if (logLevel <= LogLevel.ERROR) {
    consoleImpl.error = (message: string, ...args: any[]) => {
      console.error(formatMessage(message), ...args)
    }
  }

  return new CouchbaseLogger(consoleImpl)
}
