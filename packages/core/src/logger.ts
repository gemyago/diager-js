interface LogData {
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

export const LogLevel = {
  error: 'error',
  warn: 'warn',
  info: 'info',
  debug: 'debug',
  trace: 'trace',
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel]

/**
 * Unified logger interface. Key points:
 * 1. Standardizes the way error objects are included in logs
 * 2. Standardizes the way arbitrary data is included with logs
 * 3. Standardizes the way child loggers are created
 */
export type Logger = {
  /**
   * Creates a child logger of a given group name.
   * The way group is written to an underlying logger
   * is implementation specific.
   */
  withGroup(name: string): Logger

  /*
  * Includes additional data with log output.
  * Note: you must call one of the level methods (like error or warn ...)
  * in order to have the log entry actually written. Calling just withData
  * is a noop.
  */
  withData(data: LogData): Omit<Logger, 'withData' | 'withGroup'>

  /*
  * Include error object with log output.
  * Note: you must call one of the level methods (like error or warn ...)
  * in order to have the log entry written. Calling just withError is a noop.
  */
  withError(error: unknown): Omit<Logger, 'withError' | 'withGroup'>

  /**
   * Write a log entry with error level. Please use withData or withError to
   * include additional data or error object with the log message.
   */
  error(msg: string): void

  /**
   * Write a log entry with warn level. Please use withData or withError to
   * include additional data or error object with the log message.
   */
  warn(msg: string): void

  /**
   * Write a log entry with info level. Please use withData or withError to
   * include additional data or error object with the log message.
   */
  info(msg: string): void

  /**
   * Write a log entry with debug level. Please use withData or withError to
   * include additional data or error object with the log message.
   */
  debug(msg: string): void

  /**
   * Write a log entry with trace level. Please use withData or withError to
   * include additional data or error object with the log message.
   */
  trace(msg: string): void

  /**
   * Clean way to write log with runtime defined level. Please use withData or withError to
   * include additional data or error object with the log message.
   */
  write(level: LogLevel, msg: string): void

  /**
   * Allow runtime checking if given log level is enabled.
   * Can be used in performance critical scenarios where log data preparation
   * is a concern.
   */
  isLevelEnabled(level: LogLevel): boolean
}
